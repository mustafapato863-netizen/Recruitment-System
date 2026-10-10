import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { blockingGate, cairoToday, changeJobStatus, fetchOpenJobs, isRedactedJob, isStaleStage, jobActions, jobErrorFromError, jobReasons, loadJobBoard, moveCheck, type BoardApplication, type JobDetail } from '../jobs';
import { diffForLink, importRow, splitName, cvFileProblem, duplicateCheck } from '../cvImport';
import { applications, closeReasons, holdReasons, jobDetail, redactedJob, workQueue, workQueueMine } from '../__fixtures__/jobs';

afterEach(() => Object.values(api).forEach((f) => f.mockReset()));
const serve = (map: Record<string, unknown>) => api.getApi.mockImplementation(async (p: string) => { const k = Object.keys(map).find((x) => p === x || p.startsWith(`${x}?`)); if (!k) throw new ApiError(404, 'nf'); return structuredClone(map[k]); });

describe('E08 adapter (B3 work queue ?mine=true + dueDate/department/holdUntil + B1 redaction)', () => {
  it('mine = ?mine=true (no /vacancies join, no owner filter); others = the scoped queue minus mine, title/site/seats only; no pay', async () => {
    api.getApi.mockImplementation(async (p: string) => structuredClone(p.includes('mine=true') ? workQueueMine : workQueue));
    const r = await fetchOpenJobs();
    expect(api.getApi).toHaveBeenCalledWith('/vacancies/work-queue?mine=true&pageSize=100');
    expect(api.getApi).toHaveBeenCalledWith('/vacancies/work-queue?pageSize=100');
    expect(api.getApi).not.toHaveBeenCalledWith('/vacancies');
    expect(r.mine.find((j) => j.id === 'v5')).toMatchObject({ status: 'On Hold', holdUntil: '2026-11-01', dueDate: '2026-12-01', department: 'HIM' });
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
  it('= JobStatusReasonDto: hold {reason, note?, holdUntil?}, close {reason, note?}, reopen {reason}', async () => {
    api.postApi.mockResolvedValue(jobDetail('On Hold'));
    await changeJobStatus('v1', 'hold', { reason: ' Budget review ', note: '', holdUntil: '2031-02-01' });
    expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', { reason: 'Budget review', holdUntil: '2031-02-01' });
    await changeJobStatus('v1', 'hold', { reason: 'Other', note: ' Clinic renovation ' });
    expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/hold', { reason: 'Other', note: 'Clinic renovation' });
    await changeJobStatus('v1', 'reopen', { reason: 'Back', note: 'x', holdUntil: '2031-01-01' });
    expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/reopen', { reason: 'Back' });
    await changeJobStatus('v1', 'close', { reason: 'Budget withdrawn', holdUntil: '2031-01-01' });
    expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/close', { reason: 'Budget withdrawn' });
  });
  it('reason lists: GET /master-data/catalog/hold-reasons | close-reasons, active only, "Other" last', async () => {
    serve({ '/master-data/catalog/hold-reasons': holdReasons, '/master-data/catalog/close-reasons': closeReasons });
    expect(await jobReasons('hold')).toEqual(['Budget review', 'Hiring freeze', 'Role under review', 'Awaiting internal candidate', 'Other']);
    expect(await jobReasons('close')).toEqual(['Position no longer needed', 'Budget withdrawn', 'Filled internally', 'Other']);
  });
  it('cairoToday is the Cairo calendar day', () => {
    expect(cairoToday(new Date('2026-10-09T22:30:00Z'))).toBe('2026-10-10');
  });
  it('jobActions mirrors JOB_TRANSITIONS (reopen only from On Hold, Closed terminal)', () => {
    expect(jobActions('Open')).toEqual(['hold', 'close']);
    expect(jobActions('Partially Filled')).toEqual(['hold', 'close']);
    expect(jobActions('On Hold')).toEqual(['reopen', 'close']);
    expect(jobActions('Filled')).toEqual(['close']);
    expect(jobActions('Closed')).toEqual([]);
  });
});

describe('error codes reach the client (no message matching)', () => {
  const env = (status: number, code: string, message = 'server text') => new ApiError(status, message, { code, message }, { code });
  it.each([
    'REASON_REQUIRED', 'REASON_NOT_IN_LIST', 'HOLD_UNTIL_NOT_FUTURE', 'ILLEGAL_JOB_TRANSITION', 'NOT_JOB_OWNER', 'ADMIN_CANNOT_CHANGE_JOB_STATUS',
    'JOB_NOT_ACCEPTING_APPLICATIONS', 'REQUISITION_CANCELLED', 'CONTACT_REQUIRED', 'GATE_SCORECARD_NOT_SUBMITTED',
  ])('%s by code', (code) => {
    expect(jobErrorFromError(env(400, code))?.code).toBe(code);
  });
  it('old messages without a code are no longer matched', () => {
    expect(jobErrorFromError(env(409, 'CONFLICT', 'Only a held job can be reopened (job is Open).'))).toBeNull();
    expect(jobErrorFromError(env(400, 'VALIDATION_ERROR', 'A reason is required to hold this job.'))).toBeNull();
  });
  it('the stage CAS conflict is detected from details.currentVersion', () => {
    const e = new ApiError(409, 'This application changed before the stage update could be saved.', { code: 'CONFLICT', details: { currentStage: 'Offer', currentVersion: 5 } }, { code: 'CONFLICT' });
    expect(isStaleStage(e)).toBe(true);
    expect(isStaleStage(env(409, 'CONFLICT'))).toBe(false);
  });
});

describe('E09 gates[] + card interview (B5)', () => {
  const byId = (id: string) => applications.data.find((a) => a.id === id) as unknown as BoardApplication;
  it('blockingGate: next gate unmet; not for Applied, not before the interview took place', () => {
    expect(blockingGate(byId('a1'))).toBeNull();
    expect(blockingGate(byId('a4'))).toBeNull();
    expect(blockingGate(byId('a5'))).toMatchObject({ gate: 'screen-note', code: 'GATE_SCREEN_NOTE_MISSING' });
    expect(blockingGate(byId('a7'))).toMatchObject({ gate: 'scorecard' });
    expect(blockingGate(byId('a8'))).toBeNull();
    expect(blockingGate(byId('a10'))).toMatchObject({ gate: 'offer-accepted' });
    expect(applications.data.filter((a) => blockingGate(a as unknown as BoardApplication))).toHaveLength(4);
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
  it('diffForLink mirrors B6: fill empty, conflicts never overwritten, skills merged', () => {
    const d = diffForLink({ currentTitle: 'HR Officer', currentCompany: '', location: null, experienceYears: 6, skills: ['HRIS'] },
      { title: 'HR Systems Analyst', currentCompany: 'Andalusia Group', location: 'Cairo', experienceYears: 6, skills: ['hris', 'SQL'] });
    expect(d.fill).toEqual({ currentCompany: 'Andalusia Group', location: 'Cairo', skills: ['HRIS', 'SQL'] });
    expect(d.filled).toEqual(['currentCompany', 'location', 'skills']);
    expect(d.conflicts).toEqual([{ field: 'currentTitle', existing: 'HR Officer', incoming: 'HR Systems Analyst' }]);
  });
  it('link: no candidate created; empty fields filled (PATCH only those), conflicts returned; CV uploaded; application added', async () => {
    api.getApi.mockResolvedValue({ id: 'c-a4', currentTitle: 'Analyst', currentCompany: null, skills: [], expectedSalary: 42000 });
    api.patchApi.mockResolvedValue({});
    api.postFormDataApi.mockResolvedValue({ id: 'd1' });
    api.postApi.mockResolvedValue({ id: 'app-new' });
    const r = await importRow('v1', file, { firstName: 'Nourhan', rawText: 'x', title: 'HR Analyst', currentCompany: 'SGH' }, { kind: 'link', candidateId: 'c-a4' });
    expect(api.postApi).not.toHaveBeenCalledWith('/candidates', expect.anything());
    expect(api.getApi).toHaveBeenCalledWith('/candidates/c-a4');
    expect(api.patchApi).toHaveBeenCalledWith('/candidates/c-a4', { currentCompany: 'SGH' });
    const fd = api.postFormDataApi.mock.calls[0][1] as FormData;
    expect(api.postFormDataApi.mock.calls[0][0]).toBe('/documents/upload');
    expect(fd.get('candidateId')).toBe('c-a4');
    expect(fd.get('documentType')).toBe('CV');
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-a4', source: 'CV import' });
    expect(r).toEqual({ candidateId: 'c-a4', applicationId: 'app-new', link: { filled: ['currentCompany'], conflicts: [{ field: 'currentTitle', existing: 'Analyst', incoming: 'HR Analyst' }], compared: true } });
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
