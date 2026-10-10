import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import * as fx from '../../api/__fixtures__/jobs';
import { canChangeJobStatus, moveCheck } from '../../api/jobs';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
const who = vi.hoisted(() => ({ user: { id: 'u-mariam', displayName: 'Mariam Farag', roles: [] as Array<{ code: string }> } }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: who.user }) }));
import { JobPipelineV2 } from '../JobPipelineV2';

let responses: Record<string, unknown> = {};
function serve(extra: Record<string, unknown> = {}) {
  responses = { '/vacancies/v1': fx.jobDetail(), '/master-data/catalog/hold-reasons': fx.holdReasons, '/master-data/catalog/close-reasons': fx.closeReasons, '/applications': fx.applications, '/vacancies/v1/status-history': fx.statusHistory, '/users/assignable': [], ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in responses) return structuredClone(responses[p]);
    throw new ApiError(404, 'not found');
  });
}
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/vacancies/:id" element={<JobPipelineV2 />} /></Routes></MemoryRouter>);
const job = fx.jobDetail() as unknown as Parameters<typeof canChangeJobStatus>[0];

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); who.user = { id: 'u-mariam', displayName: 'Mariam Farag', roles: [] }; serve(); });

describe('#23 NEW-3 JOB_NOT_OWNED: hold/reopen/close only for the owner or the owner\'s manager', () => {
  it('rule: owner yes; owner\'s line manager yes; skip-level manager, other people and admins no', () => {
    expect(canChangeJobStatus(job, { id: 'u-mariam' }, null)).toBe(true);
    expect(canChangeJobStatus(job, { id: 'u-karim' }, [{ id: 'u-mariam', displayName: 'Mariam', managerId: 'u-karim' }])).toBe(true);
    expect(canChangeJobStatus(job, { id: 'u-hala' }, [{ id: 'u-karim', displayName: 'Karim', managerId: 'u-hala' }, { id: 'u-mariam', displayName: 'Mariam', managerId: 'u-karim' }])).toBe(false);
    expect(canChangeJobStatus(job, { id: 'u-other' }, [])).toBe(false);
    expect(canChangeJobStatus(job, { id: 'u-mariam', isAdmin: true }, null)).toBe(false);
  });
  it('a skip-level manager sees the board without Hold job, and ?drawer=status opens nothing', async () => {
    who.user = { id: 'u-hala', displayName: 'Hala Mostafa', roles: [{ code: 'HIRING_MANAGER' }] };
    serve({ '/users/assignable': [{ id: 'u-karim', displayName: 'Karim', managerId: 'u-hala' }, { id: 'u-mariam', displayName: 'Mariam', managerId: 'u-karim' }] });
    renderAt('/vacancies/v1?drawer=status');
    expect(await screen.findByRole('heading', { name: /HRIS Developer/ })).toBeInTheDocument();
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/users/assignable'));
    expect(screen.queryByRole('button', { name: /Hold job|Reopen job/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('the owner\'s manager gets Hold job; a 403 JOB_NOT_OWNED still says who may do it', async () => {
    const u = userEvent.setup();
    who.user = { id: 'u-karim', displayName: 'Karim Hassan', roles: [{ code: 'HIRING_MANAGER' }] };
    serve({ '/users/assignable': [{ id: 'u-mariam', displayName: 'Mariam', managerId: 'u-karim' }] });
    api.postApi.mockRejectedValue(new ApiError(403, 'Access denied: you do not have permission to perform this action.', { statusCode: 403, code: 'JOB_NOT_OWNED', message: 'Access denied: you do not have permission to perform this action.' }, { code: 'JOB_NOT_OWNED' }));
    renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('button', { name: 'Hold job' }));
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Budget review' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Budget review');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(await within(d).findByText('Only the job owner or their manager can hold, reopen, close or delete this job.')).toBeInTheDocument();
  });
  it('400 fields from the hold endpoint land on their inputs', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValue(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'note', fields: { note: ['note must be shorter than or equal to 500 characters'] } }, { code: 'VALIDATION_ERROR', fields: { note: ['note must be shorter than or equal to 500 characters'] } }));
    renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('button', { name: 'Hold job' }));
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Budget review' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Budget review');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(await within(d).findByText('note must be shorter than or equal to 500 characters')).toBeInTheDocument();
    expect(within(d).getByLabelText(/^Note/)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('#21 FILE_CLOSED on the board', () => {
  it('a closed file never passes the move check', () => {
    expect(moveCheck({ id: 'a', stage: 'Joined', allowedTransitions: ['Rejected'] } as never, 'Pre-Hire', job).ok).toBe(false);
  });
});

describe('#23 CANDIDATE_EXISTS on import', () => {
  it('turns the row into a link to the existing person (found again via duplicate check when details are stripped)', async () => {
    const u = userEvent.setup({ applyAccept: false });
    let checks = 0;
    api.postFormDataApi.mockImplementation(async (p: string) => (p === '/resume/parse' ? fx.parsed : { id: 'doc1' }));
    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/candidates/duplicate-check') { checks += 1; return checks === 1 ? fx.noDup : fx.dup; }
      if (p === '/candidates') throw new ApiError(409, 'A candidate with the same email or phone already exists in your organization. Link that person instead.', { statusCode: 409, code: 'CANDIDATE_EXISTS', message: 'A candidate with the same email or phone already exists in your organization. Link that person instead.' }, { code: 'CANDIDATE_EXISTS' });
      return { id: 'app-new' };
    });
    renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog', { name: 'Add candidates to Applied' });
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [new File(['%PDF'], 'rania.pdf', { type: 'application/pdf' })]);
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    const note = await within(d).findByTestId('candidate-exists');
    expect(note).toHaveTextContent(/Already in the bank as Nourhan Sami \(CAN-2026-0007\)/);
    expect(within(note).getByRole('link', { name: 'the existing person' })).toHaveAttribute('href', '/candidates/c-a4');
    expect(within(d).getByRole('radio', { name: /Link to Nourhan Sami/ })).toBeChecked();
  });
});

describe('B2R: APPLICATION_EXISTS, admin status, open-files 409, job list paging', () => {
  it('409 APPLICATION_EXISTS on import links to the existing file instead of failing', async () => {
    const u = userEvent.setup({ applyAccept: false });
    serve({ '/applications': { data: [{ id: 'app-old', candidateId: 'c-new', vacancyId: 'v1' }], total: 1 } });
    api.postFormDataApi.mockImplementation(async (p: string) => (p === '/resume/parse' ? fx.parsed : { id: 'doc1' }));
    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/candidates/duplicate-check') return fx.noDup;
      if (p === '/candidates') return { id: 'c-new' };
      if (p === '/applications') throw new ApiError(409, 'Already applied.', { statusCode: 409, code: 'APPLICATION_EXISTS', message: 'Already applied.' }, { code: 'APPLICATION_EXISTS' });
      return {};
    });
    renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog', { name: 'Add candidates to Applied' });
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [new File(['%PDF'], 'rania.pdf', { type: 'application/pdf' })]);
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    const note = await within(d).findByTestId('application-exists');
    expect(within(note).getByRole('link', { name: 'Open the existing file' })).toHaveAttribute('href', '/applications/app-old');
    expect(api.getApi).toHaveBeenCalledWith(expect.stringMatching(/^\/applications\?vacancyId=v1&candidateId=c-new/));
  });
  it('error texts for ADMIN_CANNOT_CHANGE_JOB_STATUS and JOB_HAS_OPEN_APPLICATIONS', async () => {
    const { errorMessage, ADMIN_STATUS_TEXT } = await import('../../api/jobs');
    expect(errorMessage(new ApiError(403, 'x', { statusCode: 403, code: 'ADMIN_CANNOT_CHANGE_JOB_STATUS' }, { code: 'ADMIN_CANNOT_CHANGE_JOB_STATUS' }), 'f')).toBe(ADMIN_STATUS_TEXT);
    const e = Object.assign(new ApiError(409, 'x', { statusCode: 409, code: 'JOB_HAS_OPEN_APPLICATIONS', counts: { openApplications: 4 } }, { code: 'JOB_HAS_OPEN_APPLICATIONS' }), { counts: { openApplications: 4 } });
    expect(errorMessage(e, 'f')).toBe('This job still has 4 open files. Close or move them first.');
  });
  it('an admin sees no status actions and is pointed to the override', async () => {
    who.user = { id: 'u-admin', displayName: 'Admin', roles: [{ code: 'ADMINISTRATOR' }] };
    renderAt('/vacancies/v1');
    expect(await screen.findByTestId('admin-status-note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hold job|Reopen job/ })).toBeNull();
  });
  it('open jobs page through the work queue at pageSize 100', async () => {
    const { fetchOpenJobs } = await import('../../api/jobs');
    const row = (i: number) => ({ id: `j${i}`, code: `J${i}`, title: `Job ${i}`, status: 'Active', pipelineCounts: {}, headcount: { joined: 0, approved: 1 } });
    api.getApi.mockImplementation(async (path: string) => {
      const q = new URLSearchParams(path.split('?')[1]);
      expect(Number(q.get('pageSize'))).toBeLessThanOrEqual(100);
      if (q.get('mine') === 'true') return { data: q.get('page') === '1' ? Array.from({ length: 100 }, (_, i) => row(i)) : [row(100)], total: 101 };
      return { data: [], total: 0 };
    });
    const r = await fetchOpenJobs();
    expect(r.mine).toHaveLength(101);
  });
});
