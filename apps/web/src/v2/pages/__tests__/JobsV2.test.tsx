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
  responses = { '/vacancies/work-queue': fx.workQueue, '/vacancies/work-queue?mine=true': fx.workQueueMine, '/vacancies/v1': fx.jobDetail(),
    '/master-data/catalog/hold-reasons': fx.holdReasons, '/master-data/catalog/close-reasons': fx.closeReasons, '/vacancies/r1': fx.redactedJob, '/applications': fx.applications, '/vacancies/v1/status-history': fx.statusHistory, ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.includes('mine=true') ? `${path.split('?')[0]}?mine=true` : path.split('?')[0];
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
    // #23 603d44d: an unredacted row (a report's job the manager may see) links to its board; redacted ones stay read-only.
    expect(within(others).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/vacancies/v9']);
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
    serve({ '/vacancies/work-queue?mine=true': new ApiError(500, 'boom') });
    const { unmount } = renderAt('/vacancies');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your jobs');
    unmount();
    serve({ '/vacancies/work-queue?mine=true': new ApiError(403, 'no') });
    renderAt('/vacancies');
    expect(await screen.findByText('You do not have access to this')).toBeInTheDocument();
  });
});

describe('E09 Job pipeline', () => {
  it('renders 5 columns with counts, the job header, and Joined/Rejected under the board; cards open E13; no pay; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/vacancies/v1');
    expect(await screen.findByRole('heading', { level: 1, name: /HRIS Developer/ })).toBeInTheDocument();
    const board = screen.getByRole('region', { name: 'HRIS Developer pipeline' });
    expect(board).toHaveAttribute('tabindex', '0');
    expect(board).toHaveAccessibleDescription(/five horizontally scrollable stages/);
    expect(screen.getByText('Scroll horizontally to explore all five stages')).toBeInTheDocument();
    const cols = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-hire'].map((n) => screen.getByRole('region', { name: new RegExp(`^${n}`) }));
    expect(cols.map((c) => within(c).queryAllByRole('article').length)).toEqual([3, 3, 3, 1, 0]);
    expect(within(cols[4]).getByText('No files in Pre-hire')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 filled')).toBeInTheDocument();
    expect(screen.getByText('19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Closed for this job · 3 rejected, 1 joined/ })).toBeInTheDocument();
    expect(within(cols[1]).getByText(/Follow-up 7 Oct 2026/)).toBeInTheDocument();
    // B5 gates[]: badge on the blocked cards + the header count; card interview (Cairo time + room).
    expect(screen.getByText('Gate blocked').nextElementSibling).toHaveTextContent('4');
    expect(screen.getAllByTestId('gate-badge').map((b) => b.textContent?.trim())).toEqual(['Screen note missing', 'Screen note missing', 'Scorecard missing', 'Offer not accepted yet']);
    const tarek = screen.getByRole('article', { name: 'Tarek Lotfy, Interview' });
    expect(tarek).toHaveTextContent('Interview 12 Oct, 10:00–11:00 · Room 3B, IT wing');
    expect(within(tarek).queryByTestId('gate-badge')).toBeNull();
    expect(screen.getByRole('article', { name: 'Ahmed Embaby, Interview' })).toHaveTextContent('Last interview 6 Oct, 10:00–11:00 · room link');
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
  it('gate 409 {code, gate, missing[]} → toast naming the missing gate; the card stays', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'Offer needs a submitted interview scorecard.', { code: 'GATE_SCORECARD_NOT_SUBMITTED', gate: 'scorecard', missing: ['submitted scorecard'] }, { code: 'GATE_SCORECARD_NOT_SUBMITTED' }));
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
    api.patchApi.mockRejectedValue(new ApiError(409, 'This application changed before the stage update could be saved.', { code: 'CONFLICT', details: { currentStage: 'Offer', currentVersion: 4 } }, { code: 'CONFLICT' }));
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
    expect(screen.getByText(/new applications are paused/)).toBeInTheDocument();
    expect(screen.getByText(/stay on My Work/)).toBeInTheDocument();
  });
});

describe('E12 Hold / Reopen / Close (B3 reason lists + holdUntil)', () => {
  it('hold: one primary; reasons from hold-reasons (active only); reason required; holdUntil; posts; reloads; history', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue(fx.jobDetail('On Hold'));
    renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('button', { name: 'Hold job' }));
    const d = await screen.findByRole('dialog', { name: 'Hold or close this job' });
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies/v1?drawer=status');
    expect(d.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    expect(await within(d).findByText(/Open → Partially Filled/)).toBeInTheDocument();
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Budget review' })).toBeInTheDocument());
    expect(api.getApi).toHaveBeenCalledWith('/master-data/catalog/hold-reasons');
    expect(within(d).queryByRole('option', { name: 'Manager on leave' })).toBeNull();
    expect(within(d).queryByRole('option', { name: 'Position no longer needed' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(within(d).getByText('Pick a reason from the list.')).toBeInTheDocument();
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Budget review');
    await u.type(within(d).getByLabelText(/^Hold until/), '2020-01-01');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(within(d).getByText('Pick a day after today (Cairo).')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.clear(within(d).getByLabelText(/^Hold until/));
    await u.type(within(d).getByLabelText(/^Hold until/), '2031-02-01');
    await u.type(within(d).getByLabelText(/^Note/), 'Back after the Q4 review');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', { reason: 'Budget review', note: 'Back after the Q4 review', holdUntil: '2031-02-01' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await axeViolations(document.body)).toEqual([]);
  });
  it('"Other" requires a note; REASON_NOT_IN_LIST / HOLD_UNTIL_NOT_FUTURE from the server land on the right field by code', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Other' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Other');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(within(d).getByText('"Other" needs a short note.')).toBeInTheDocument();
    api.postApi.mockRejectedValueOnce(new ApiError(400, '"Other" is not an active hold reason. Pick one from the list, or "Other" with a note.', { code: 'REASON_NOT_IN_LIST' }, { code: 'REASON_NOT_IN_LIST' }));
    await u.type(within(d).getByLabelText(/^Note/), 'Clinic renovation');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', { reason: 'Other', note: 'Clinic renovation' });
    expect(await within(d).findByText(/is not an active hold reason/)).toBeInTheDocument();
    await waitFor(() => expect(api.getApi.mock.calls.filter(([p]) => p === '/master-data/catalog/hold-reasons').length).toBeGreaterThan(1));
    api.postApi.mockRejectedValueOnce(new ApiError(400, 'holdUntil must be a future date.', { code: 'HOLD_UNTIL_NOT_FUTURE' }, { code: 'HOLD_UNTIL_NOT_FUTURE' }));
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Hiring freeze');
    await u.click(within(d).getByRole('button', { name: 'Put on hold' }));
    expect(await within(d).findByText('Pick a day after today (Cairo).')).toBeInTheDocument();
  });
  it('no active reasons → says so (no client presets)', async () => {
    serve({ '/master-data/catalog/hold-reasons': [{ name: 'Old', status: 'Inactive' }] });
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByText(/No hold reasons are set up/)).toBeInTheDocument();
    expect(within(d).queryByRole('option', { name: 'Budget review' })).toBeNull();
  });
  it('reopen from On Hold: free-text reason (server message inline); Close uses close-reasons and needs click + confirm', async () => {
    const u = userEvent.setup();
    serve({ '/vacancies/v1': { ...fx.jobDetail('On Hold'), holdUntil: '2026-11-01' } });
    api.postApi.mockRejectedValueOnce(new ApiError(403, 'Only the job owner or their manager can hold, reopen or close this job.', { code: 'NOT_JOB_OWNER' }, { code: 'NOT_JOB_OWNER' }));
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog', { name: 'Reopen or close this job' });
    expect(d).toHaveTextContent('On hold until 1 Nov 2026.');
    expect(within(d).queryByLabelText(/^Hold until/)).toBeNull();
    await u.type(within(d).getByLabelText(/^Reason/), 'Hiring manager back');
    await u.click(within(d).getByRole('button', { name: 'Reopen job' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Only the job owner or their manager can hold, reopen or close this job.');
    expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/reopen', { reason: 'Hiring manager back' });
    api.postApi.mockResolvedValue(fx.jobDetail('Closed'));
    await u.click(within(d).getByRole('radio', { name: 'Close job' }));
    expect(d.querySelectorAll('.rf2-btn--primary')).toHaveLength(0);
    await waitFor(() => expect(within(d).getByRole('option', { name: 'Position no longer needed' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Reason/), 'Position no longer needed');
    const close = within(d).getByRole('button', { name: 'Close job' });
    expect(close).toHaveAttribute('data-kind', 'danger-outline');
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
  it('after linking: empty fields are filled, conflicts are listed (never overwritten) and the drawer stays open to read them', async () => {
    const u = userEvent.setup();
    serve({ '/candidates/c-a4': { id: 'c-a4', firstName: 'Nourhan', currentTitle: 'HR Officer', currentCompany: null, location: 'Giza', skills: ['HRIS'], expectedSalary: 42000 } });
    api.postFormDataApi.mockImplementation(async (p: string) => (p === '/resume/parse' ? { ...fx.parsedDup, title: 'HR Systems Analyst', currentCompany: 'Andalusia Group', location: 'Cairo', skills: ['HRIS', 'SQL'] } : { id: 'doc1' }));
    api.postApi.mockImplementation(async (p: string) => (p === '/candidates/duplicate-check' ? fx.dup : { id: 'app-new' }));
    api.patchApi.mockResolvedValue({});
    renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog');
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [pdf('nourhan-sami.pdf')]);
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    const box = await within(d).findByRole('group', { name: 'Not overwritten for nourhan-sami.pdf' });
    expect(box).toHaveTextContent('Current title: bank “HR Officer” · CV “HR Systems Analyst”');
    expect(box).toHaveTextContent('Location: bank “Giza” · CV “Cairo”');
    expect(within(d).getByText(/Filled from the CV: Current company, Skills\./)).toBeInTheDocument();
    expect(api.patchApi).toHaveBeenCalledWith('/candidates/c-a4', { currentCompany: 'Andalusia Group', skills: ['HRIS', 'SQL'] });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(d.textContent).not.toMatch(PAY);
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
