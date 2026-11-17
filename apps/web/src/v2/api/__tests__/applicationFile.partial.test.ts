import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { fileResponses } from '../__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

import { blockingSection, gateState, loadApplicationFile, loadApproverFile, loadLicenseFile, loadMessageSection, loadScreeningDraft, reloadFileSection } from '../applicationFile';

const calls = () => api.getApi.mock.calls.map(([path]) => String(path));

function install(map: Record<string, unknown>) {
  api.getApi.mockImplementation(async (path: string) => {
    const bare = path.split('?')[0];
    const value = path in map ? map[path] : bare in map ? map[bare] : undefined;
    if (value === undefined) throw new ApiError(404, `not found ${path}`);
    if (value instanceof Error) throw value;
    return structuredClone(value);
  });
}

beforeEach(() => {
  api.getApi.mockReset();
  api.postApi.mockReset();
  api.patchApi.mockReset();
  api.putApi.mockReset();
});

describe('application file partial reads', () => {
  it('keeps a successful empty section distinct from a failed read', async () => {
    install({
      ...fileResponses('applied'),
      '/applications/a1/notes': { data: [] },
      '/applications/a1/history': [],
      '/applications/a1/joining-checks': [],
      '/applications/a1/documents': [],
    });
    const file = await loadApplicationFile('a1');
    expect(file.screening).toEqual([]);
    expect(file.sections?.screening).toEqual({ status: 'empty' });
    expect(file.sections?.notes).toEqual({ status: 'empty' });
    expect(file.sections?.history).toEqual({ status: 'empty' });
    expect(file.sections?.interviews).toEqual({ status: 'empty' });
    expect(file.sections?.scorecards).toEqual({ status: 'empty' });
    expect(file.sections?.offer).toEqual({ status: 'empty' });
    expect(file.offer).toBeNull();
    expect(file.sections?.hiring).toEqual({ status: 'empty' });
    expect(file.hiring).toBeNull();
    expect(file.sections?.joiningChecks).toEqual({ status: 'empty' });
    expect(file.sections?.documents).toEqual({ status: 'empty' });
    expect(file.requestedId).toBe('a1');
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(api.putApi).not.toHaveBeenCalled();
  });

  it('classifies two simultaneous auxiliary failures without requesting scorecards', async () => {
    install({
      ...fileResponses('interview'),
      '/screening/application/a1': new ApiError(500, 'Screening store timed out.'),
      '/applications/a1/documents': new ApiError(403, 'Documents are not available for this role.'),
      '/interviews': new ApiError(500, 'Interviews could not be listed.'),
      '/applications/a1/notes': new TypeError('Failed to fetch'),
      '/offers': new ApiError(409, 'Offer is closed.'),
    });
    const file = await loadApplicationFile('a1');
    expect(file.sections?.screening).toMatchObject({ status: 'error', failure: 'transient', statusCode: 500 });
    expect(file.sections?.documents).toEqual({ status: 'unavailable' });
    expect(file.sections?.interviews).toMatchObject({ status: 'error', failure: 'transient', statusCode: 500 });
    expect(file.sections?.scorecards).toMatchObject({ status: 'error', failure: 'transient' });
    expect(file.sections?.notes).toMatchObject({ status: 'error', failure: 'transient', statusCode: null });
    expect(file.sections?.offer).toMatchObject({ status: 'error', failure: 'domain', statusCode: 409, message: 'Offer is closed.' });
    expect(file.screening).toEqual([]);
    expect(file.documents).toEqual([]);
    expect(file.interviews).toEqual([]);
    expect(file.offer).toBeNull();
    expect(file.sections?.history.status).toBe('ready');
    expect(calls().some((path) => path.includes('/scorecard'))).toBe(false);
    expect(calls().some((path) => path.startsWith('/offers/'))).toBe(false);
  });

  it('does not send auxiliary reads when the workspace is forbidden', async () => {
    install({ ...fileResponses('applied'), '/applications/a1/workspace': new ApiError(403, 'Access denied.', {}, { code: 'FORBIDDEN' }) });
    await expect(loadApplicationFile('a1')).rejects.toMatchObject({ statusCode: 403 });
    expect(calls()).toEqual(['/applications/a1/workspace']);
  });

  it('does not request sensitive file reads for an approver or a licence specialist', async () => {
    const seen: string[] = [];
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/applications/a1') {
        return { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: 'c1', stage: 'Pre-hire', allowedTransitions: [], version: 1, appliedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', candidate: { id: 'c1', fullName: 'Rania Otaibi' } };
      }
      if (path === '/documents/candidate/c1') return [{ id: 'd1', documentType: 'CV', fileName: 'rania-cv.pdf', createdAt: '2026-10-01T00:00:00.000Z' }];
      throw new Error(`unexpected ${path}`);
    });
    const approver = await loadApproverFile('a1');
    expect(seen.sort()).toEqual(['/applications/a1', '/documents/candidate/c1']);
    expect(approver.sections?.screening.status).toBe('unavailable');
    expect(approver.sections?.offer.status).toBe('unavailable');
    expect(approver.sections?.messages?.status).toBe('unavailable');
    expect(approver.documents.map((doc) => doc.name)).toEqual(['rania-cv.pdf']);

    seen.length = 0;
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/applications/a1') {
        return { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: 'c1', stage: 'Pre-hire', allowedTransitions: [], version: 1, appliedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
      }
      if (path === '/documents/candidate/c1') throw new ApiError(403, 'no documents');
      throw new Error(`unexpected ${path}`);
    });
    const denied = await loadApproverFile('a1');
    expect(seen.sort()).toEqual(['/applications/a1', '/documents/candidate/c1']);
    expect(denied.sections?.documents.status).toBe('unavailable');
    expect(denied.documents).toEqual([]);

    seen.length = 0;
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/applications/a1') {
        return { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: '', stage: 'Pre-hire', allowedTransitions: [], version: 1, appliedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
      }
      throw new Error(`unexpected ${path}`);
    });
    const noCandidate = await loadApproverFile('a1');
    expect(seen).toEqual(['/applications/a1']);
    expect(noCandidate.sections?.documents.status).toBe('unavailable');

    seen.length = 0;
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/hiring?applicationId=a1') {
        return [{ id: 'h1', applicationId: 'a1', offerId: 'o1', status: 'In Progress', candidateName: 'Omar Licence', positionTitle: 'Nurse', complianceRequirements: [{ id: 'lic', type: 'License', name: 'SCFHS licence', status: 'Pending', isRequired: true }] }];
      }
      throw new Error(`unexpected ${path}`);
    });
    const licence = await loadLicenseFile('a1');
    expect(seen).toEqual(['/hiring?applicationId=a1']);
    expect(licence.sections?.screening.status).toBe('unavailable');
    expect(licence.sections?.offer.status).toBe('unavailable');
    expect(licence.sections?.hiring.status).toBe('ready');
    expect(licence.sections?.joiningChecks.status).toBe('ready');
    expect(licence.joiningChecks.map((check) => check.label)).toEqual(['SCFHS licence']);

    api.getApi.mockRejectedValueOnce(new ApiError(500, 'Hiring store failed.'));
    await expect(loadLicenseFile('a1')).rejects.toMatchObject({ statusCode: 500 });
  });

  it('does not apply an offer detail for another application or a failed detail as the list summary', async () => {
    const responses = fileResponses('offer-sent');
    install({ ...responses, '/offers/o1': { ...(responses['/offers/o1'] as object), applicationId: 'other-app' } });
    const mismatched = await loadApplicationFile('a1');
    expect(mismatched.offer).toBeNull();
    expect(mismatched.sections?.offer).toMatchObject({ status: 'error', failure: 'domain' });
    expect(mismatched.sections?.offer.status === 'error' && mismatched.sections.offer.message).toMatch(/not applied/);

    install({ ...responses, '/offers/o1': new ApiError(500, 'Offer detail failed.') });
    const failed = await loadApplicationFile('a1');
    expect(failed.offer).toBeNull();
    expect(failed.sections?.offer).toMatchObject({ status: 'error', failure: 'transient', statusCode: 500 });
    expect(JSON.stringify(failed.offer)).not.toMatch(/OFF-2026-0012/);
  });

  it('reloads only the requested section and skips scorecards while interviews are unknown', async () => {
    install(fileResponses('interview'));
    const file = await loadApplicationFile('a1');
    api.getApi.mockClear();
    install({ ...fileResponses('interview'), '/screening/application/a1': [] });
    const retried = await reloadFileSection(file, 'screening');
    expect(calls()).toEqual(['/screening/application/a1']);
    expect(retried.sections?.screening.status).toBe('empty');
    expect(retried.notes).toEqual(file.notes);
    expect(retried.documents).toEqual(file.documents);
    expect(api.postApi).not.toHaveBeenCalled();

    install({ ...fileResponses('interview'), '/interviews': new ApiError(500, 'down') });
    const broken = await loadApplicationFile('a1');
    api.getApi.mockClear();
    const scorecards = await reloadFileSection(broken, 'scorecards');
    expect(api.getApi).not.toHaveBeenCalled();
    expect(scorecards.sections?.scorecards).toMatchObject({ status: 'error' });
    expect(scorecards.interviews).toEqual([]);

    api.getApi.mockClear();
    install({ ...fileResponses('interview'), '/interviews': [] });
    const recoveredEmpty = await reloadFileSection(broken, 'interviews');
    expect(calls()).toEqual(['/interviews?applicationId=a1']);
    expect(recoveredEmpty.interviews).toEqual([]);
    expect(recoveredEmpty.scorecards).toEqual({});
    expect(recoveredEmpty.sections?.interviews).toEqual({ status: 'empty' });
    expect(recoveredEmpty.sections?.scorecards).toEqual({ status: 'empty' });

    api.getApi.mockClear();
    install(fileResponses('scored'));
    const recoveredScored = await reloadFileSection(broken, 'interviews');
    expect(calls()).toEqual(['/interviews?applicationId=a1', '/interviews/iv1/scorecard']);
    expect(recoveredScored.interviews).toHaveLength(1);
    expect(recoveredScored.sections?.interviews.status).toBe('ready');
    expect(recoveredScored.sections?.scorecards.status).toBe('ready');
    expect(recoveredScored.scorecards.iv1).toHaveLength(1);
  });

  it('classifies a screening draft without turning a failure into an empty draft', async () => {
    api.getApi.mockResolvedValueOnce(null);
    await expect(loadScreeningDraft('a1')).resolves.toEqual({ status: 'empty' });

    api.getApi.mockRejectedValueOnce(new ApiError(500, 'Draft store failed.'));
    await expect(loadScreeningDraft('a1')).resolves.toMatchObject({ status: 'error', failure: 'transient', statusCode: 500 });

    api.getApi.mockResolvedValueOnce({ id: 'd', applicationId: 'other', outcome: 'Passed', organizationId: 'o', userId: 'u', createdAt: '', updatedAt: '' });
    const mismatched = await loadScreeningDraft('a1');
    expect(mismatched.status).toBe('error');
    if (mismatched.status === 'error') expect(mismatched.failure).toBe('domain');
  });

  it('keeps a successful empty message list ready and classifies a failed read', async () => {
    api.getApi.mockResolvedValueOnce({ destination: 'local-test@recruitflow.local', templates: [], followUpDate: null, attempts: [] });
    const ready = await loadMessageSection('a1');
    expect(ready).toMatchObject({ status: 'ready', data: { attempts: [] } });

    api.getApi.mockRejectedValueOnce(new ApiError(403, 'no messages'));
    await expect(loadMessageSection('a1')).resolves.toEqual({ status: 'unavailable' });

    api.getApi.mockRejectedValueOnce(new ApiError(404, 'missing messages'));
    await expect(loadMessageSection('a1')).resolves.toMatchObject({ status: 'error', failure: 'not-found', statusCode: 404 });

    api.getApi.mockRejectedValueOnce(new ApiError(500, 'messages down'));
    await expect(loadMessageSection('a1')).resolves.toMatchObject({ status: 'error', failure: 'transient' });
  });

  it('treats malformed successful payloads as explicit domain errors instead of empty lists across section, scorecard, approver, licence, and draft readers', async () => {
    install({
      ...fileResponses('interview'),
      '/screening/application/a1': {},
      '/interviews/iv1/scorecard': null,
      '/offers': { data: 'not-an-array' },
      '/hiring': 'bad-payload',
      '/applications/a1/joining-checks': [null],
      '/applications/a1/documents': { items: [] },
      '/applications/a1/notes': 123,
      '/applications/a1/history': { data: null },
    });
    const file = await loadApplicationFile('a1');
    expect(file.sections?.screening).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Screening could not be read.' });
    expect(file.sections?.interviews.status).toBe('ready');
    expect(file.sections?.scorecards).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Scorecards could not be read.' });
    expect(file.sections?.offer).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'The offer could not be read.' });
    expect(file.sections?.hiring).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Hiring could not be read.' });
    expect(file.sections?.joiningChecks).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Joining checks could not be read.' });
    expect(file.sections?.documents).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Documents could not be read.' });
    expect(file.sections?.notes).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Notes could not be read.' });
    expect(file.sections?.history).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'History could not be read.' });
    expect(gateState(file).unknown).toEqual({
      screening: true,
      interviews: false,
      scorecards: true,
      offer: true,
      hiring: true,
      joining: true,
    });
    expect(blockingSection(file)).toBe('scorecards');

    install({ ...fileResponses('interview'), '/interviews/iv1/scorecard': { data: [] } });
    const recoveredScorecards = await reloadFileSection(file, 'scorecards');
    expect(recoveredScorecards.sections?.scorecards).toEqual({ status: 'empty' });
    expect(recoveredScorecards.scorecards).toEqual({ iv1: [] });
    expect(gateState(recoveredScorecards).unknown.scorecards).toBe(false);

    const approverApp = { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: 'c1', stage: 'Pre-Hire', allowedTransitions: [], version: 1, appliedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    install({ '/applications/a1': approverApp, '/documents/candidate/c1': { data: [] } });
    const approverEmpty = await loadApproverFile('a1');
    expect(approverEmpty.sections?.documents).toEqual({ status: 'empty' });

    install({ '/applications/a1': approverApp, '/documents/candidate/c1': { unexpected: true } });
    const approverMalformed = await loadApproverFile('a1');
    expect(approverMalformed.sections?.documents).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Documents could not be read.' });
    expect(approverMalformed.documents).toEqual([]);

    install({ '/applications/a1': approverApp, '/documents/candidate/c1': [{ id: 'd1', documentType: 'CV', fileName: 'cv.pdf', createdAt: '2026-10-01T00:00:00.000Z' }] });
    const approverRecovered = await reloadFileSection(approverMalformed, 'documents', { approver: true });
    expect(approverRecovered.sections?.documents.status).toBe('ready');
    expect(approverRecovered.documents.map((doc) => doc.name)).toEqual(['cv.pdf']);

    install({ '/hiring?applicationId=a1': [] });
    await expect(loadLicenseFile('a1')).rejects.toMatchObject({ statusCode: 404, message: 'No licence work is assigned on this file.' });

    install({ '/hiring?applicationId=a1': { unexpected: true } });
    await expect(loadLicenseFile('a1')).rejects.toThrow('Hiring could not be read.');

    for (const badDraft of ['corrupt', 123, [], {}]) {
      api.getApi.mockResolvedValueOnce(badDraft);
      await expect(loadScreeningDraft('a1')).resolves.toEqual({
        status: 'error',
        failure: 'domain',
        statusCode: null,
        message: 'The screening draft could not be read.',
      });
    }

    install({
      ...fileResponses('interview'),
      '/screening/application/a1': [{}],
      '/interviews/iv1/scorecard': [{ id: 'sc1', interviewId: 'iv1', interviewerId: 'u1', overallRating: 4, recommendation: 'Hire', status: 'Submitted' }],
      '/offers': [{}],
      '/hiring': [{ id: 'h1', status: 'Open', complianceRequirements: [{}] }],
      '/applications/a1/joining-checks': [{ id: 'jc1', label: 'National ID', verified: true }],
      '/applications/a1/documents': [{ id: 'd1', type: 'CV', name: 'cv.pdf' }],
      '/applications/a1/notes': [{}],
      '/applications/a1/history': [{}],
    });
    const badRowFile = await loadApplicationFile('a1');
    expect(badRowFile.sections?.screening).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Screening could not be read.' });
    expect(badRowFile.sections?.interviews.status).toBe('ready');
    expect(badRowFile.sections?.scorecards).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Scorecards could not be read.' });
    expect(badRowFile.sections?.offer).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'The offer could not be read.' });
    expect(badRowFile.sections?.hiring).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Hiring could not be read.' });
    expect(badRowFile.sections?.joiningChecks).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Joining checks could not be read.' });
    expect(badRowFile.sections?.documents).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Documents could not be read.' });
    expect(badRowFile.sections?.notes).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Notes could not be read.' });
    expect(badRowFile.sections?.history).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'History could not be read.' });
    expect(badRowFile.screening).toEqual([]);
    expect(badRowFile.scorecards).toEqual({});
    expect(badRowFile.offer).toBeNull();
    expect(badRowFile.hiring).toBeNull();
    expect(badRowFile.joiningChecks).toEqual([]);
    expect(badRowFile.documents).toEqual([]);
    expect(badRowFile.notes).toEqual([]);
    expect(badRowFile.history).toEqual([]);
    expect(gateState(badRowFile).unknown).toEqual({
      screening: true,
      interviews: false,
      scorecards: true,
      offer: true,
      hiring: true,
      joining: true,
    });
    expect(blockingSection(badRowFile)).toBe('scorecards');

    install({
      ...fileResponses('interview'),
      '/applications/a1/joining-checks': [{ type: 'ID', label: 'National ID', verified: true }],
    });
    const recoveredJoining = await reloadFileSection(badRowFile, 'joiningChecks');
    expect(recoveredJoining.sections?.joiningChecks.status).toBe('ready');
    expect(recoveredJoining.joiningChecks).toEqual([{ type: 'ID', label: 'National ID', verified: true }]);
    expect(gateState(recoveredJoining).unknown.joining).toBe(false);

    install({
      ...fileResponses('interview'),
      '/interviews': [{ id: 'iv1', title: 'Panel', scheduledStart: '2026-10-01T10:00:00.000Z', scheduledEnd: '2026-10-01T11:00:00.000Z' }],
    });
    const badInterviews = await reloadFileSection(badRowFile, 'interviews');
    expect(badInterviews.sections?.interviews).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Interviews could not be read.' });
    expect(badInterviews.sections?.scorecards).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Scorecards were not requested because interviews could not be loaded.' });
    expect(badInterviews.interviews).toEqual([]);

    install({ '/applications/a1': approverApp, '/documents/candidate/c1': [{ id: 'd1', fileName: 'cv.pdf', createdAt: '2026-10-01T00:00:00.000Z' }] });
    const approverBadRow = await loadApproverFile('a1');
    expect(approverBadRow.sections?.documents).toEqual({ status: 'error', failure: 'domain', statusCode: null, message: 'Documents could not be read.' });
    expect(approverBadRow.documents).toEqual([]);

    install({ '/hiring?applicationId=a1': [{}] });
    await expect(loadLicenseFile('a1')).rejects.toThrow('Hiring could not be read.');

    for (const badMsg of [
      { destination: 'x@y.local', templates: [{}], attempts: [] },
      { destination: 'x@y.local', templates: [], attempts: [{}] },
    ]) {
      api.getApi.mockResolvedValueOnce(badMsg);
      await expect(loadMessageSection('a1')).resolves.toEqual({
        status: 'error',
        failure: 'domain',
        statusCode: null,
        message: 'Message history could not be read.',
      });
    }
  });
});
