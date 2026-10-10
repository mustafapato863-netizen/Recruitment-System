import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { changeJobStatus, fetchOpenJobs, isRedactedJob, jobActions, jobErrorFromError, loadJobBoard, moveCheck, type BoardApplication, type JobDetail } from '../jobs';
import { importRow, splitName, cvFileProblem, duplicateCheck } from '../cvImport';
import { ME, applications, jobDetail, redactedJob, vacancyList, workQueue } from '../__fixtures__/jobs';

afterEach(() => Object.values(api).forEach((f) => f.mockReset()));
const serve = (map: Record<string, unknown>) => api.getApi.mockImplementation(async (p: string) => { const k = Object.keys(map).find((x) => p === x || p.startsWith(`${x}?`)); if (!k) throw new ApiError(404, 'nf'); return structuredClone(map[k]); });

describe('E08 adapter (B4 JobWorkQueueItem + Vacancy.targetChip + B1 redaction)', () => {
  it('splits my jobs from others, takes due date from targetChip, redacts others client-side, no pay', async () => {
    serve({ '/vacancies/work-queue': workQueue, '/vacancies': vacancyList });
    const r = await fetchOpenJobs(ME);
    expect(api.getApi).toHaveBeenCalledWith('/vacancies/work-queue?pageSize=100');
    expect(r.mine.map((j) => j.title)).toEqual(['HRIS Developer', 'Laravel Backend Engineer', 'Patient Relations Officer', 'Staff Nurse — ICU', 'Medical Coder']);
    expect(r.mine[0]).toMatchObject({ seats: { filled: 1, target: 3 }, dueDate: '2026-10-19', department: 'IT', active: 10 });
    expect(r.others).toEqual([
      { id: 'r1', title: 'Pharmacist', site: 'SGH Jeddah', seats: { filled: 1, target: 4 } },
      { id: 'r2', title: 'Radiology Technician', site: 'SGH Dammam', seats: { filled: 0, target: 4 } },
      { id: 'v9', title: 'BI Data Analyst', site: 'SGH Riyadh', seats: { filled: 0, target: 1 } },
    ]);
    expect(JSON.stringify(r)).not.toMatch(/budget|salary|42000|99000/i);
  });
  it('isRedactedJob guards the B1 shape', () => {
    expect(isRedactedJob(redactedJob)).toBe(true);
    expect(isRedactedJob(jobDetail())).toBe(false);
  });
});

describe('E09 adapter', () => {
  it('board = Applied…Pre-Hire; Joined/Rejected/Withdrawn counted under the board; pay stripped', async () => {
    serve({ '/vacancies/v1': jobDetail(), '/applications': applications });
    const b = await loadJobBoard('v1');
    expect(api.getApi).toHaveBeenCalledWith('/applications?vacancyId=v1&pageSize=100');
    expect(b.apps).toHaveLength(10);
    expect(b.closed).toEqual({ rejected: 3, joined: 1, withdrawn: 0 });
    expect(JSON.stringify(b)).not.toMatch(/budget|expectedSalary|42000/i);
  });
  it('a redacted job loads no applications', async () => {
    serve({ '/vacancies/r1': redactedJob });
    const b = await loadJobBoard('r1');
    expect(b.apps).toEqual([]);
    expect(api.getApi).toHaveBeenCalledTimes(1);
  });
  it('moveCheck: allowedTransitions + one column at a time + closed/redacted jobs', () => {
    const a = applications.data[6] as unknown as BoardApplication; // Interview
    const job = jobDetail() as unknown as JobDetail;
    expect(moveCheck(a, 'Offer', job)).toEqual({ ok: true });
    expect(moveCheck(a, 'Screening', job)).toEqual({ ok: true });
    expect(moveCheck(a, 'Pre-Hire', job)).toMatchObject({ ok: false, reason: expect.stringMatching(/one stage at a time; Offer comes first/) });
    expect(moveCheck({ ...a, allowedTransitions: ['Rejected'] }, 'Offer', job)).toMatchObject({ ok: false, reason: 'Interview cannot move to Offer.' });
    expect(moveCheck(a, 'Offer', { ...job, status: 'Closed' })).toMatchObject({ ok: false, reason: 'This job is closed.' });
    expect(moveCheck(a, 'Offer', redactedJob as never)).toMatchObject({ ok: false });
  });
});

describe('E12 adapter (B3)', () => {
  it('posts the reason to hold / reopen / close', async () => {
    api.postApi.mockResolvedValue(jobDetail('On Hold'));
    await changeJobStatus('v1', 'hold', '  Hiring manager away ');
    expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', { reason: 'Hiring manager away' });
    await changeJobStatus('v1', 'reopen', 'Back');
    expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/reopen', { reason: 'Back' });
    await changeJobStatus('v1', 'close', 'Not needed');
    expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/close', { reason: 'Not needed' });
  });
  it('jobActions mirrors JOB_TRANSITIONS (reopen only from On Hold, Closed terminal)', () => {
    expect(jobActions('Open')).toEqual(['hold', 'close']);
    expect(jobActions('Partially Filled')).toEqual(['hold', 'close']);
    expect(jobActions('On Hold')).toEqual(['reopen', 'close']);
    expect(jobActions('Filled')).toEqual(['close']);
    expect(jobActions('Closed')).toEqual([]);
  });
});

describe('error pass-through: the filter drops B3/B6 codes but keeps the message, so we map messages back', () => {
  const env = (status: number, code: string, message: string) => new ApiError(status, message, undefined, { code });
  it.each([
    [400, 'VALIDATION_ERROR', 'A reason is required to hold this job.', 'REASON_REQUIRED'],
    [409, 'CONFLICT', 'Only a held job can be reopened (job is Open).', 'ILLEGAL_JOB_TRANSITION'],
    [409, 'CONFLICT', 'A job cannot move from Closed to On Hold.', 'ILLEGAL_JOB_TRANSITION'],
    [403, 'FORBIDDEN', 'Only the job owner or their manager can hold, reopen or close this job.', 'NOT_JOB_OWNER'],
    [403, 'FORBIDDEN', 'An administrator cannot hold, reopen or close a job.', 'ADMIN_CANNOT_CHANGE_JOB_STATUS'],
    [409, 'CONFLICT', 'Job VAC-1 is On Hold and accepts no new applications.', 'JOB_NOT_ACCEPTING_APPLICATIONS'],
    [409, 'CONFLICT', 'Request REQ-1 is Cancelled and cannot be activated.', 'REQUISITION_CANCELLED'],
    [409, 'CONFLICT', 'Candidate Nourhan Sami has already applied to vacancy VAC-1.', 'APPLICATION_EXISTS'],
    [409, 'CONFLICT', 'A candidate with the same email or phone already exists in your organization.', 'CANDIDATE_DUPLICATE'],
    [400, 'VALIDATION_ERROR', 'Provide an email or a phone.', 'CONTACT_REQUIRED'],
    [409, 'CONFLICT', 'This application changed before the stage update could be saved.', 'STALE_STAGE'],
    [409, 'CONFLICT', 'Offer needs a submitted interview scorecard.', 'GATE_SCORECARD_NOT_SUBMITTED'],
  ])('%s %s "%s" → %s', (status, code, message, expected) => {
    expect(jobErrorFromError(env(status, code, message))?.code).toBe(expected);
  });
  it('also accepts the raw code if Backend starts passing it through', () => {
    expect(jobErrorFromError(env(409, 'ILLEGAL_JOB_TRANSITION', 'x'))?.code).toBe('ILLEGAL_JOB_TRANSITION');
  });
});

describe('E11 adapter (resume parse + B6 duplicate check)', () => {
  const file = new File(['%PDF'], 'rania-kamel-cv.pdf', { type: 'application/pdf' });
  it('validates files like the API (PDF/DOC/DOCX ≤ 10 MB)', () => {
    expect(cvFileProblem(file)).toBeNull();
    expect(cvFileProblem(new File(['x'], 'cvs.zip'))).toMatch(/ZIP/);
  });
  it('duplicate-check body', async () => {
    api.postApi.mockResolvedValue({});
    await duplicateCheck({ email: 'a@b.c' });
    expect(api.postApi).toHaveBeenCalledWith('/candidates/duplicate-check', { email: 'a@b.c' });
  });
  it('link: no candidate created; CV uploaded to the existing person; application added', async () => {
    api.postFormDataApi.mockResolvedValue({ id: 'd1' });
    api.postApi.mockResolvedValue({ id: 'app-new' });
    const r = await importRow('v1', file, { firstName: 'Nourhan', rawText: 'x' }, { kind: 'link', candidateId: 'c-a4' });
    expect(api.postApi).not.toHaveBeenCalledWith('/candidates', expect.anything());
    const fd = api.postFormDataApi.mock.calls[0][1] as FormData;
    expect(api.postFormDataApi.mock.calls[0][0]).toBe('/documents/upload');
    expect(fd.get('candidateId')).toBe('c-a4');
    expect(fd.get('documentType')).toBe('CV');
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-a4', source: 'CV import' });
    expect(r).toEqual({ candidateId: 'c-a4', applicationId: 'app-new' });
  });
  it('create: POST /candidates with the parsed fields, then upload + application', async () => {
    api.postFormDataApi.mockResolvedValue({ id: 'd1' });
    api.postApi.mockImplementation(async (p: string) => (p === '/candidates' ? { id: 'c-new' } : { id: 'app-new' }));
    await importRow('v1', file, { firstName: 'Rania', lastName: 'Kamel', email: 'r@x.test', title: 'HR Systems Analyst', experienceYears: 6.4 }, { kind: 'create' });
    expect(api.postApi).toHaveBeenCalledWith('/candidates', { firstName: 'Rania', lastName: 'Kamel', email: 'r@x.test', currentTitle: 'HR Systems Analyst', experienceYears: 6, source: 'CV import' });
    expect(api.postApi).toHaveBeenLastCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-new', source: 'CV import' });
  });
  it('splitName falls back to the file name', () => {
    expect(splitName({}, 'karim-sobhy-cv.pdf')).toEqual({ firstName: 'Karim', lastName: 'Sobhy' });
  });
});
