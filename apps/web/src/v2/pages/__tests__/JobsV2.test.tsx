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
import { readPipelineSourceSet } from '../../api/jobs';

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

describe('Open jobs desk', () => {
  it('counts my open jobs separately and keeps zero instead of a demo fallback', async () => {
    const { unmount } = renderAt('/vacancies');
    const overview = await screen.findByLabelText('Jobs overview');
    expect(within(overview).getByText('My open jobs').parentElement).toHaveTextContent('My open jobs4');
    expect(within(overview).getByText('Active applications').parentElement).toHaveTextContent('Active applications43');
    expect(within(overview).getByText('In interview').parentElement).toHaveTextContent('In interview10');
    expect(within(overview).getByText('In offer').parentElement).toHaveTextContent('In offer4');
    unmount();
    serve({ '/vacancies/work-queue?mine=true': { data: [], total: 0, page: 1, pageSize: 100 } });
    renderAt('/vacancies');
    const empty = await screen.findByLabelText('Jobs overview');
    expect(within(empty).getByText('My open jobs').parentElement).toHaveTextContent('My open jobs0');
  });
  it('shows a shared job with its real status and count without adding it to my jobs', async () => {
    const shared = structuredClone(fx.workQueue);
    const row = shared.data.find(item => item.id === 'v9');
    if (!row || !('pipelineCounts' in row)) throw new Error('Expected full shared job');
    row.status = 'On Hold';
    row.pipelineCounts = { Applied: 7, Screening: 0, Interview: 0, Offer: 0, 'Pre-Hire': 0, Joined: 3, Rejected: 8, Withdrawn: 0 };
    row.dueDate = '2026-11-22';
    serve({ '/vacancies/work-queue': shared });
    renderAt('/vacancies');
    const others = await screen.findByRole('region', { name: 'Other jobs' });
    const card = within(others).getByText('BI Data Analyst').closest('article')!;
    expect(card).toHaveTextContent('On hold');
    expect(card).toHaveTextContent(/7\s*Applicants/);
    expect(card).toHaveTextContent('22 Nov 2026');
    expect(card).toHaveTextContent('IT');
    expect(card).not.toHaveTextContent('Created');
    expect(within(card).getByRole('link', { name: 'Open pipeline: BI Data Analyst' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Jobs overview')).getByText('My open jobs').parentElement).toHaveTextContent('My open jobs4');
  });
  it('keeps the header as the only Open jobs name', async () => {
    renderAt('/vacancies');
    const search = await screen.findByLabelText('Search my jobs');
    expect(screen.queryByText('Jobs assigned to you.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Open jobs' })).not.toBeInTheDocument();
    expect(search).toBeInTheDocument();
  });
});

describe('E08 Open jobs', () => {
  it('defaults to job cards with seats, due date, stage counts and status; others read-only; no pay; axe clean', async () => {
    const { container } = renderAt('/vacancies');
    const cards = within(await screen.findByRole('list', { name: 'My jobs' })).getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent(/VAC-v1.*IT.*Open.*HRIS Developer.*Offshore Cairo.*Due 19 Oct 2026.*Applicants.*10 active.*Mariam Farag.*Headcount filled.*1 \/ 3/);
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/On hold and Closed hidden/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jobs owned by your reports/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Files on these jobs/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Other recruiters' jobs" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: /^Open pipeline/ })).toHaveAttribute('href', '/vacancies/v1');
    expect(screen.queryByRole('table', { name: 'My jobs' })).not.toBeInTheDocument();
    const others = screen.getByRole('region', { name: 'Other jobs' });
    expect(within(others).getAllByRole('article')).toHaveLength(3);
    expect(within(others).getByText('Pharmacist').closest('article')).toHaveTextContent(/Read-only/);
    expect(within(others).getByRole('link', { name: 'Open pipeline: BI Data Analyst' })).toHaveAttribute('href', '/vacancies/v9');
    // #23 603d44d: an unredacted row (a report's job the manager may see) links to its board; redacted ones stay read-only.
    expect(within(others).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/vacancies/v9']);
    expect(within(others).queryAllByRole('button')).toHaveLength(0);
    expect(within(others).getByText('Pharmacist')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PAY);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('keeps the same jobs in the list', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies');
    await screen.findByRole('list', { name: 'My jobs' });
    await u.click(screen.getByRole('button', { name: 'List' }));
    const table = await screen.findByRole('table', { name: 'My jobs' });
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies?view=list');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(/HRIS Developer.*IT · Owner: Mariam Farag.*Offshore Cairo.*1 of 3.*19 Oct 2026.*10 active.*Applied 3.*Screening 3.*Interview 3.*Offer 1.*Open/);
    expect(rows.find((row) => /Patient Relations Officer/.test(row.textContent ?? ''))).toHaveTextContent(/Patient Experience · Owner: Mariam Farag/);
    expect(within(table).getAllByRole('link', { name: /^Open pipeline/ })[0]).toHaveAttribute('href', `/vacancies/v1?returnTo=${encodeURIComponent('/vacancies?view=list')}`);
    expect(screen.queryByRole('list', { name: 'My jobs' })).not.toBeInTheDocument();
    const others = screen.getByRole('region', { name: "Other recruiters' jobs in your team" });
    expect(within(others).getByText('Title, site and seats only. Other teams are not shown.')).toBeInTheDocument();
    expect(within(others).getByText("Files on these jobs are visible only to their owner and the owner's manager.")).toBeInTheDocument();
    expect(within(others).getAllByRole('row')).toHaveLength(4);
    const pharmacist = within(others).getByText('Pharmacist').closest('tr');
    expect(pharmacist).toHaveTextContent(/Read-only/);
    expect(pharmacist).toHaveTextContent(/SGH Jeddah/);
    expect(pharmacist).not.toHaveTextContent(/1 of 4/);
    expect(within(others).queryByRole('link', { name: 'Pharmacist' })).not.toBeInTheDocument();
    const analyst = within(others).getByRole('link', { name: 'BI Data Analyst' });
    expect(analyst).toHaveAttribute('href', `/vacancies/v9?returnTo=${encodeURIComponent('/vacancies?view=list')}`);
    expect(analyst.closest('tr')).toHaveTextContent(/0 of 1/);
    expect(within(others).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([`/vacancies/v9?returnTo=${encodeURIComponent('/vacancies?view=list')}`]);
    await u.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByRole('list', { name: 'My jobs' })).toBeInTheDocument();
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies');
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
    expect(screen.getByText('Patient Relations Officer')).toBeInTheDocument();
    expect(screen.queryByText('HRIS Developer')).not.toBeInTheDocument();
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
  it('separates a missing owner, a redacted teammate, and a team list that failed to load', async () => {
    const u = userEvent.setup();
    const { unmount } = renderAt('/vacancies?view=list');
    const others = await screen.findByRole('region', { name: "Other recruiters' jobs in your team" });
    const pharmacist = within(others).getByText('Pharmacist').closest('tr');
    expect(pharmacist).toHaveTextContent(/Read-only/);
    expect(pharmacist).toHaveTextContent(/another recruiter/i);
    expect(pharmacist).not.toHaveTextContent(/No owner/);
    expect(within(others).queryByRole('link', { name: 'Pharmacist' })).not.toBeInTheDocument();
    unmount();

    const mine = structuredClone(fx.workQueueMine);
    const row = mine.data.find((job) => job.id === 'v1');
    if (!row || !('owner' in row)) throw new Error('expected owned HRIS job');
    (row as { owner: { id: string; displayName: string } | null }).owner = null;
    serve({
      '/vacancies/work-queue?mine=true': mine,
      '/vacancies/work-queue': new ApiError(500, 'Team queue down'),
    });
    renderAt('/vacancies?view=list');
    const table = await screen.findByRole('table', { name: 'My jobs' });
    expect(within(table).getByText('HRIS Developer').closest('tr')).toHaveTextContent('Owner: No owner');
    const failed = screen.getByRole('region', { name: 'Other jobs' });
    expect(failed).toHaveTextContent('Could not load team jobs');
    expect(failed).toHaveTextContent('Team queue down');
    expect(within(failed).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Pharmacist')).not.toBeInTheDocument();
    responses['/vacancies/work-queue'] = fx.workQueue;
    await u.click(within(failed).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Pharmacist')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Other jobs' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'My jobs' })).getByText('HRIS Developer').closest('tr')).toHaveTextContent('Owner: No owner');
  });
  it('keeps status and site filters in the address and returns to them from the pipeline', async () => {
    const u = userEvent.setup();
    serve({
      '/vacancies/v5': {
        ...fx.jobDetail('On Hold'),
        id: 'v5',
        position: { id: 'p5', title: 'Medical Coder' },
        branch: { id: 'b5', name: 'SGH Riyadh' },
        department: 'HIM',
      },
    });
    renderAt('/vacancies');
    await screen.findByRole('list', { name: 'My jobs' });
    await u.selectOptions(screen.getByLabelText('Site'), 'SGH Jeddah');
    expect(screen.getByTestId('loc').textContent).toMatch(/\/vacancies\?site=SGH(?:\+|%20)Jeddah/);
    expect(screen.getByText('Patient Relations Officer')).toBeInTheDocument();
    expect(screen.queryByText('HRIS Developer')).not.toBeInTheDocument();
    const siteBack = `/vacancies?${new URLSearchParams({ site: 'SGH Jeddah' }).toString()}`;
    expect(screen.getByRole('link', { name: 'Open pipeline: Patient Relations Officer' })).toHaveAttribute('href', `/vacancies/v4?returnTo=${encodeURIComponent(siteBack)}`);
    await u.selectOptions(screen.getByLabelText('Site'), '');
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies');
    await u.selectOptions(screen.getByLabelText('Status'), 'hold');
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies?status=hold');
    expect(screen.getByRole('link', { name: 'Open pipeline: Medical Coder' })).toHaveAttribute('href', `/vacancies/v5?returnTo=${encodeURIComponent('/vacancies?status=hold')}`);
    await u.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies?status=hold&view=list');
    expect(screen.getByRole('link', { name: 'Open pipeline: Medical Coder' })).toHaveAttribute('href', `/vacancies/v5?returnTo=${encodeURIComponent('/vacancies?status=hold&view=list')}`);
    await u.click(screen.getByRole('link', { name: 'Open pipeline: Medical Coder' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Medical Coder/ })).toBeInTheDocument();
    await u.click(screen.getByRole('link', { name: 'Open jobs' }));
    expect(await screen.findByLabelText('Status')).toHaveValue('hold');
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies?status=hold&view=list');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Medical Coder')).toBeInTheDocument();
    expect(screen.queryByText('HRIS Developer')).not.toBeInTheDocument();
  });
});

describe('E09 Job pipeline', () => {
  it('renders 5 columns with counts, the job header, and Joined/Rejected under the board; cards open E13; no pay; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/vacancies/v1');
    expect(await screen.findByRole('heading', { level: 1, name: /HRIS Developer/ })).toBeInTheDocument();
    const board = screen.getByRole('region', { name: 'HRIS Developer pipeline' });
    expect(board).toHaveAttribute('tabindex', '0');
    expect(board).toHaveAccessibleDescription(/five stages/);
    expect(board).not.toHaveAccessibleDescription(/scroll/i);
    expect(screen.queryByText('Scroll horizontally to explore all five stages')).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Log screen for Hany Fawzy' })).toHaveAttribute('href', '/applications/a1?drawer=screen&returnTo=%2Fvacancies%2Fv1');
    const hany = screen.getByRole('article', { name: 'Hany Fawzy, Applied' });
    expect(hany).not.toHaveAttribute('data-dragging');
    expect(hany).toHaveTextContent('Analyst');
    expect(hany).toHaveTextContent('APP-a1');
    expect(hany).toHaveTextContent('Applied 8 Oct 2026');
    expect(hany).toHaveTextContent('LinkedIn');
    expect(hany.textContent ?? '').not.toMatch(/@|\+20|salary|phone/i);
    expect(screen.getByRole('article', { name: 'Nourhan Sami, Screening' })).toHaveTextContent('Phone screening booked · 10 Oct 2026');
    expect(screen.getByRole('link', { name: 'Open scorecard for Ahmed Embaby' })).toHaveAttribute('href', '/applications/a7?drawer=scorecard&returnTo=%2Fvacancies%2Fv1');
    expect(screen.getByRole('link', { name: 'Schedule interview for Tarek Lotfy' })).toHaveAttribute('href', '/applications/a8?drawer=schedule&returnTo=%2Fvacancies%2Fv1');
    expect(screen.getByRole('link', { name: 'Draft offer for Lina Hassan' })).toHaveAttribute('href', '/applications/a10?drawer=offer&returnTo=%2Fvacancies%2Fv1');
    expect(screen.getByRole('button', { name: 'Suggest from bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import CVs' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(PAY);
    expect(await axeViolations(container)).toEqual([]);
    await u.click(screen.getByRole('link', { name: (value) => value === 'Ahmed Embaby' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a7?returnTo=%2Fvacancies%2Fv1');
    expect(screen.getByTestId('loc').textContent).not.toContain('drawer');
  });
  it('the next-action control opens the file on that drawer', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('link', { name: 'Open scorecard for Ahmed Embaby' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a7?drawer=scorecard&returnTo=%2Fvacancies%2Fv1');
  });
  it('keeps the pipeline stage query on the file link', async () => {
    renderAt('/vacancies/v1?stage=Offer');
    expect(await screen.findByRole('link', { name: 'Log screen for Hany Fawzy' })).toHaveAttribute('href', `/applications/a1?drawer=screen&returnTo=${encodeURIComponent('/vacancies/v1?stage=Offer')}`);
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
  it('a move the gate refuses does not change the stage and opens the next-action drawer', async () => {
    const u = userEvent.setup();
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Ahmed Embaby, Interview' });
    await u.click(within(card).getByRole('button', { name: /Move to…/ }));
    expect(within(card).getByRole('menuitem', { name: /^Offer/ })).toHaveTextContent('Needs a submitted scorecard');
    await u.click(within(card).getByRole('menuitem', { name: /^Offer/ }));
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a7?drawer=scorecard&returnTo=%2Fvacancies%2Fv1');
  });
  it('stale version → refreshes the board', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'This application changed before the stage update could be saved.', { code: 'CONFLICT', details: { currentStage: 'Screening', currentVersion: 4 } }, { code: 'CONFLICT' }));
    renderAt('/vacancies/v1');
    const card = await screen.findByRole('article', { name: 'Hany Fawzy, Applied' });
    const before = api.getApi.mock.calls.length;
    await u.click(within(card).getByRole('button', { name: /Move to…/ }));
    await u.click(within(card).getByRole('menuitem', { name: /^Screening/ }));
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
  it('keeps board and list on the same candidates, filters, and source set', async () => {
    const u = userEvent.setup();
    sessionStorage.clear();
    renderAt('/vacancies/v1');
    const board = await screen.findByRole('region', { name: 'HRIS Developer pipeline' });
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies/v1');
    const actionPath = (href: string | null) => {
      const [path, query = ''] = (href ?? '').split('?');
      const next = new URLSearchParams(query);
      next.delete('returnTo');
      const rest = next.toString();
      return rest ? `${path}?${rest}` : path;
    };
    const boardCards = within(board).getAllByRole('article').map((article) => ({
      who: article.getAttribute('aria-label') ?? '',
      badge: within(article).queryByTestId('gate-badge')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      next: actionPath(within(article).queryByRole('link', { name: / for / })?.getAttribute('href') ?? null),
    }));
    expect(boardCards.some((card) => card.who === 'Hany Fawzy, Applied')).toBe(true);

    await u.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies/v1?view=list');
    expect(screen.queryByRole('region', { name: 'HRIS Developer pipeline' })).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'HRIS Developer pipeline list' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(boardCards.length);
    for (const card of boardCards) {
      const [name, stage] = card.who.split(', ');
      const row = within(table).getByRole('link', { name: (value) => value === name }).closest('tr') as HTMLElement;
      expect(row).toHaveTextContent(stage);
      if (card.badge) expect(within(row).getByTestId('gate-badge').textContent?.replace(/\s+/g, ' ').trim()).toBe(card.badge);
      else expect(within(row).queryByTestId('gate-badge')).not.toBeInTheDocument();
      const next = within(row).getByRole('link', { name: new RegExp(`for ${name}`) });
      expect(actionPath(next.getAttribute('href'))).toBe(card.next);
      expect(decodeURIComponent(next.getAttribute('href') ?? '')).toContain('/vacancies/v1?view=list');
    }

    await u.click(screen.getByRole('button', { name: 'Board' }));
    await u.type(screen.getByLabelText('Search candidates'), 'Hany');
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies/v1?q=Hany');
    expect(screen.getByRole('article', { name: 'Hany Fawzy, Applied' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Ahmed Embaby, Interview' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'List' }));
    const searched = screen.getByRole('table', { name: 'HRIS Developer pipeline list' });
    expect(within(searched).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Log screen for Hany Fawzy' })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/vacancies/v1?q=Hany&view=list')));
    await waitFor(() => expect(readPipelineSourceSet()).toEqual({ vacancyId: 'v1', applicationIds: ['a1'], returnHref: '/vacancies/v1?q=Hany&view=list' }));

    await u.clear(screen.getByLabelText('Search candidates'));
    await u.type(screen.getByLabelText('Search candidates'), 'zzzz-none');
    expect(await screen.findByRole('heading', { name: 'No candidates match these filters' })).toBeInTheDocument();
    await waitFor(() => expect(readPipelineSourceSet()?.applicationIds).toEqual([]));
    await u.clear(screen.getByLabelText('Search candidates'));
    await u.selectOptions(screen.getByLabelText('Blocker filter'), 'blocked');
    const blockedTable = screen.getByRole('table', { name: 'HRIS Developer pipeline list' });
    expect(within(blockedTable).getByRole('link', { name: (value) => value === 'Ahmed Embaby' })).toBeInTheDocument();
    expect(within(blockedTable).queryByRole('link', { name: (value) => value === 'Tarek Lotfy' })).not.toBeInTheDocument();
    expect(within(blockedTable).queryByRole('link', { name: (value) => value === 'Hany Fawzy' })).not.toBeInTheDocument();
    const blockedRows = within(blockedTable).getAllByRole('row').slice(1);
    expect(within(blockedTable).getAllByTestId('gate-badge')).toHaveLength(blockedRows.length);
    const blockedIds = blockedRows.map((row) => {
      const link = within(row).getAllByRole('link').find((item) => !item.textContent?.includes(' for '));
      return decodeURIComponent((link?.getAttribute('href') ?? '').split('?')[0]?.split('/').pop() ?? '');
    });
    await waitFor(() => expect(readPipelineSourceSet()).toEqual({
      vacancyId: 'v1', applicationIds: blockedIds, returnHref: '/vacancies/v1?view=list&blocked=blocked',
    }));

    await u.click(screen.getByRole('button', { name: 'Board' }));
    expect(screen.getAllByTestId('gate-badge')).toHaveLength(blockedIds.length);
    expect(screen.queryByRole('article', { name: 'Tarek Lotfy, Interview' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Ahmed Embaby, Interview' })).toBeInTheDocument();
    await waitFor(() => expect(readPipelineSourceSet()).toEqual({
      vacancyId: 'v1', applicationIds: blockedIds, returnHref: '/vacancies/v1?blocked=blocked',
    }));
    await u.selectOptions(screen.getByLabelText('Blocker filter'), '');
    await u.selectOptions(screen.getByLabelText('Stage filter'), 'Offer');
    expect(screen.getByTestId('loc').textContent).toBe('/vacancies/v1?filterStage=Offer');
    expect(screen.queryByRole('link', { name: (value) => value === 'Hany Fawzy' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Lina Hassan, Offer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Draft offer for Lina Hassan' })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/vacancies/v1?filterStage=Offer')));
    await waitFor(() => expect(readPipelineSourceSet()).toEqual({
      vacancyId: 'v1', applicationIds: ['a10'], returnHref: '/vacancies/v1?filterStage=Offer',
    }));
  });
  it('moves from the list menu, and a blocked forward move opens the resolving drawer', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ version: 4 });
    sessionStorage.clear();
    renderAt('/vacancies/v1');
    await screen.findByRole('heading', { name: /HRIS Developer/ });
    await u.click(screen.getByRole('button', { name: 'List' }));
    const table = screen.getByRole('table', { name: 'HRIS Developer pipeline list' });
    const hany = within(table).getByRole('link', { name: (value) => value === 'Hany Fawzy' }).closest('tr') as HTMLElement;
    await u.click(within(hany).getByRole('button', { name: /Move to…/ }));
    const hanyMenu = within(hany).getByRole('menu', { name: 'Move Hany Fawzy to' });
    expect(within(hanyMenu).getByRole('menuitem', { name: /^Screening/ })).toHaveFocus();
    await u.keyboard('{Enter}');
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Screening', expectedStage: 'Applied', expectedVersion: 3 }));
    expect(await screen.findByText('Hany Fawzy moved to Screening')).toBeInTheDocument();

    const ahmed = within(screen.getByRole('table', { name: 'HRIS Developer pipeline list' })).getByRole('link', { name: (value) => value === 'Ahmed Embaby' }).closest('tr') as HTMLElement;
    await u.click(within(ahmed).getByRole('button', { name: /Move to…/ }));
    const offer = within(ahmed).getByRole('menuitem', { name: /^Offer/ });
    expect(offer).toHaveTextContent('Needs a submitted scorecard');
    await u.click(offer);
    expect(api.patchApi).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loc').textContent).toContain('/applications/a7?drawer=scorecard');
    expect(decodeURIComponent(screen.getByTestId('loc').textContent ?? '')).toContain('/vacancies/v1?view=list');
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
  it('status history failure shows Retry history instead of No status changes yet', async () => {
    const u = userEvent.setup();
    serve({ '/vacancies/v1/status-history': new ApiError(503, 'History unavailable') });
    renderAt('/vacancies/v1?drawer=status');
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByText(/Could not load status history\./)).toBeInTheDocument();
    expect(within(d).queryByText('No status changes yet.')).not.toBeInTheDocument();

    serve({});
    await u.click(within(d).getByRole('button', { name: 'Retry history' }));
    expect(await within(d).findByText(/Open → Partially Filled/)).toBeInTheDocument();
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
    expect(api.postApi).toHaveBeenCalledTimes(6); // 2 checks + 1 create + 2 applications + 1 fill-from-cv
    expect(api.postApi).toHaveBeenCalledWith('/candidates', expect.objectContaining({ firstName: 'Rania', lastName: 'Kamel', source: 'CV import' }));
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-new', source: 'CV import' });
    expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-a4', source: 'CV import' });
  });
  it('after linking: empty fields are filled, conflicts are listed (never overwritten) and the drawer stays open to read them', async () => {
    const u = userEvent.setup();
    serve({ '/candidates/c-a4': { id: 'c-a4', firstName: 'Nourhan', currentTitle: 'HR Officer', currentCompany: null, location: 'Giza', skills: ['HRIS'], expectedSalary: 42000 } });
    api.postFormDataApi.mockImplementation(async (p: string) => (p === '/resume/parse' ? { ...fx.parsedDup, title: 'HR Systems Analyst', currentCompany: 'Andalusia Group', location: 'Cairo', skills: ['HRIS', 'SQL'] } : { id: 'doc1' }));
    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/candidates/duplicate-check') return fx.dup;
      if (p === '/candidates/c-a4/fill-from-cv') return { candidateId: 'c-a4', documentId: 'doc1', filled: ['currentCompany', 'skills'], conflicts: [{ field: 'currentTitle', existing: 'HR Officer', incoming: 'HR Systems Analyst' }, { field: 'location', existing: 'Giza', incoming: 'Cairo' }], compared: true };
      return { id: 'app-new' };
    });
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
    expect(api.postApi).toHaveBeenCalledWith('/candidates/c-a4/fill-from-cv', expect.objectContaining({ documentId: 'doc1', parsed: expect.objectContaining({ currentCompany: 'Andalusia Group', skills: ['HRIS', 'SQL'] }) }));
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
  it('retries a failed CV upload on the person and application already saved', async () => {
    const u = userEvent.setup({ applyAccept: false });
    let uploads = 0;
    api.postFormDataApi.mockImplementation(async (p: string) => {
      if (p === '/resume/parse') return fx.parsed;
      uploads += 1;
      if (uploads === 1) throw new ApiError(500, 'Storage unavailable.');
      return { id: 'doc1' };
    });
    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/candidates/duplicate-check') return fx.noDup;
      if (p === '/candidates') return { id: 'c-new' };
      if (p === '/applications') return { id: 'app-new' };
      return { id: 'x' };
    });
    renderAt('/vacancies/v1?drawer=import');
    const d = await screen.findByRole('dialog', { name: 'Add candidates to Applied' });
    await u.upload(within(d).getByLabelText(/Drop CVs or/), [pdf('rania-kamel-cv.pdf')]);
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    const alert = await within(d).findByRole('alert');
    expect(alert).toHaveTextContent('Added to Applied, but CV upload failed: Storage unavailable. Retry to attach the CV or open the file.');
    expect(within(d).getByRole('link', { name: 'Open the file' }).getAttribute('href')).toContain('/applications/app-new');
    expect(api.postApi.mock.calls.filter((call) => call[0] === '/candidates')).toHaveLength(1);
    expect(api.postApi.mock.calls.filter((call) => call[0] === '/applications')).toHaveLength(1);

    await u.click(within(d).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled());
    await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.postApi.mock.calls.filter((call) => call[0] === '/candidates')).toHaveLength(1);
    expect(api.postApi.mock.calls.filter((call) => call[0] === '/applications')).toHaveLength(1);
    const uploaded = api.postFormDataApi.mock.calls.filter((call) => call[0] === '/documents/upload');
    expect(uploaded).toHaveLength(2);
    expect((uploaded[1][1] as FormData).get('candidateId')).toBe('c-new');
  });
});
