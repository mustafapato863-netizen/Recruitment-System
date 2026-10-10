import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../../api/__fixtures__/jobs';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: fx.ME, displayName: 'Mariam Farag' } }) }));
import { OpenJobsV2 } from '../OpenJobsV2';
import { JobPipelineV2 } from '../JobPipelineV2';

let responses: Record<string, unknown> = {};
function serve(extra: Record<string, unknown> = {}) {
  responses = { '/vacancies/work-queue': fx.workQueue, '/vacancies': fx.vacancyList, '/vacancies/v1': fx.jobDetail(), '/vacancies/r1': fx.redactedJob, '/applications': fx.applications, '/vacancies/v1/status-history': fx.statusHistory, ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'not found');
  });
}
function Loc() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }
const renderAt = (path: string) => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/vacancies" element={<><OpenJobsV2 /><Loc /></>} />
    <Route path="/vacancies/:id" element={<><JobPipelineV2 /><Loc /></>} />
    <Route path="/applications/:id" element={<><p>E13 file</p><Loc /></>} />
  </Routes></MemoryRouter>);
};
const PAY = /42000|42,000|99000|30000|EGP|AED|salary|budget|compensation/i;

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); serve(); });
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('E08 Open jobs', () => {
  it('lists my open jobs with seats, due date, stage counts and status; others read-only; no pay; axe clean', async () => {
    const { container } = renderAt('/vacancies');
    const table = await screen.findByRole('table', { name: '' }).catch(() => screen.getAllByRole('table')[0]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(/HRIS Developer.*IT · Owner: Mariam Farag.*Offshore Cairo.*1 of 3.*19 Oct 2026.*10 active.*Open/);
    expect(screen.getByText('4 jobs · On hold and Closed hidden')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Open pipeline/ })[0]).toHaveAttribute('href', '/vacancies/v1');
    const others = screen.getByRole('region', { name: 'Other recruiters’ jobs in your team' });
    expect(within(others).getAllByRole('row')).toHaveLength(4);
    expect(within(others).queryAllByRole('link')).toHaveLength(0);
    expect(within(others).queryAllByRole('button')).toHaveLength(0);
    expect(within(others).getByText('Pharmacist')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PAY);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('filters by status, site and search', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies');
    await screen.findByText('HRIS Developer');
    await u.selectOptions(screen.getByLabelText('Status'), 'hold');
    expect(screen.getByText('Medical Coder')).toBeInTheDocument();
    expect(screen.queryByText('HRIS Developer')).not.toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Status'), 'open');
    await u.selectOptions(screen.getByLabelText('Site'), 'SGH Jeddah');
    expect(screen.getByText('1 job · On hold and Closed hidden')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Site'), '');
    await u.type(screen.getByLabelText('Search my jobs'), 'laravel');
    expect(screen.getByText('Laravel Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText('HRIS Developer')).not.toBeInTheDocument();
  });
  it('error → retry; 403 → Forbidden', async () => {
    serve({ '/vacancies/work-queue': new ApiError(500, 'boom') });
    const { unmount } = renderAt('/vacancies');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your jobs');
    unmount();
    serve({ '/vacancies/work-queue': new ApiError(403, 'no') });
    renderAt('/vacancies');
    expect(await screen.findByText('You do not have access to this')).toBeInTheDocument();
  });
});

describe('E09 Job pipeline', () => {
  it('renders 5 columns with counts, the job header, and Joined/Rejected under the board; cards open E13; no pay; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/vacancies/v1');
    expect(await screen.findByRole('heading', { level: 1, name: /HRIS Developer/ })).toBeInTheDocument();
    const cols = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-hire'].map((n) => screen.getByRole('region', { name: new RegExp(`^${n}`) }));
    expect(cols.map((c) => within(c).queryAllByRole('article').length)).toEqual([3, 3, 3, 1, 0]);
    expect(within(cols[4]).getByText('No files in Pre-hire')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 filled')).toBeInTheDocument();
    expect(screen.getByText('19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Closed for this job · 3 rejected, 1 joined/ })).toBeInTheDocument();
    expect(within(cols[1]).getByText(/Follow-up due 7 Oct 2026/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PAY);
    expect(await axeViolations(container)).toEqual([]);
    await u.click(screen.getByRole('link', { name: 'Ahmed Embaby' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a7');
  });
  it('keyboard "Move to…": allowed next stage moves (PATCH with expectedStage/version)', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ version: 4 });
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Hany Fawzy, Applied' });
    await u.click(within(card).getByRole('button', { name: /Move to…/ }));
    const menu = within(card).getByRole('menu', { name: 'Move Hany Fawzy to' });
    expect(within(menu).getByRole('menuitem', { name: /^Screening/ })).toHaveFocus();
    expect(within(menu).getByRole('menuitem', { name: /^Interview/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: /^Interview/ })).toHaveTextContent('one stage at a time; Screening comes first');
    await u.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Screening', expectedStage: 'Applied', expectedVersion: 3 }));
    expect(await screen.findByText('Hany Fawzy moved to Screening')).toBeInTheDocument();
  });
  it('disabled targets do nothing; Escape closes the menu and returns focus', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Hany Fawzy, Applied' });
    const btn = within(card).getByRole('button', { name: /Move to…/ });
    await u.click(btn);
    await u.click(within(card).getByRole('menuitem', { name: /^Offer/ }));
    expect(api.patchApi).not.toHaveBeenCalled();
    await u.keyboard('{Escape}');
    expect(within(card).queryByRole('menu')).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });
  it('gate 409 (generic CONFLICT envelope) → toast naming the missing gate; the card stays', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'Offer needs a submitted interview scorecard.', undefined, { code: 'CONFLICT' }));
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Ahmed Embaby, Interview' });
    await u.click(within(card).getByRole('button', { name: /Move to…/ }));
    expect(within(card).getByRole('menuitem', { name: /^Offer/ })).toHaveTextContent('Needs a submitted scorecard');
    await u.click(within(card).getByRole('menuitem', { name: /^Offer/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't move Ahmed Embaby to Offer");
    expect(alert).toHaveTextContent('Missing gate: scorecard. Ahmed stays in Interview.');
    expect(screen.getByRole('article', { name: 'Ahmed Embaby, Interview' })).toBeInTheDocument();
  });
  it('stale version → refreshes the board', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'This application changed before the stage update could be saved.', undefined, { code: 'CONFLICT' }));
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Lina Hassan, Offer' });
    const before = api.getApi.mock.calls.length;
    await u.click(within(card).getByRole('button', { name: /Move to…/ }));
    await u.click(within(card).getByRole('menuitem', { name: /Pre-hire/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone changed this file first');
    await waitFor(() => expect(api.getApi.mock.calls.length).toBeGreaterThan(before));
  });
  it('redacted job (B1) → read-only forbidden state with title/site/seats, no board', async () => {
    renderAt('/vacancies/r1');
    expect(await screen.findByRole('heading', { name: 'Pharmacist is owned by another recruiter' })).toBeInTheDocument();
    expect(screen.getByText(/SGH Jeddah · 1 of 4 seats/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import CVs' })).not.toBeInTheDocument();
    expect(api.getApi).not.toHaveBeenCalledWith(expect.stringContaining('/applications'));
  });
  it('403 / 404 states', async () => {
    serve({ '/vacancies/v1': new ApiError(403, 'Only the job owner can open this.') });
    const { unmount } = renderAt('/vacancies/v1');
    expect(await screen.findByText('Only the job owner can open this.')).toBeInTheDocument();
    unmount();
    renderAt('/vacancies/nope');
    expect(await screen.findByText('Job not found')).toBeInTheDocument();
  });
  it('held job: Reopen in the header, Import CVs disabled with the reason, cards still movable', async () => {
    serve({ '/vacancies/v1': fx.jobDetail('On Hold') });
    renderAt('/vacancies/v1');
    expect(await screen.findByRole('button', { name: 'Reopen job' })).toBeInTheDocument();
    const imp = screen.getByRole('button', { name: 'Import CVs' });
    expect(imp).toBeDisabled();
    expect(imp).toHaveAccessibleDescription('A held job takes no new applications.');
    expect(screen.getByText(/takes no new applications and is off My Work/)).toBeInTheDocument();
  });
});

describe('E12 Hold / Reopen / Close (B3)', () => {
  it('hold is the one primary; reason required; posts; reloads; shows history; client presets when master data is absent', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue(fx.jobDetail('On Hold'));
    renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('button', { name: 'Hold job' }));
    const d = await screen.findByRole('dialog', { name: 'Hold or close this job' });
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies/v1?drawer=status');
    expect(d.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    expect(within(d).getByRole('button', { name: 'Close job' })).toHaveAttribute('data-kind', 'danger-outline');
    expect(await within(d).findByText(/Open → Partially Filled/)).toBeInTheDocument();
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Budget review' })).toBeInTheDocument());
    expect(api.getApi).toHaveBeenCalledWith('/master-data/catalog/job-hold-reasons');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(within(d).getByText('A reason is required (at least 3 characters).')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Budget review');
    await u.type(within(d).getByLabelText(/Note for the job history/), 'Back after the Q4 review');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', { reason: 'Budget review — Back after the Q4 review' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await axeViolations(document.body)).toEqual([]);
  });
  it('uses master-data reasons when Backend adds the category', async () => {
    serve({ '/master-data/catalog/job-hold-reasons': [{ name: 'Hiring freeze', status: 'Active' }, { name: 'Old', status: 'Inactive' }] });
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByRole('option', { name: 'Hiring freeze' })).toBeInTheDocument();
    expect(within(d).queryByRole('option', { name: 'Old' })).not.toBeInTheDocument();
    expect(within(d).queryByRole('option', { name: 'Budget review' })).not.toBeInTheDocument();
    expect(within(d).getByRole('option', { name: 'Position no longer needed' })).toBeInTheDocument();
  });
  it('reopen from On Hold (server message inline); Close needs click + confirm (danger-outline → danger)', async () => {
    const u = userEvent.setup();
    serve({ '/vacancies/v1': fx.jobDetail('On Hold') });
    api.postApi.mockRejectedValueOnce(new ApiError(403, 'Only the job owner or their manager can hold, reopen or close this job.', undefined, { code: 'FORBIDDEN' }));
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog', { name: 'Reopen this job' });
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Hiring manager back' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Hiring manager back');
    await u.click(within(d).getByRole('button', { name: 'Reopen job' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Only the job owner or their manager can hold, reopen or close this job.');
    expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/reopen', { reason: 'Hiring manager back' });
    api.postApi.mockResolvedValue(fx.jobDetail('Closed'));
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Position no longer needed');
    const close = within(d).getByRole('button', { name: 'Close job' });
    await u.click(close);
    expect(api.postApi).toHaveBeenCalledTimes(1);
    expect(close).toHaveTextContent('Confirm close — final');
    expect(close).toHaveAttribute('data-kind', 'danger');
    await u.click(close);
    await waitFor(() => expect(api.postApi).toHaveBeenLastCalledWith('/vacancies/v1/close', { reason: 'Position no longer needed' }));
  });
  it('closed job: no actions offered', async () => {
    serve({ '/vacancies/v1': fx.jobDetail('Closed') });
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText(/closed job is final and cannot be reopened/)).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Close job' })).not.toBeInTheDocument();
    expect(d.querySelectorAll('.rf2-btn--primary')).toHaveLength(0);
  });
});

describe('E11 Import CVs (resume parse + B6 duplicate check)', () => {
  const pdf = (n: string) => new File(['%PDF-1.4'], n, { type: 'application/pdf' });
  it('parses, shows the duplicate evidence (no %), links the existing person, creates the new one, adds both to Applied', async () => {
    const u = userEvent.setup({ applyAccept: false });
    api.postFormDataApi.mockImplementation(async (p: string, fd: FormData) => {
      if (p === '/resume/parse') return (fd.get('file') as File).name.startsWith('nourhan') ? fx.parsedDup : fx.parsed;
      return { id: 'doc1' };
    });
    api.postApi.mockImplementation(async (p: string, body: { email?: string }) => {
      if (p === '/candidates/duplicate-check') return body.email?.startsWith('nourhan') ? fx.dup : fx.noDup;
      if (p === '/candidates') return { id: 'c-new' };
      return { id: 'app-new' };
    });
    const { baseElement } = renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog', { name: 'Add candidates to Applied' });
    expect(within(d).getByRole('button', { name: 'Import 0 to Applied' })).toBeDisabled();
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [pdf('rania-kamel-cv.pdf'), pdf('nourhan-sami-2026.pdf'), new File(['x'], 'all.zip')]);
    const rows = await within(d).findAllByRole('listitem');
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 2 to Applied' })).toBeEnabled());
    expect(rows[0]).toHaveTextContent(/Parsed.*Rania Kamel.*HR Systems Analyst, Andalusia Group/);
    expect(rows[1]).toHaveTextContent('Duplicate');
    const dupBox = within(rows[1]).getByRole('group');
    expect(dupBox).toHaveTextContent('linked to the existing person, not copied');
    expect(within(dupBox).getByRole('radio', { name: /Link to Nourhan Sami \(CAN-2026-0007\)/ })).toBeChecked();
    expect(dupBox).toHaveTextContent('Evidence: same email (nourhan.sami@gmail.com)');
    expect(d.textContent).not.toMatch(/\d\s?%/);
    expect(rows[2]).toHaveTextContent(/Not accepted.*ZIP is not supported/);
    expect(api.postApi).toHaveBeenCalledWith('/candidates/duplicate-check', { email: 'Rania.Kamel@Gmail.com', phone: '+20 100 555 0192' });
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Import 2 to Applied' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.postApi).toHaveBeenCalledTimes(5); // 2 checks + 1 create + 2 applications
    expect(api.postApi).toHaveBeenCalledWith('/candidates', expect.objectContaining({ firstName: 'Rania', lastName: 'Kamel', source: 'CV import' }));
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-new', source: 'CV import' });
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-a4', source: 'CV import' });
  });
  it('unreadable CV and a failed add (already applied) are reported per row', async () => {
    const u = userEvent.setup();
    api.postFormDataApi.mockImplementation(async (p: string, fd: FormData) => {
      if (p === '/resume/parse') return (fd.get('file') as File).name.startsWith('scan') ? {} : fx.parsedDup;
      return { id: 'doc1' };
    });
    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/candidates/duplicate-check') return fx.dup;
      throw new ApiError(409, 'Candidate Nourhan Sami has already applied to vacancy VAC-2026-0041.', undefined, { code: 'CONFLICT' });
    });
    renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog');
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [pdf('scan_0042.pdf'), pdf('nourhan-sami.pdf')]);
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    expect(within(d).getAllByRole('listitem')[0]).toHaveTextContent(/Unreadable.*No readable text/);
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('has already applied to vacancy');
    expect(within(d).getByRole('status')).toHaveTextContent('0 added to Applied · 1 failed.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
