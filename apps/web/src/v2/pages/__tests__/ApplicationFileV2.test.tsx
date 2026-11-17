import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BreadcrumbProvider, useBreadcrumb } from '../../../context/BreadcrumbContext';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { fileResponses, type Scenario } from '../../api/__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
const authState = vi.hoisted(() => ({ user: { id: 'u-mariam', displayName: 'Mariam Farag', permissions: [] as string[] } }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));
import { loadApplicationFile } from '../../api/applicationFile';
import { savePipelineSourceSet } from '../../api/jobs';
import { ApplicationFileV2, isSystemNote } from '../ApplicationFileV2';
import { cairoIso } from '../../drawers/FileDrawers';

let responses: Record<string, unknown> = {};
function serve(scenario: Scenario, extra: Record<string, unknown> = {}) {
  responses = { ...fileResponses(scenario), '/users/interviewers': [{ id: 'u-karim', displayName: 'Karim Hassan', email: 'k@x', jobTitle: 'Hiring manager', roles: [] }], '/screening/application/a1/draft': null, ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'not found');
  });
}
function Loc() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }
function HistoryBack() { const nav = useNavigate(); return <button type="button" onClick={() => nav(-1)}>History back</button>; }
function renderFile(path = '/applications/a1') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/applications/:id" element={<><ApplicationFileV2 /><Loc /></>} /></Routes></MemoryRouter>);
}
async function openMore(user: ReturnType<typeof userEvent.setup>) {
  const more = screen.getByRole('button', { name: 'More actions' });
  if (more.getAttribute('aria-expanded') !== 'true') await user.click(more);
}
function expandEvidence() {
  const button = screen.queryByRole('button', { name: /Show evaluation details/ });
  if (button) fireEvent.click(button);
}
const PAY = /42000|42,000|504000|504,000|30000|EGP|AED|salary|package|compensation/i;

beforeEach(() => { authState.user.permissions = []; Object.values(api).forEach((f) => f.mockReset()); api.postApi.mockImplementation(async (p: string) => (p === '/offers' ? 'o1' : { id: 'h1', alreadyJoined: false })); api.patchApi.mockImplementation(async () => ({ version: 8 })); });
afterEach(() => {
  document.documentElement.removeAttribute('data-ui');
  sessionStorage.removeItem('rf2:pipeline-source-set');
  sessionStorage.removeItem('rf2:file-note-draft:a1');
});

describe('pay safety', () => {
  it('loadApplicationFile strips every pay field the API sends', async () => {
    serve('prehire');
    const file = await loadApplicationFile('a1');
    expect(JSON.stringify(file)).not.toMatch(/salary|monthlyPackage|annualFixed|components|currency|packageTotal|"amount"/i);
    expect(file.offer?.offerCode).toBe('OFF-2026-0012');
    expect(file.joiningChecks.map((c) => [c.type, c.verified])).toEqual([['ID', true], ['CONTRACT', false], ['SCFHS_LICENCE', false]]);
    expect(file.documents.map((d) => d.name)).toEqual(['Ahmed_Embaby_CV.pdf', 'Laravel_cert.pdf']);
    expect(api.getApi).toHaveBeenCalledWith('/offers?applicationId=a1');
    expect(api.getApi).toHaveBeenCalledWith('/hiring?applicationId=a1');
  });
  it.each(['offer-pending', 'offer-sent', 'prehire'] as const)('%s: no pay anywhere on the page or in drawers', async (sc) => {
    serve(sc);
    const { container } = renderFile('/applications/a1?drawer=waiting');
    await screen.findByRole('dialog');
    expect(document.body.textContent).not.toMatch(PAY);
    expect(container.textContent).not.toMatch(PAY);
  });
  it('writes never carry pay: offer draft sends components: []; screening sends no salary', async () => {
    const u = userEvent.setup();
    serve('scored');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-01');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers', expect.objectContaining({ applicationId: 'a1', components: [], proposedJoiningDate: '2026-11-01T00:00:00.000Z' })));
    const body = api.postApi.mock.calls.find(([p]) => p === '/offers')![1];
    expect(JSON.stringify(body)).not.toMatch(/salary|amount|currency|package|grade/i);
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
  });
});

function ShellTitle() {
  const { customLabels } = useBreadcrumb();
  const { pathname } = useLocation();
  return <h1>{customLabels[pathname] ?? 'Applications'}</h1>;
}

describe('File header', () => {
  it('shows the candidate name in the header and the page heading', async () => {
    serve('interview');
    document.documentElement.setAttribute('data-ui', 'v2');
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={['/applications/a1']}>
          <Routes>
            <Route path="/applications/:id" element={<><ShellTitle /><ApplicationFileV2 /><Loc /></>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Ahmed Embaby' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Ahmed Embaby' })).toBeInTheDocument();
  });
});

describe('licence file', () => {
  it('opens the pre-hire drawer on the application file and leaves it closed after Close', async () => {
    const u = userEvent.setup();
    serve('prehire');
    render(<MemoryRouter initialEntries={['/applications/a1']}><Routes><Route path="/applications/:id" element={<><ApplicationFileV2 mode="licence" /><Loc /></>} /></Routes></MemoryRouter>);
    const dialog = await screen.findByRole('dialog', { name: /Pre-hire checklist/i });
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=prehire');
    await u.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1');
  });
});

describe('E13 application file', () => {
  it('renders the stage rail, smart action bar, next action, gate, evidence and documents', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile();
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('HRIS Developer · Offshore Cairo · Owner: Mariam Farag')).toBeInTheDocument();
    const stages = screen.getByRole('list', { name: 'Stages' });
    expect(within(stages).getByRole('button', { name: 'Interview' })).toHaveAttribute('aria-current', 'step');
    const bar = screen.getByRole('group', { name: 'Smart actions' });
    expect(within(bar).queryByRole('button', { name: (value) => value === 'Reject' })).not.toBeInTheDocument();
    await openMore(u);
    const moreMenu = within(bar).getByRole('group', { name: 'More actions' });
    expect(within(moreMenu).getByRole('button', { name: 'Reject' })).toBeEnabled();
    for (const name of ['Note', 'Documents', 'Schedule', 'Scorecard', 'Offer', 'Pre-hire', 'Reject']) {
      expect(within(moreMenu).getByRole('button', { name: (value) => value === name })).toBeInTheDocument();
    }
    await u.click(within(moreMenu).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByRole('dialog', { name: /Reject —/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const stage = screen.getByText('Scorecard required').parentElement;
    expect(stage).toHaveTextContent('Interview');
    expect(stage).toHaveTextContent('Scorecard required');
    expect(screen.getByRole('heading', { name: "Waiting on Karim Hassan's scorecard" })).toBeInTheDocument();
    expect(screen.getByText('Karim Hassan · Interviewer')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Gate to Offer' })).getByText('Scorecard submitted').closest('li')).toHaveAttribute('data-ok', 'false');
    expandEvidence();
    expect(screen.getAllByText(/Fit note/).length).toBeGreaterThan(0);
    expect(screen.getByText('Screening notes · recorded by Mariam Farag')).toBeInTheDocument();
    expect(screen.getByText('ahmed.embaby@example.com')).toBeInTheDocument();
    expect(screen.getByText('Source: LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Notice: 30 days')).toBeInTheDocument();
    expect(screen.getByText('Follow-up date').parentElement).toHaveTextContent('12 Oct 2026');
    expect(screen.getByText(/Application follow-up date applies to this job file only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person contact & timed follow-up' })).toHaveAttribute('aria-expanded', 'false');
    expect(api.getApi.mock.calls.some(([path]) => String(path).includes('/activities'))).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Latest activity' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Moved Screening → Interview').length).toBeGreaterThan(0);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');
    expect(within(crumbs).getByText('Ahmed Embaby')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'HRIS Developer pipeline' })).toHaveAttribute('href', '/vacancies/j1');
    const recorded = screen.getByRole('list', { name: 'Chatter' });
    expect(recorded).not.toHaveTextContent('Technical interview: Ahmed Embaby — 6 Oct 2026, 10:00');
    const interviews = screen.getByRole('list', { name: 'Interviews' });
    expect(interviews).toHaveTextContent('Technical interview: Ahmed Embaby — 6 Oct 2026, 10:00');
    expect(interviews).toHaveTextContent('Appointment on the file');
    await u.click(screen.getByRole('button', { name: 'Documents' }));
    const docs = screen.getByRole('region', { name: 'Documents' });
    expect(docs).toHaveTextContent('Ahmed_Embaby_CV.pdf');
    expect(docs).toHaveTextContent('CV · 1 Oct 2026 · by Mariam Farag');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
  });

  it('closes More actions when the surrounding page is clicked and keeps it open for a listed action', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile();
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    await openMore(u);
    expect(screen.getByRole('group', { name: 'More actions' })).toBeInTheDocument();
    await u.click(screen.getByRole('heading', { name: 'Ahmed Embaby', level: 2 }));
    expect(screen.queryByRole('group', { name: 'More actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'false');

    await openMore(u);
    await u.click(screen.getByText('Locked actions wait for the current step. They do not move the file.'));
    expect(screen.queryByRole('group', { name: 'More actions' })).not.toBeInTheDocument();

    await openMore(u);
    await u.click(screen.getByRole('button', { name: 'Note' }));
    expect(screen.getByRole('group', { name: 'More actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add a note')).toBeInTheDocument();
  });

  it.each([
    ['applied', 'Log screen'], ['screened', 'Schedule interview'], ['interview', 'Open scorecard'], ['scored', 'Draft offer'],
    ['offer-pending', 'View approval'], ['offer-approved', 'Send offer'], ['offer-sent', 'Record answer'], ['offer-accepted', 'Move to Pre-hire'], ['prehire', 'Pre-hire checklist'],
  ] as const)('%s → one primary "%s"', async (sc, label) => {
    serve(sc);
    renderFile();
    const btn = await screen.findByRole('button', { name: label });
    expect(btn).toHaveClass('rf2-btn--primary');
  });

  it('rejected file: closed note, no actions', async () => {
    const u = userEvent.setup();
    serve('rejected');
    renderFile();
    expect(await screen.findByText('Closed as Rejected — Not enough experience.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    await openMore(u);
    for (const name of ['Schedule', 'Scorecard', 'Offer', 'Pre-hire', 'Log screen']) {
      expect(screen.queryByRole('button', { name: (value) => value === name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Note' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Stages' })).toBeInTheDocument();
  });

  it('403 FILE_NOT_OWNED → Forbidden; 404 → not found', async () => {
    serve('applied', { '/applications/a1/workspace': new ApiError(403, 'Access denied: this file belongs to another owner.', {}, { code: 'FORBIDDEN' }) });
    renderFile();
    expect(await screen.findByText('This file belongs to another owner')).toBeInTheDocument();
  });

  it('stays on the file when the primary action, a secondary action, or a refused stage is chosen', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Log screen' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=screen');
    expect(screen.getByRole('dialog', { name: /Log screen/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    await openMore(u);
    await u.click(screen.getByRole('button', { name: (value) => value === 'Schedule' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=schedule');
    expect(screen.getByRole('dialog', { name: /Schedule interview/ })).toBeInTheDocument();
    expect(screen.getByTestId('loc').textContent).not.toMatch(/\/(hires|licenses|joinings|interviews|offers)(\/|$|\?)/);
    await u.keyboard('{Escape}');
    const stages = screen.getByRole('list', { name: 'Stages' });
    await u.click(within(stages).getByRole('button', { name: 'Offer' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=screen');
    expect(screen.getByRole('dialog', { name: /Log screen/ })).toBeInTheDocument();
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(screen.getByTestId('loc').textContent).not.toMatch(/\/(hires|licenses|joinings|interviews|offers)(\/|$|\?)/);
  });

  it('lists chatter newest-first, including a note, a screen, a stage change, and a message', async () => {
    serve('interview', {
      '/applications/a1/messages': {
        destination: 'local-test@recruitflow.local',
        templates: [],
        followUpDate: null,
        attempts: [{ id: 'm1', templateId: 't1', templateName: 'Screen follow-up', state: 'Queued', reason: null, retryOf: null, at: '2026-10-02T12:00:00.000Z' }],
      },
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    const titles = within(chatter).getAllByRole('listitem').map((item) => item.textContent ?? '');
    const note = titles.findIndex((text) => text.includes('Note by Mariam Farag'));
    const screenRow = titles.findIndex((text) => text.includes('Screening logged'));
    const message = titles.findIndex((text) => text.includes('Message Queued: Screen follow-up'));
    const moved = titles.findIndex((text) => text.includes('Moved Screening → Interview'));
    expect(screenRow).toBeGreaterThan(-1);
    expect(note).toBeLessThan(screenRow);
    expect(message).toBeLessThan(note);
    expect(moved).toBeLessThan(message);
  });

  it('primary opens its drawer via ?drawer= and closing clears it', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Log screen' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=screen');
    expect(screen.getByRole('dialog', { name: /Log screen — Ahmed Embaby/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/applications\/a1$/);
  });

  it.each([
    ['screen', /Log screen/], ['schedule', /Schedule interview/], ['scorecard', /Scorecard/], ['offer', /Draft offer/], ['waiting', /Waiting on approval/],
    ['send', /Send offer/], ['answer', /Record answer/], ['prehire', /Pre-hire checklist/], ['reject', /Reject/],
  ])('deep link ?drawer=%s opens the drawer, with no axe violations', async (key, title) => {
    serve('offer-sent');
    renderFile(`/applications/a1?drawer=${key}`);
    const d = await screen.findByRole('dialog', { name: title });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it('page has no axe violations', async () => {
    serve('interview');
    const { container } = renderFile();
    await screen.findByRole('heading', { name: /Ahmed Embaby/ });
    expect(await axeViolations(container)).toEqual([]);
  });

  it('opens person contact separately from the application follow-up date', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'];
    serve('interview', {
      '/candidates/c1/activities': {
        completed: 1, completedByMe: 1, pending: 1, overdue: 0, lastActivityAt: '2026-10-01T08:00:00.000Z', nextFollowUpAt: '2026-10-20T09:00:00.000Z',
        byKind: { Call: 1 }, byRecruiter: [], totalEntries: 1, page: 1, pageSize: 20,
        entries: [{ id: 'task:call-1', kind: 'Call', title: 'Reached candidate', actorId: 'u-mariam', actorName: 'Mariam Farag', at: '2026-10-01T08:00:00.000Z', dueAt: null, status: 'Completed', applicationId: null, canComplete: false }],
      },
    });
    renderFile();
    expect(await screen.findByText('Follow-up date')).toBeInTheDocument();
    expect(screen.getByText('Follow-up date').parentElement).toHaveTextContent('12 Oct 2026');
    expect(screen.getByText(/Application follow-up date applies to this job file only/)).toBeInTheDocument();
    expect(screen.getByText(/person contact & timed follow-up applies to the candidate across applications/i)).toBeInTheDocument();
    expect(api.getApi.mock.calls.some(([path]) => String(path).includes('/activities'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Person contact & timed follow-up' }));
    expect(screen.getByRole('button', { name: 'Person contact & timed follow-up' })).toHaveAttribute('aria-expanded', 'true');
    const activity = await screen.findByRole('region', { name: 'Candidate activity' });
    expect(activity).toHaveTextContent("Person contact & timed follow-up — shared across this person's applications (distinct from application follow-up date)");
    expect(await within(activity).findByText(/Completed by Mariam Farag/)).toBeInTheDocument();
    expect(activity).toHaveTextContent('Reached candidate');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/candidates/c1/activities?page=1'));
    expect(api.getApi.mock.calls.filter(([path]) => String(path).includes('/activities'))).toHaveLength(1);
  });

  it('follow-up date: owner edits it (PATCH /applications/:id/follow-up), clears it, and sees FOLLOW_UP_NOT_OWNER by code', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockResolvedValueOnce({ id: 'a1', followUpDate: '2026-10-20' });
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Change' }));
    const input = screen.getByLabelText('Follow-up date');
    expect(input).toHaveValue('2026-10-12');
    await u.clear(input); await u.type(input, '2026-10-20');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/follow-up', { followUpDate: '2026-10-20' }));
    await u.click(await screen.findByRole('button', { name: 'Change' }));
    api.patchApi.mockRejectedValueOnce(new ApiError(403, 'Only the owner of this file can change its follow-up date.', { code: 'FOLLOW_UP_NOT_OWNER', message: 'Only the owner of this file can change its follow-up date.' }, { code: 'FOLLOW_UP_NOT_OWNER' }));
    await u.click(screen.getByRole('button', { name: 'Clear' }));
    expect(api.patchApi).toHaveBeenLastCalledWith('/applications/a1/follow-up', { followUpDate: null });
    expect(await screen.findByText('Only the owner of this file can change its follow-up date.')).toBeInTheDocument();
  });
  it('adds a note', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    await screen.findByRole('heading', { name: 'Ahmed Embaby' });
    await openMore(u);
    await u.click(screen.getByRole('button', { name: 'Note' }));
    expect(screen.getByLabelText('Add a note')).toHaveFocus();
    await u.type(screen.getByLabelText('Add a note'), 'Called, interested.');
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    expect(api.postApi).toHaveBeenCalledWith('/applications/a1/notes', { content: 'Called, interested.' });
  });

  it('keeps the selected tab through the drawer and a fresh open', async () => {
    const u = userEvent.setup();
    serve('interview');
    const viewed = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('button', { name: 'Documents' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Chatter' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documents' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Open scorecard' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=documents');
    expect(screen.getByTestId('loc')).toHaveTextContent('drawer=scorecard');
    await u.keyboard('{Escape}');
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=documents');
    expect(screen.getByTestId('loc')).not.toHaveTextContent('drawer=');
    viewed.unmount();
    renderFile('/applications/a1');
    await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 });
    await openMore(u);
    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-pressed', 'false');
    await u.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByRole('region', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?tab=documents');
  });

  it('accepts an internal candidates, my-work or job return and rejects anything else', async () => {
    const u = userEvent.setup();
    serve('interview');
    const candidates = renderFile(`/applications/a1?returnTo=${encodeURIComponent('/candidates?stage=Interview&q=laravel')}`);
    const back = await screen.findByRole('link', { name: 'Back to Candidates' });
    expect(back).toHaveAttribute('href', '/candidates?stage=Interview&q=laravel');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Candidates' })).toHaveAttribute('href', '/candidates?stage=Interview&q=laravel');
    await openMore(u);
    await u.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('returnTo=');
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=documents');
    candidates.unmount();

    const myWork = renderFile(`/applications/a1?returnTo=${encodeURIComponent('/my-work?day=tomorrow&tab=joining')}`);
    expect(await screen.findByRole('link', { name: 'Back to My Work' })).toHaveAttribute('href', '/my-work?day=tomorrow&tab=joining');
    myWork.unmount();

    const sameJob = renderFile(`/applications/a1?returnTo=${encodeURIComponent('/vacancies/j1?stage=Offer')}`);
    expect(await screen.findByRole('link', { name: 'HRIS Developer pipeline' })).toHaveAttribute('href', '/vacancies/j1?stage=Offer');
    sameJob.unmount();

    const otherJob = renderFile(`/applications/a1?returnTo=${encodeURIComponent('/vacancies/other-job')}`);
    expect(await screen.findByRole('link', { name: 'Job pipeline' })).toHaveAttribute('href', '/vacancies/other-job');
    otherJob.unmount();

    const searchBack = renderFile(`/applications/a1?returnTo=${encodeURIComponent('/search?q=Ahmed')}`);
    expect(await screen.findByRole('link', { name: 'Back to Search' })).toHaveAttribute('href', '/search?q=Ahmed');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search?q=Ahmed');
    searchBack.unmount();

    const compareHref = '/candidates/compare?job=v1&ids=c-a7,c-a4&search=HRIS&source=LinkedIn&stage=Interview';
    const compareBack = renderFile(`/applications/a1?returnTo=${encodeURIComponent(compareHref)}`);
    expect(await screen.findByRole('link', { name: 'Back to Compare' })).toHaveAttribute('href', compareHref);
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Compare' })).toHaveAttribute('href', compareHref);
    compareBack.unmount();

    for (const raw of ['https://evil.example/candidates', '//evil.example/candidates', '/settings', '/candidates/extra', '/vacancies', '/vacancies/j1/edit', '/my-work/../settings', '/search', '/candidates/compare?job=v1']) {
      const rejected = renderFile(`/applications/a1?returnTo=${encodeURIComponent(raw)}`);
      expect(await screen.findByRole('link', { name: 'HRIS Developer pipeline' })).toHaveAttribute('href', '/vacancies/j1');
      expect(screen.queryByRole('link', { name: 'Back to Candidates' })).not.toBeInTheDocument();
      rejected.unmount();
    }
  });

  it('keeps the hub tab when the reader comes back from the contextual link', async () => {
    const u = userEvent.setup();
    serve('interview');
    render(
      <MemoryRouter initialEntries={[`/applications/a1?tab=documents&returnTo=${encodeURIComponent('/candidates?q=hris')}`]}>
        <Routes>
          <Route path="/applications/:id" element={<><ApplicationFileV2 /><Loc /></>} />
          <Route path="/candidates" element={<HistoryBack />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('region', { name: 'Documents' })).toBeInTheDocument();
    await u.click(screen.getByRole('link', { name: 'Back to Candidates' }));
    await u.click(screen.getByRole('button', { name: 'History back' }));
    expect(await screen.findByRole('region', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=documents');
    expect(screen.getByTestId('loc')).toHaveTextContent('returnTo=');
  });

  it('shows an empty evidence state instead of a CV summary', async () => {
    serve('applied', { '/applications/a1/notes': [] });
    renderFile();
    expect(await screen.findByText('No screening note or fit evidence is recorded on this file yet.')).toBeInTheDocument();
    expect(screen.queryByText(/CV summary/i)).not.toBeInTheDocument();
  });

  it('records an interview at its creation time and keeps the appointment separate', async () => {
    const interviews = fileResponses('interview')['/interviews'] as Array<Record<string, unknown>>;
    serve('interview', { '/interviews': [{ ...interviews[0], createdAt: '2026-10-04T09:00:00.000Z', status: 'Scheduled', scheduledStart: '2026-10-20T07:00:00.000Z' }] });
    const recordedView = renderFile('/applications/a1?tab=activity');
    const recorded = await screen.findByRole('list', { name: 'Chatter' });
    const row = within(recorded).getByText(/Interview recorded/).closest('li');
    expect(row?.querySelector('time')).toHaveAttribute('dateTime', '2026-10-04T09:00:00.000Z');
    expect(recorded).toHaveTextContent('4 Oct 2026');
    const commitments = screen.getByRole('list', { name: 'Interviews' });
    expect(commitments).toHaveTextContent('Technical interview: Ahmed Embaby — 20 Oct 2026, 10:00');
    expect(commitments.querySelector('time')).toHaveAttribute('dateTime', '2026-10-04T09:00:00.000Z');
    recordedView.unmount();
    serve('interview', { '/interviews': [{ ...interviews[0], status: 'Scheduled', scheduledStart: '2026-10-20T07:00:00.000Z' }] });
    renderFile('/applications/a1?tab=activity');
    const planned = await screen.findByRole('list', { name: 'Interviews' });
    expect(planned).toHaveTextContent('Scheduled commitment');
    expect(screen.getByRole('list', { name: 'Chatter' })).not.toHaveTextContent('Interview recorded');
  });

  it('does not treat a verified checklist as permission to join', async () => {
    serve('prehire-done');
    const verified = renderFile();
    expect(await screen.findByRole('button', { name: 'Pre-hire checklist' })).toBeInTheDocument();
    expect(screen.getByText(/They are not joining/)).toBeInTheDocument();
    expect(screen.getByText(/Every check on this file is verified/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record actual joining|Move to Joined/ })).not.toBeInTheDocument();
    verified.unmount();
    serve('prehire', { '/applications/a1/joining-checks': [] });
    renderFile();
    expect(await screen.findByText(/No required checks are on the file yet/)).toBeInTheDocument();
    expect(screen.getByText(/They are not joining/)).toBeInTheDocument();
  });
});

describe('E14 Screen', () => {
  it('requires the note, then logs screening and moves Applied → Screening → Interview', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    expect(within(d).getByText(/Write the screen note/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/Screen note/), 'Pass. Laravel + HRIS.');
    await u.type(within(d).getByLabelText(/Notice period/), '30');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Move to interview');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledTimes(2));
    expect(api.postApi).toHaveBeenCalledWith('/screening', {
      applicationId: 'a1', outcome: 'Passed', notes: 'Pass. Laravel + HRIS.', noticePeriodDays: 30,
      method: 'Phone', evidenceSource: 'Screening call', nextStep: 'Move to interview',
    });
    expect(api.patchApi).toHaveBeenNthCalledWith(1, '/applications/a1/stage', { stage: 'Screening', expectedStage: 'Applied', expectedVersion: 7 });
    expect(api.patchApi).toHaveBeenNthCalledWith(2, '/applications/a1/stage', { stage: 'Interview', expectedStage: 'Screening', expectedVersion: 8 });
  });
  it('shows the gate message inline on a 409', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockRejectedValue(new ApiError(409, 'Server text', { statusCode: 409, code: 'GATE_SCREEN_NOTE_MISSING', gate: 'screen-note', missing: ['screen note'], message: 'Server text' }, { code: 'GATE_SCREEN_NOTE_MISSING' }));
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'x');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Move to interview');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Interview needs a saved screen note. Missing: screen note. Log the screen with a note first.');
  });

  it('opens with method, evidence source, and next step', async () => {
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog', { name: /Log screen/ });
    expect(within(d).getByLabelText(/^Method/)).toHaveValue('Phone');
    expect(within(d).getByRole('option', { name: 'Video' })).toBeInTheDocument();
    expect(within(d).getByRole('option', { name: 'In person' })).toBeInTheDocument();
    expect(within(d).getByLabelText(/Evidence source/)).toHaveAttribute('placeholder', 'Screening call');
    expect(within(d).getByRole('option', { name: 'Move to interview' })).toBeInTheDocument();
    expect(within(d).getByRole('option', { name: 'Keep in screening' })).toBeInTheDocument();
    expect(within(d).getByRole('option', { name: 'Do not proceed' })).toBeInTheDocument();
    expect(within(d).getByLabelText(/Screen note/)).toBeRequired();
    expect(within(d).queryByRole('checkbox', { name: /Move to Interview after saving/ })).not.toBeInTheDocument();
  });

  it('posts method, evidence source, and next step and does not post salary or advance when Keep in screening is selected', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Reached the candidate.');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Keep in screening');
    await u.click(within(d).getByRole('button', { name: 'Save screen' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/screening', {
      applicationId: 'a1',
      outcome: 'Passed',
      notes: 'Reached the candidate.',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Keep in screening',
    }));
    const body = api.postApi.mock.calls.find(([p]) => p === '/screening')![1] as Record<string, unknown>;
    expect(Object.keys(body).some((key) => /salary|amount|currency|package|grade/i.test(key))).toBe(false);
    expect(api.patchApi).not.toHaveBeenCalled();
  });

  it('Do not proceed requires an explicit rejection reason and moves the application to Rejected', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.selectOptions(within(d).getByLabelText(/^Outcome/), 'Failed');
    await u.type(within(d).getByLabelText(/Screen note/), 'Does not meet minimum requirements.');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Do not proceed');
    await u.click(within(d).getByRole('button', { name: 'Save and reject' }));
    expect(within(d).getByText(/Pick a reason/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await within(d).findByRole('option', { name: 'Not enough experience' });
    await u.selectOptions(within(d).getByLabelText(/Rejection reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Save and reject' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/screening', expect.objectContaining({
      applicationId: 'a1',
      outcome: 'Failed',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Do not proceed',
    })));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', {
      stage: 'Rejected',
      expectedStage: 'Applied',
      expectedVersion: 7,
      reason: 'Not enough experience',
    }));
  });

  it('recovers from a stage-move failure after screening save without creating a duplicate screening log on retry', async () => {
    const u = userEvent.setup();
    serve('applied');
    let stageCalls = 0;
    api.patchApi.mockImplementation(async () => {
      stageCalls += 1;
      if (stageCalls === 1) return { version: 8 };
      if (stageCalls === 2) throw new ApiError(500, 'Transient stage move failure.');
      return { version: 9 };
    });
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Strong HRIS background.');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Move to interview');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Transient stage move failure.');
    expect(within(d).getByText(/Screening note saved, but moving to Interview did not finish/)).toBeInTheDocument();
    expect(within(d).getByLabelText(/Screen note/)).toHaveValue('Strong HRIS background.');
    expect(api.postApi.mock.calls.filter(([p]) => p === '/screening')).toHaveLength(1);
    expect(api.patchApi).toHaveBeenCalledTimes(2);

    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledTimes(3));
    expect(api.postApi.mock.calls.filter(([p]) => p === '/screening')).toHaveLength(1);
    expect(api.patchApi).toHaveBeenNthCalledWith(3, '/applications/a1/stage', {
      stage: 'Interview',
      expectedStage: 'Screening',
      expectedVersion: 8,
    });
  });

  it('stays on the drawer when the evidence source is missing', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Pass. Laravel + HRIS.');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Do not proceed');
    await u.click(within(d).getByRole('button', { name: 'Save and reject' }));
    expect(within(d).getByText('Write the evidence source.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Log screen/ })).toBeInTheDocument();
  });

  it('shows saved method, evidence source, and next step on the activity row and omits a null field', async () => {
    const base = (fileResponses('screened')['/screening/application/a1'] as Array<Record<string, unknown>>)[0];
    const named = { ...base, id: 's-named', method: 'Video', evidenceSource: 'Panel notes', nextStep: 'Keep in screening', screenedAt: '2026-10-02T10:00:00.000Z' };
    const unnamed: Record<string, unknown> = { ...base, id: 's-unnamed', method: 'Phone', evidenceSource: null, nextStep: null, screenedAt: '2026-10-02T12:00:00.000Z', notes: 'Short call.' };
    delete unnamed.screenerName;
    serve('screened', { '/screening/application/a1': [named, unnamed] });
    renderFile('/applications/a1?tab=activity');
    const recorded = await screen.findByRole('list', { name: 'Chatter' });
    const namedRow = within(recorded).getByText(/Panel notes/).closest('li');
    expect(namedRow).toHaveTextContent('Screening logged by Mariam Farag — Passed');
    expect(namedRow).toHaveTextContent('Method: Video');
    expect(namedRow).toHaveTextContent('Evidence source: Panel notes');
    expect(namedRow).toHaveTextContent('Next step: Keep in screening');
    const unnamedRow = within(recorded).getByText(/Short call/).closest('li');
    expect(unnamedRow).toHaveTextContent('Screening logged — Passed');
    expect(unnamedRow).toHaveTextContent('Method: Phone');
    expect(unnamedRow).not.toHaveTextContent('Evidence source');
    expect(unnamedRow).not.toHaveTextContent('Next step');
    expect(unnamedRow).not.toHaveTextContent('by ');
  });

  it('saves a private draft without posting the screen or moving the stage, then restores it', async () => {
    const u = userEvent.setup();
    serve('applied');
    api.putApi.mockImplementation(async (_path: string, body: Record<string, unknown>) => {
      const saved = {
        ...body,
        id: 'draft-1',
        applicationId: 'a1',
        organizationId: 'o',
        userId: 'u-mariam',
        createdAt: '2026-10-15T12:00:00.000Z',
        updatedAt: '2026-10-15T12:00:00.000Z',
      };
      responses['/screening/application/a1/draft'] = saved;
      return saved;
    });
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Keep this call private.');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Keep in screening');
    await u.click(within(d).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/screening/application/a1/draft', {
      outcome: 'Passed',
      notes: 'Keep this call private.',
      noticePeriodDays: null,
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Keep in screening',
      moveToInterview: false,
    }));
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.patchApi).not.toHaveBeenCalled();
    const draftBody = api.putApi.mock.calls.find(([path]) => path === '/screening/application/a1/draft')![1] as Record<string, unknown>;
    expect(Object.keys(draftBody).some((key) => /salary|amount|currency|package|grade|document|token|secret/i.test(key))).toBe(false);
    expect(await within(d).findByText('Draft saved. It stays private to you on this application.')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await u.click(screen.getByRole('button', { name: 'Log screen' }));
    const again = await screen.findByRole('dialog', { name: /Log screen/ });
    await waitFor(() => expect(within(again).getByLabelText(/Screen note/)).toHaveValue('Keep this call private.'));
    expect(within(again).getByLabelText(/Evidence source/)).toHaveValue('Screening call');
  });

  it('the saved screen request still has no salary keys', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Reached the candidate.');
    await u.type(within(d).getByLabelText(/Evidence source/), 'Screening call');
    await u.selectOptions(within(d).getByLabelText(/^Next step/), 'Keep in screening');
    await u.click(within(d).getByRole('button', { name: 'Save screen' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/screening', expect.objectContaining({
      applicationId: 'a1',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Keep in screening',
    })));
    const body = api.postApi.mock.calls.find(([path]) => path === '/screening')![1] as Record<string, unknown>;
    expect(Object.keys(body).some((key) => /salary|amount|currency|package|grade/i.test(key))).toBe(false);
    expect(api.patchApi).not.toHaveBeenCalled();
  });
});

describe('E15 Schedule', () => {
  it('cairoIso converts Cairo wall time to UTC', () => {
    expect(cairoIso('2026-10-13', '10:00')).toBe('2026-10-13T07:00:00.000Z');
  });
  it('validates and posts CreateInterviewDto with room URL and interviewer user ids (no Meet, no self-schedule)', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    expect(d.textContent).not.toMatch(/Google Meet|self-schedule/i);
    expect(within(d).getByRole('region', { name: 'Time & location' })).toContainElement(within(d).getByLabelText(/^Date/));
    expect(within(d).getByRole('region', { name: 'Interview panel' })).toContainElement(within(d).getByRole('combobox', { name: /Interviewers/ }));
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    expect(within(d).getByText('Pick a date.')).toBeInTheDocument();
    expect(within(d).getByText('Paste the meeting room URL (https://…).')).toBeInTheDocument();
    expect(within(d).getByText('Add at least one interviewer.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Date/), '2026-10-13');
    await u.type(within(d).getByLabelText(/Room URL/), 'https://teams.microsoft.com/l/x');
    await u.click(within(d).getByRole('combobox', { name: /Interviewers/ }));
    await u.click(await within(d).findByRole('option', { name: /Karim Hassan/ }));
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews', {
      applicationId: 'a1', title: 'Technical interview: Ahmed Embaby', interviewType: 'Technical', scheduledStart: '2026-10-13T07:00:00.000Z', scheduledEnd: '2026-10-13T08:00:00.000Z',
      timezone: 'Africa/Cairo', locationUrl: 'https://teams.microsoft.com/l/x', attendeeUserIds: ['u-karim'],
    }));
    expect(api.getApi).toHaveBeenCalledWith('/users/interviewers');
  });
  it('maps ROOM_URL_HOST_NOT_ALLOWED from the server', async () => {
    const u = userEvent.setup();
    serve('interview');
    const msg = 'The meeting link must be on an approved meeting host (teams.microsoft.com, zoom.us).';
    api.postApi.mockRejectedValue(new ApiError(400, msg, { code: 'ROOM_URL_HOST_NOT_ALLOWED', message: msg }, { code: 'ROOM_URL_HOST_NOT_ALLOWED' }));
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/^Date/), '2026-10-13');
    await u.type(within(d).getByLabelText(/Room URL/), 'https://example.com/r');
    await u.click(within(d).getByRole('combobox', { name: /Interviewers/ }));
    await u.click(await within(d).findByRole('option', { name: /Karim Hassan/ }));
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent(msg);
  });
  it('from Screening without a screen note the primary is disabled by the gate', async () => {
    serve('applied');
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Schedule interview' })).toBeDisabled();
    expect(within(d).getByRole('list', { name: 'Gate to Interview' })).toHaveTextContent('Screen note saved');
  });
  it('cancels an open interview from the schedule drawer', async () => {
    const u = userEvent.setup();
    const interviews = fileResponses('interview')['/interviews'] as Array<Record<string, unknown>>;
    serve('interview', { '/interviews': [{ ...interviews[0], status: 'Scheduled' }] });
    renderFile('/applications/a1?drawer=schedule&interview=iv1');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Mark no-show' })).toBeInTheDocument();
    expect(within(d).queryByText(/Google Meet|self-schedule/i)).not.toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Cancel interview' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/interviews/iv1', { status: 'Cancelled' }));
  });
  it('shows the next open appointment and outstanding scorecards', async () => {
    const interviews = fileResponses('interview')['/interviews'] as Array<Record<string, unknown>>;
    serve('interview', {
      '/interviews': [{
        ...interviews[0],
        status: 'Scheduled',
        scheduledStart: '2026-10-20T07:00:00.000Z',
        scheduledEnd: '2026-10-20T08:00:00.000Z',
        attendees: [{ userId: 'u-karim', displayName: 'Karim Hassan' }, { userId: 'u-mariam', displayName: 'Mariam Farag' }],
      }],
    });
    renderFile('/applications/a1?tab=activity');
    expect(await screen.findByTestId('next-appointment')).toHaveTextContent('Next appointment: Technical interview: Ahmed Embaby · 20 Oct 2026, 10:00');
    expect(screen.getByRole('list', { name: 'Interviews' })).toHaveTextContent('0 scorecards submitted · 2 outstanding');
  });
});

describe('E16 Scorecard', () => {
  it('submits my scorecard (POST /interviews/:id/scorecard, status Submitted)', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=scorecard&interview=iv1');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit scorecard' }));
    expect(within(d).getByText('Choose a rating from 1 to 5.')).toBeInTheDocument();
    await u.click(within(d).getByRole('radio', { name: '4' }));
    await u.type(within(d).getByLabelText(/Evidence/), 'Clear payroll export design.');
    await u.click(within(d).getByRole('button', { name: 'Submit scorecard' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', { overallRating: 4, recommendation: 'Hire', notes: 'Clear payroll export design.', status: 'Submitted' }));
  });
  it('saves a draft', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=scorecard');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Evidence/), 'WIP');
    await u.click(within(d).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', expect.objectContaining({ status: 'Draft', notes: 'WIP' })));
  });
  it('revises my submitted scorecard with a reason (POST …/scorecard/revisions)', async () => {
    const u = userEvent.setup();
    const r = fileResponses('scored');
    serve('scored', { '/interviews/iv1/scorecard': [{ ...(r['/interviews/iv1/scorecard'] as object[])[0], interviewerId: 'u-mariam', interviewerName: 'Mariam Farag' }] });
    renderFile('/applications/a1?drawer=scorecard');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('region', { name: 'Scorecard by you' })).toHaveTextContent('Submitted');
    await u.click(within(d).getByRole('button', { name: 'Revise with a reason' }));
    await u.click(within(d).getByRole('button', { name: 'Submit revision' }));
    expect(within(d).getByText(/Say why you are revising/)).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/Reason for revising/), 'Typo in rating');
    await u.click(within(d).getByRole('button', { name: 'Submit revision' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard/revisions', expect.objectContaining({ reason: 'Typo in rating', overallRating: 4 })));
  });
});

describe('E17–E20 offer', () => {
  it('E17 is gated on a submitted scorecard and moves Interview → Offer before creating the offer', async () => {
    serve('interview');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    expect(within(d).getByTestId('pay-note')).toHaveTextContent('Pay is not shown to you');
  });
  it('E18 shows the approver and nothing to do', async () => {
    serve('offer-pending');
    renderFile('/applications/a1?drawer=waiting');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('list', { name: 'Approvals' })).toHaveTextContent('Karim Hassan · Pending');
  });
  it('?drawer=offer shows the waiting offer that already exists, not a new Draft v1', async () => {
    serve('offer-pending');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog', { name: /Draft offer/ });
    expect(d).toHaveTextContent('v1');
    expect(d).toHaveTextContent('Pending approval');
    expect(d).toHaveTextContent('2026-11-01');
    expect(d).toHaveTextContent('Full-time · 2 years');
    expect(d).toHaveTextContent('3 months');
    expect(d).toHaveTextContent('Offshore Cairo');
    expect(within(d).getByRole('list', { name: 'Approvals' })).toHaveTextContent('Karim Hassan · Pending');
    expect(within(d).getByRole('link', { name: 'View approval' })).toHaveAttribute('href', expect.stringContaining('drawer=waiting'));
    expect(within(d).queryByText(/A scorecard is submitted/)).not.toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });
  it('?drawer=offer for a sent offer records the candidate answer instead of drafting again', async () => {
    serve('offer-sent');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog', { name: /Draft offer/ });
    expect(d).toHaveTextContent('Sent — waiting on candidate');
    expect(within(d).getByRole('link', { name: 'Record candidate answer' })).toHaveAttribute('href', expect.stringContaining('drawer=answer'));
    expect(within(d).queryByText(/A scorecard is submitted/)).not.toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
  });
  it('disables smart actions that contradict the stage gates', async () => {
    const u = userEvent.setup();
    serve('screened');
    renderFile();
    const bar = await screen.findByRole('group', { name: 'Smart actions' });
    expect(within(bar).getByRole('button', { name: 'Schedule interview' })).toBeEnabled();
    await openMore(u);
    expect(within(bar).getByRole('button', { name: 'Scorecard' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Offer' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Pre-hire' })).toBeDisabled();
  });
  it('E18 sent back by the manager: offer Draft, file stays in Offer, comment shown, primary "Revise and resubmit"', async () => {
    const u = userEvent.setup();
    serve('offer-sentback');
    renderFile();
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Sent back', { selector: '.rf2-file__status' }).parentElement).toHaveTextContent('Offer');
    await u.click(screen.getByRole('button', { name: 'Revise and resubmit' }));
    const d = await screen.findByRole('dialog', { name: /Revise and resubmit/ });
    expect(d).toHaveTextContent('The manager sent v1 back: “Start date clashes with Ramadan rota; move to 15 Nov.”');
    expect(within(d).getByLabelText(/Start date/)).toHaveValue('2026-11-01');
    await u.clear(within(d).getByLabelText(/Start date/));
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-15');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/revisions', expect.objectContaining({ components: [], proposedJoiningDate: '2026-11-15T00:00:00.000Z' }));
    expect(api.patchApi).not.toHaveBeenCalled();
  });
  it('E18 sent-back view explains Draft + Offer and links to revise', async () => {
    serve('offer-sentback');
    renderFile('/applications/a1?drawer=waiting');
    const d = await screen.findByRole('dialog', { name: /Sent back/ });
    expect(d).toHaveTextContent('Sent back by the manager');
    expect(d).toHaveTextContent('The offer is back in Draft and the file stays in Offer.');
    expect(within(d).getByRole('list', { name: 'Approvals' })).toHaveTextContent('Karim Hassan · Rejected · “Start date clashes');
    expect(within(d).getByRole('link', { name: 'Revise and resubmit' })).toHaveAttribute('href', expect.stringContaining('drawer=offer'));
  });
  it('E18 unsubmitted Draft → "Submit for approval" posts /submit; OFFER_NOT_DRAFT is shown by code', async () => {
    const u = userEvent.setup();
    serve('offer-draft');
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'Only a Draft (or Changes Requested) version can be submitted; this one is Pending Approval.', { code: 'OFFER_NOT_DRAFT', message: 'Only a Draft (or Changes Requested) version can be submitted; this one is Pending Approval.' }, { code: 'OFFER_NOT_DRAFT' }));
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {});
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('this one is Pending Approval');
  });
  it('E19 send offer offers a WhatsApp template and no email channel', async () => {
    serve('offer-approved');
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('radio', { name: /Email/ })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'Send offer' })).toBeNull();
    expect(within(d).queryByText(/SMTP/)).toBeNull();
    expect(within(d).queryByText(/Mail Templates/)).toBeNull();
    await waitFor(() => expect(within(d).getByLabelText(/Template/)).toHaveValue('t-wa-offer'));
    expect(within(d).getByRole('button', { name: 'Prepare WhatsApp offer' })).toBeEnabled();
    expect(api.getApi).not.toHaveBeenCalledWith('/email-templates');
  });
  it('E19 WhatsApp: prepares filled text first (preserving Approved), then records Sent when Confirm sent on WhatsApp is clicked', async () => {
    const u = userEvent.setup();
    serve('offer-approved');
    const waLink = 'https://wa.me/201112048890?text=Hi%20Ahmed';
    api.postApi
      .mockResolvedValueOnce({ id: 'o1', status: 'Approved', channel: 'whatsapp', templateId: 't-wa-offer', message: 'Hi Ahmed, your offer OFF-2026-0012 is ready.', waLink, prepared: true })
      .mockResolvedValueOnce({ id: 'o1', status: 'Sent', channel: 'whatsapp', templateId: 't-wa-offer', message: 'Hi Ahmed, your offer OFF-2026-0012 is ready.', waLink });
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByLabelText(/Template/)).toHaveValue('t-wa-offer'));
    expect(within(d).queryByRole('button', { name: 'Send offer' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Prepare WhatsApp offer' }));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/send', { channel: 'whatsapp', templateId: 't-wa-offer', prepareOnly: true });
    const prepared = await screen.findByRole('dialog', { name: /WhatsApp offer prepared/ });
    expect(within(prepared).getByLabelText('Message to send')).toHaveValue('Hi Ahmed, your offer OFF-2026-0012 is ready.');
    expect(within(prepared).getByRole('link', { name: /Open WhatsApp/ })).toHaveAttribute('href', waLink);
    expect(within(prepared).getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
    expect(prepared).toHaveTextContent('Prepared — not yet sent');
    await u.click(within(prepared).getByRole('button', { name: 'Confirm sent on WhatsApp' }));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/send', { channel: 'whatsapp', templateId: 't-wa-offer' });
    const r = await screen.findByRole('dialog', { name: /Offer sent/ });
    expect(r).toHaveTextContent('recorded the offer as Sent by WhatsApp');
  });
  it('E19 template errors come through by code', async () => {
    const u = userEvent.setup();
    serve('offer-approved');
    api.postApi.mockRejectedValueOnce(new ApiError(400, 'The template does not exist or is not active.', { code: 'OFFER_TEMPLATE_INVALID', message: 'The template does not exist or is not active.' }, { code: 'OFFER_TEMPLATE_INVALID' }));
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByLabelText(/Template/)).toHaveValue('t-wa-offer'));
    await u.click(within(d).getByRole('button', { name: 'Prepare WhatsApp offer' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('The template does not exist or is not active.');
  });
  it('E19 is disabled before approval', async () => {
    serve('offer-pending');
    renderFile('/applications/a1?drawer=send');
    expect(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Prepare WhatsApp offer' })).toBeDisabled();
  });
  it('E20 Accepted → PATCH status Accepted', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /^Accepted/ }));
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Accepted' }));
  });
  it('E20 Declined → PATCH status Declined (#11 closes the file as Rejected "Declined offer"); no revision', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /^Declined/ }));
    expect(within(d).getByText(/closes as Rejected — "Declined offer"/)).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    expect(within(d).getByText('Say what the candidate told you.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/Why they declined/), 'Took another offer');
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Declined', reason: 'Took another offer' }));
    expect(api.postApi).not.toHaveBeenCalledWith('/applications/a1/notes', expect.anything());
    expect(api.postApi).not.toHaveBeenCalledWith('/offers/o1/revisions', expect.anything());
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
  });
  it('E20 Expired → PATCH status Expired; the file stays in Offer', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /expired/ }));
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Expired' }));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
  });
  it('Expired offer: primary "New offer version" → POST revisions (components [], no pay)', async () => {
    const u = userEvent.setup();
    const r = fileResponses('offer-sent');
    const offer = { ...(r['/offers/o1'] as Record<string, unknown>), status: 'Expired' };
    serve('offer-sent', { '/offers': [offer], '/offers/o1': offer });
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'New offer version' }));
    const d = await screen.findByRole('dialog', { name: /New offer version/ });
    await u.clear(within(d).getByLabelText(/Start date/));
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-15');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/revisions', expect.objectContaining({ components: [], proposedJoiningDate: '2026-11-15T00:00:00.000Z' })));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
    expect(api.postApi).not.toHaveBeenCalledWith('/offers', expect.anything());
  });
  it('E20 Withdrawn → offer Withdrawn + file Rejected with "Withdrawn by candidate"', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /Withdrawn/ }));
    await u.type(within(d).getByLabelText(/Why they withdrew/), 'Took another job');
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Offer', expectedVersion: 7, reason: 'Withdrawn by candidate' }));
    expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Withdrawn', reason: 'Took another job' });
  });
  it('Offer card keeps manager approval distinct from candidate acceptance, and shows a sent-back draft', async () => {
    serve('offer-approved');
    const { unmount } = renderFile();
    const approved = await screen.findByRole('region', { name: 'Offer' });
    expect(within(approved).getByText('Approved — ready to send')).toBeInTheDocument();
    expect(within(approved).queryByText('Accepted')).not.toBeInTheDocument();
    expect(within(approved).queryByText('Approved')).not.toBeInTheDocument();
    unmount();

    serve('offer-accepted');
    const acceptedView = renderFile();
    const accepted = await screen.findByRole('region', { name: 'Offer' });
    expect(within(accepted).getByText('Accepted')).toBeInTheDocument();
    expect(within(accepted).queryByText('Approved — ready to send')).not.toBeInTheDocument();
    acceptedView.unmount();

    serve('offer-sentback');
    renderFile();
    const sentBack = await screen.findByRole('region', { name: 'Offer' });
    expect(within(sentBack).getByText('Sent back')).toBeInTheDocument();
    expect(within(sentBack).getByText('Draft')).toBeInTheDocument();
  });
});

describe('E21 Pre-hire / E22 Reject', () => {
  it('E21: required checks only — PUT joining-checks; submit stays disabled until every required check is verified', async () => {
    const u = userEvent.setup();
    serve('prehire');
    const after = (fileResponses('prehire')['/applications/a1/joining-checks'] as Array<Record<string, unknown>>).map((c) => (c.type === 'CONTRACT' ? { ...c, verified: true, verifiedBy: { id: 'u-mariam', name: 'Mariam Farag' }, verifiedAt: '2026-10-10T08:00:00.000Z' } : c));
    api.putApi.mockResolvedValue(after);
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('list', { name: 'Joining checks' })).toHaveTextContent('ID · verified by Mariam Farag, 9 Oct');
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeDisabled();
    expect(within(d).queryByRole('button', { name: 'Move to Joined' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Mark Contract verified' }));
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/applications/a1/joining-checks/CONTRACT', { verified: true }));
    expect(await within(d).findByRole('button', { name: 'Undo Contract verified' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeDisabled();
    expect(api.patchApi).not.toHaveBeenCalledWith(expect.stringMatching(/compliance/), expect.anything());
  });
  it('E21: a technical file lists only the checks it was given', async () => {
    const checks = (fileResponses('prehire-done')['/applications/a1/joining-checks'] as Array<Record<string, unknown>>).filter((c) => c.type !== 'SCFHS_LICENCE');
    serve('prehire-done', { '/applications/a1/joining-checks': checks });
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    const list = within(d).getByRole('list', { name: 'Joining checks' });
    expect(list).toHaveTextContent('ID');
    expect(list).toHaveTextContent('Contract');
    expect(list).not.toHaveTextContent('SCFHS');
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeEnabled();
  });
  it('E21: all required checks verified submits for final approval and does not mark Joined', async () => {
    const u = userEvent.setup();
    serve('prehire-done');
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit for final approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/hiring/h1/submit', {}));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
    expect(api.postApi).not.toHaveBeenCalledWith('/hiring/h1/joining', expect.anything());
  });
  it('E21: the responsible recruiter records joining once; a 409 still names the missing check', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const hiring = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': hiring });
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'x', { statusCode: 409, code: 'GATE_JOINING_CHECKS_INCOMPLETE', gate: 'joining-checks', missing: ['SCFHS_LICENCE'], message: 'x' }, { code: 'GATE_JOINING_CHECKS_INCOMPLETE' }));
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Record actual joining' }));
    expect(api.postApi).toHaveBeenCalledWith('/hiring/h1/joining', expect.objectContaining({ status: 'Joined' }));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Missing: SCFHS licence.');
  });
  it('E21: a second record does not claim another hire', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const hiring = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': hiring });
    api.postApi.mockResolvedValueOnce({ success: true, alreadyJoined: true });
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Record actual joining' }));
    expect(await within(d).findByRole('status')).toHaveTextContent('The completed-hire count did not change.');
  });
  it('E21: entering an explicit actual joining date sends that date to POST /hiring/:id/joining', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const hiring = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': hiring });
    api.postApi.mockResolvedValueOnce({ success: true, alreadyJoined: false });
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    const dateInput = within(d).getByLabelText(/Actual joining date/);
    await u.clear(dateInput);
    await u.type(dateInput, '2026-10-12');
    await u.click(within(d).getByRole('button', { name: 'Record actual joining' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/hiring/h1/joining', { status: 'Joined', actualJoiningDate: '2026-10-12T00:00:00.000Z' }));
  });
  it('E21: a licence check sends its expiry date', async () => {
    const u = userEvent.setup();
    serve('prehire');
    api.putApi.mockResolvedValue(fileResponses('prehire')['/applications/a1/joining-checks']);
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Mark SCFHS licence verified' })).toBeDisabled();
    await u.type(within(d).getByLabelText(/SCFHS licence expiry/), '2027-06-01');
    await u.click(within(d).getByRole('button', { name: 'Mark SCFHS licence verified' }));
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/applications/a1/joining-checks/SCFHS_LICENCE', { verified: true, expiryDate: '2027-06-01T00:00:00.000Z' }));
  });
  it('E21 from Offer: gated on acceptance, then moves to Pre-hire and opens the hiring case', async () => {
    const u = userEvent.setup();
    serve('offer-accepted');
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Move to Pre-hire' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/hiring', { offerId: 'o1' }));
    expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Pre-Hire', expectedStage: 'Offer', expectedVersion: 7 });
  });
  it('PreHireDrawer names the final approver, then the responsible recruiter, as the waiting actor', async () => {
    const pending = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Pending Final Approval' }));
    serve('prehire-done', { '/hiring': pending });
    const pendingView = renderFile('/applications/a1?drawer=prehire');
    const waiting = await screen.findByRole('dialog');
    expect(waiting).toHaveTextContent('Submitted for final hiring approval. Waiting on the final hiring approver before the responsible recruiter can record actual joining.');
    expect(within(waiting).getByRole('button', { name: 'Waiting for final approval' })).toBeDisabled();
    pendingView.unmount();

    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const awaiting = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': awaiting });
    const recordView = renderFile('/applications/a1?drawer=prehire');
    expect(await screen.findByRole('dialog')).toHaveTextContent('Final hiring approval is complete. Record actual joining once the candidate starts.');
    recordView.unmount();

    authState.user.permissions = [];
    serve('prehire-done', { '/hiring': awaiting });
    renderFile('/applications/a1?drawer=prehire');
    const queued = await screen.findByRole('dialog');
    expect(queued).toHaveTextContent('Final hiring approval is complete. Waiting on the responsible recruiter to record actual joining.');
    expect(within(queued).getByRole('button', { name: 'Waiting for the responsible recruiter' })).toBeDisabled();
  });
  it('E22: reason required, list from master data + system reasons, PATCH stage Rejected with reason', async () => {
    const u = userEvent.setup();
    serve('screened');
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(within(d).getByText(/Pick a reason/)).toBeInTheDocument();
    await within(d).findByRole('option', { name: 'Not enough experience' });
    expect(within(d).getByRole('option', { name: 'Withdrawn by candidate' })).toBeInTheDocument();
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Screening', expectedVersion: 7, reason: 'Not enough experience' }));
  });
  it('E22: GATE_REJECT_REASON_REQUIRED from the server is shown inline', async () => {
    const u = userEvent.setup();
    serve('screened');
    const msg = '"Too far" is not in the rejection reasons list.';
    api.patchApi.mockRejectedValue(new ApiError(409, msg, { statusCode: 409, code: 'GATE_REJECT_REASON_REQUIRED', gate: 'reject-reason', missing: ['reason'], message: msg }, { code: 'GATE_REJECT_REASON_REQUIRED' }));
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await within(d).findByRole('option', { name: 'Not enough experience' });
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Rejected needs a reason from the rejection reasons list.');
  });
});

describe('application workspace navigation', () => {
  const returnHref = '/vacancies/j1?stage=Interview';

  it('moves within the authorized source set and keeps the job filter on the link', async () => {
    serve('interview');
    savePipelineSourceSet({ vacancyId: 'j1', applicationIds: ['a0', 'a1', 'a2'], returnHref });
    const middle = renderFile(`/applications/a1?returnTo=${encodeURIComponent(returnHref)}`);
    const seq = await screen.findByRole('navigation', { name: 'Candidate sequence' });
    expect(seq).toHaveTextContent('2 of 3');
    const previous = within(seq).getByRole('link', { name: 'Previous candidate' });
    const next = within(seq).getByRole('link', { name: 'Next candidate' });
    expect(decodeURIComponent(previous.getAttribute('href') ?? '')).toBe(`/applications/a0?returnTo=${returnHref}`);
    expect(decodeURIComponent(next.getAttribute('href') ?? '')).toBe(`/applications/a2?returnTo=${returnHref}`);
    expect(screen.getByRole('link', { name: 'HRIS Developer pipeline' })).toHaveAttribute('href', returnHref);
    middle.unmount();

    savePipelineSourceSet({ vacancyId: 'j1', applicationIds: ['a1', 'a2'], returnHref });
    const first = renderFile(`/applications/a1?returnTo=${encodeURIComponent(returnHref)}`);
    const firstSeq = await screen.findByRole('navigation', { name: 'Candidate sequence' });
    expect(firstSeq).toHaveTextContent('1 of 2');
    expect(within(firstSeq).queryByRole('link', { name: 'Previous candidate' })).not.toBeInTheDocument();
    expect(within(firstSeq).getByText('Previous')).toHaveAttribute('aria-disabled', 'true');
    expect(decodeURIComponent(within(firstSeq).getByRole('link', { name: 'Next candidate' }).getAttribute('href') ?? '')).toBe(`/applications/a2?returnTo=${returnHref}`);
    first.unmount();

    savePipelineSourceSet({ vacancyId: 'j1', applicationIds: ['a0', 'a1'], returnHref });
    renderFile(`/applications/a1?returnTo=${encodeURIComponent(returnHref)}`);
    const lastSeq = await screen.findByRole('navigation', { name: 'Candidate sequence' });
    expect(lastSeq).toHaveTextContent('2 of 2');
    expect(within(lastSeq).queryByRole('link', { name: 'Next candidate' })).not.toBeInTheDocument();
    expect(within(lastSeq).getByText('Next')).toHaveAttribute('aria-disabled', 'true');
  });

  it('hides sequence links when the source set is another job or does not include this file', async () => {
    serve('interview');
    savePipelineSourceSet({ vacancyId: 'other-job', applicationIds: ['a0', 'a1', 'a2'], returnHref });
    const otherJob = renderFile(`/applications/a1?returnTo=${encodeURIComponent(returnHref)}`);
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Candidate sequence' })).not.toBeInTheDocument();
    otherJob.unmount();

    savePipelineSourceSet({ vacancyId: 'j1', applicationIds: ['a0', 'a2'], returnHref });
    const omitted = renderFile(`/applications/a1?returnTo=${encodeURIComponent(returnHref)}`);
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Candidate sequence' })).not.toBeInTheDocument();
    omitted.unmount();

    savePipelineSourceSet({ vacancyId: 'j1', applicationIds: ['a0', 'a1', 'a2'], returnHref });
    renderFile('/applications/a1');
    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Candidate sequence' })).not.toBeInTheDocument();
  });

  it('keeps one primary action and marks later stage tools as future', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    const bar = await screen.findByRole('group', { name: 'Smart actions' });
    expect(within(bar).getByRole('button', { name: 'Log screen' })).toHaveClass('rf2-btn--primary');
    await openMore(u);
    expect(within(bar).getByRole('button', { name: (value) => value === 'Schedule' })).toBeEnabled();
    expect(within(bar).getByRole('button', { name: 'Scorecard' })).toHaveAttribute('data-future', 'true');
    expect(within(bar).getByRole('button', { name: 'Offer' })).toHaveAttribute('data-future', 'true');
    expect(within(bar).getByRole('button', { name: 'Pre-hire' })).toHaveAttribute('data-future', 'true');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
  });

  it('keeps an unsaved note across a fresh open and a failed save, then clears it after saving', async () => {
    const u = userEvent.setup();
    serve('applied');
    const first = renderFile();
    await screen.findByRole('heading', { name: 'Ahmed Embaby', level: 2 });
    await openMore(u);
    await u.click(screen.getByRole('button', { name: 'Note' }));
    await u.type(screen.getByLabelText('Add a note'), 'Call back tomorrow');
    expect(sessionStorage.getItem('rf2:file-note-draft:a1')).toBe('Call back tomorrow');
    first.unmount();

    const second = renderFile();
    expect(await screen.findByLabelText('Add a note')).toHaveValue('Call back tomorrow');
    api.postApi.mockRejectedValueOnce(new ApiError(500, 'Could not save the note.'));
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Could not save the note.')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a note')).toHaveValue('Call back tomorrow');
    expect(sessionStorage.getItem('rf2:file-note-draft:a1')).toBe('Call back tomorrow');
    api.postApi.mockImplementation(async (p: string) => (p === '/offers' ? 'o1' : { id: 'h1', alreadyJoined: false }));
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/applications/a1/notes', { content: 'Call back tomorrow' }));
    expect(screen.getByLabelText('Add a note')).toHaveValue('');
    expect(sessionStorage.getItem('rf2:file-note-draft:a1')).toBeNull();
    second.unmount();
  });

  it('returns focus to the trigger when a drawer is cancelled', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    const trigger = await screen.findByRole('button', { name: 'Log screen' });
    await u.click(trigger);
    expect(await screen.findByRole('dialog', { name: /Log screen/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe('Truthful activity and evidence', () => {
  it('classifies system authors and automated alert text', () => {
    expect(isSystemNote({ authorId: null, authorName: null, content: 'hello' })).toBe(true);
    expect(isSystemNote({ authorId: null, authorName: '  ', content: 'hello' })).toBe(true);
    expect(isSystemNote({ authorId: null, authorName: 'System', content: 'hello' })).toBe(true);
    expect(isSystemNote({ authorId: 'u1', authorName: 'Automation', content: 'hello' })).toBe(true);
    expect(isSystemNote({ authorId: 'u1', authorName: 'Mariam Farag', content: '[System] digest' })).toBe(true);
    expect(isSystemNote({ authorId: 'u1', authorName: 'Mariam Farag', content: 'SLA breach on this file' })).toBe(true);
    expect(isSystemNote({ authorId: null, authorName: 'Mariam Farag', content: 'Called them.' })).toBe(false);
    expect(isSystemNote({ authorId: 'u1', authorName: 'Mariam Farag', content: 'Called them.' })).toBe(false);
  });

  it('shows a newer note or message first in the timeline', async () => {
    const notes = fileResponses('interview')['/applications/a1/notes'] as Array<Record<string, unknown>>;
    serve('interview', {
      '/applications/a1/notes': [
        ...notes,
        { id: 'n-panel', organizationId: 'o', applicationId: 'a1', authorId: 'u-mariam', authorName: 'Mariam Farag', content: 'Panel went well.', createdAt: '2026-10-10T09:00:00.000Z' },
      ],
      '/applications/a1/messages': {
        destination: 'local-test@recruitflow.local',
        templates: [],
        followUpDate: null,
        attempts: [{ id: 'm-new', templateId: 't1', templateName: 'Interview reminder', state: 'Sent', reason: 'Candidate asked for the time', retryOf: null, at: '2026-10-11T09:00:00.000Z' }],
      },
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    await waitFor(() => expect(chatter).toHaveTextContent('Message Sent: Interview reminder'));
    const items = within(chatter).getAllByRole('listitem');
    const nonSystem = items.filter((item) => !/System activity/.test(item.textContent ?? ''));
    expect(nonSystem[0]).toHaveTextContent('Message Sent: Interview reminder');
    expect(nonSystem[0]).toHaveTextContent('Candidate asked for the time');
    const moved = items.findIndex((item) => item.textContent?.includes('Moved Screening → Interview'));
    const note = items.findIndex((item) => item.textContent?.includes('Note by Mariam Farag') && item.textContent?.includes('Panel went well.'));
    const message = items.findIndex((item) => item.textContent?.includes('Message Sent: Interview reminder'));
    expect(message).toBeLessThan(note);
    expect(note).toBeLessThan(moved);
  });

  it('labels an automated stale alert as system activity and keeps it out of evidence and the newest recruiter event', async () => {
    const notes = fileResponses('interview')['/applications/a1/notes'] as Array<Record<string, unknown>>;
    serve('interview', {
      '/applications/a1/notes': [
        ...notes,
        { id: 'n-panel', organizationId: 'o', applicationId: 'a1', authorId: 'u-mariam', authorName: 'Mariam Farag', content: 'Panel went well.', createdAt: '2026-10-10T09:00:00.000Z' },
        { id: 'n-stale', organizationId: 'o', applicationId: 'a1', authorId: null, authorName: 'System', content: '[Automation] Stale applicant alert: no owner action for 14 days.', createdAt: '2026-10-20T08:00:00.000Z' },
      ],
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    await waitFor(() => expect(chatter).toHaveTextContent('System activity — automated stale alert'));
    const items = within(chatter).getAllByRole('listitem');
    const firstHuman = items.find((item) => !/System activity/.test(item.textContent ?? ''));
    expect(firstHuman).toHaveTextContent('Note by Mariam Farag');
    expect(firstHuman).toHaveTextContent('Panel went well.');
    expect(chatter).toHaveTextContent('[Automation] Stale applicant alert: no owner action for 14 days.');
    expandEvidence();
    const evidence = screen.getByRole('region', { name: 'Evidence and fit' });
    expect(evidence).not.toHaveTextContent('Stale applicant alert');
    expect(evidence).not.toHaveTextContent('System activity');
    expect(within(evidence).getByText('Panel went well.')).toBeInTheDocument();
    expect(within(evidence).getAllByText('Note · recorded by Mariam Farag').length).toBeGreaterThan(0);
    expect(within(evidence).getByText('Screening notes · recorded by Mariam Farag')).toBeInTheDocument();
  });

  it('shows a system alert first only when the file has no recruiter event', async () => {
    serve('applied', {
      '/applications/a1/history': [],
      '/applications/a1/notes': [{ id: 'n-only', organizationId: 'o', applicationId: 'a1', authorId: null, authorName: 'System', content: '[Automation] Stale applicant alert: waiting on a recruiter.', createdAt: '2026-10-04T08:00:00.000Z' }],
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    expect(within(chatter).getAllByRole('listitem')[0]).toHaveTextContent('System activity — automated stale alert');
    expect(chatter).toHaveTextContent('[Automation] Stale applicant alert: waiting on a recruiter.');
    expect(screen.getByRole('region', { name: 'Evidence and fit' })).toHaveTextContent('No screening note or fit evidence is recorded on this file yet.');
  });

  it('groups consecutive system alerts and still opens each one', async () => {
    const u = userEvent.setup();
    serve('applied', {
      '/applications/a1/history': [],
      '/applications/a1/notes': [
        { id: 'n-stale-1', organizationId: 'o', applicationId: 'a1', authorId: null, authorName: 'System', content: '[Automation] Stale applicant alert: first.', createdAt: '2026-10-04T08:00:00.000Z' },
        { id: 'n-stale-2', organizationId: 'o', applicationId: 'a1', authorId: null, authorName: 'System', content: '[Automation] Stale applicant alert: second.', createdAt: '2026-10-05T08:00:00.000Z' },
      ],
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    const show = within(chatter).getByRole('button', { name: 'Show full history (2 system alerts)' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(chatter).not.toHaveTextContent('Stale applicant alert: second.');
    await u.click(show);
    const opened = within(within(chatter).getByRole('list')).getAllByRole('listitem');
    expect(opened[0]).toHaveTextContent('Stale applicant alert: second.');
    expect(opened[1]).toHaveTextContent('Stale applicant alert: first.');
  });

  it('attributes submitted scorecards in manager mode and does not invent a fit percentage', async () => {
    const workspace = fileResponses('scored')['/applications/a1/workspace'] as { application: Record<string, unknown> };
    serve('scored', {
      '/applications/a1/workspace': {
        ...workspace,
        application: { ...workspace.application, matchScore: 91, fitSummary: 'Strong HRIS fit from the interview.' },
      },
    });
    document.documentElement.setAttribute('data-ui', 'v2');
    render(<MemoryRouter initialEntries={['/applications/a1']}><Routes><Route path="/applications/:id" element={<ApplicationFileV2 mode="manager" />} /></Routes></MemoryRouter>);
    const fit = await screen.findByRole('region', { name: 'Scorecards and fit' });
    expect(fit).toHaveTextContent('1 submitted · average 4 / 5');
    expect(fit).toHaveTextContent('1 Hire');
    expect(fit).toHaveTextContent('Strong HRIS fit from the interview.');
    expect(fit.textContent).not.toMatch(/fit\s+\d+\s*%/i);
    expect(document.body.textContent).not.toMatch(/91%|Fit 91%/);
    expandEvidence();
    const evidence = screen.getByRole('region', { name: 'Evidence and fit' });
    expect(within(evidence).getByText('Scorecard · recorded by Karim Hassan')).toBeInTheDocument();
    expect(within(evidence).getByText('Walked through payroll export design.')).toBeInTheDocument();
    expect(within(evidence).getByText('Fit summary on the file')).toBeInTheDocument();
    expect(within(evidence).getByText('Strong HRIS fit from the interview.')).toBeInTheDocument();
  });

  it('orders events that share a timestamp by title and detail, and drops identical projections', async () => {
    const history = fileResponses('interview')['/applications/a1/history'] as Array<Record<string, unknown>>;
    const tie = '2026-10-12T15:00:00.000Z';
    const duplicateMove = { id: 'h-dup', applicationId: 'a1', fromStage: 'Screening', toStage: 'Interview', changedByName: 'Mariam Farag', reason: 'Same instant', createdAt: '2026-10-05T12:00:00.000Z' };
    serve('interview', {
      '/applications/a1/history': [...history, duplicateMove, { ...duplicateMove, id: 'h-dup-2' }],
      '/applications/a1/notes': [
        { id: 'n-apple-old', authorId: 'u-amy', authorName: 'Amy Adel', content: 'Apple detail', createdAt: '2026-10-01T08:00:00.000Z' },
        { id: 'n-apple-1', authorId: 'u-amy', authorName: 'Amy Adel', content: 'Apple detail', createdAt: tie },
        { id: 'n-apple-2', authorId: 'u-amy', authorName: 'Amy Adel', content: 'Apple detail', createdAt: tie },
        { id: 'n-banana', authorId: 'u-amy', authorName: 'Amy Adel', content: 'Banana detail', createdAt: tie },
        { id: 'n-zebra', authorId: 'u-zoe', authorName: 'Zoe Adel', content: 'Zebra detail', createdAt: tie },
      ],
    });
    renderFile();
    const chatter = await screen.findByRole('list', { name: 'Chatter' });
    const items = within(chatter).getAllByRole('listitem');
    const tied = items.filter((item) => item.querySelector('time')?.getAttribute('dateTime') === tie);
    expect(tied.map((item) => item.textContent ?? '')).toEqual([
      expect.stringContaining('Note by Amy Adel'),
      expect.stringContaining('Note by Amy Adel'),
      expect.stringContaining('Note by Zoe Adel'),
    ]);
    expect(tied[0]).toHaveTextContent('Apple detail');
    expect(tied[1]).toHaveTextContent('Banana detail');
    expect(tied[2]).toHaveTextContent('Zebra detail');
    expect(items.filter((item) => item.textContent?.includes('Same instant'))).toHaveLength(1);
    expect(items.filter((item) => item.querySelector('time')?.getAttribute('dateTime') === tie && item.textContent?.includes('Apple detail'))).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Note by Amy Adel');
    expect(items[0]).toHaveTextContent('Apple detail');
    expect(items[0]).not.toHaveTextContent('Zebra detail');
    expandEvidence();
    const evidence = screen.getByRole('region', { name: 'Evidence and fit' });
    expect(within(evidence).getAllByText('Apple detail')).toHaveLength(1);
    expect(within(evidence).getByText('Banana detail')).toBeInTheDocument();
    expect(within(evidence).getByText('Zebra detail')).toBeInTheDocument();
    expect(within(evidence).getAllByText('Note · recorded by Amy Adel')).toHaveLength(2);
    expect(within(evidence).getByText('Note · recorded by Zoe Adel')).toBeInTheDocument();
  });

  it('W02/W05: non-panel recruiter sees panel progress + reminder action, and future interviews keep Schedule interview primary', async () => {
    const u = userEvent.setup();
    const interviews = fileResponses('interview')['/interviews'] as Array<Record<string, unknown>>;
    serve('interview', {
      '/interviews': [{
        ...interviews[0],
        status: 'Scheduled',
        scheduledStart: '2099-01-01T09:00:00.000Z',
        scheduledEnd: '2099-01-01T10:00:00.000Z',
        interviewerIds: ['u-karim'],
        attendees: [{ userId: 'u-karim', displayName: 'Karim Hassan', response: 'Confirmed' }],
      }],
    });
    api.postApi.mockResolvedValue({ sent: true });
    renderFile('/applications/a1?drawer=scorecard');
    const primary = await screen.findByRole('button', { name: 'Schedule interview' });
    expect(primary).toHaveClass('rf2-btn--primary');
    const d = await screen.findByRole('dialog', { name: /Scorecard/ });
    expect(within(d).getByText(/Only assigned interviewers on this panel can submit or revise a scorecard/)).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Submit scorecard' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Remind pending interviewers' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard-reminder', {}));
    expect(await within(d).findByText('Scorecard reminder sent to pending interviewers.')).toBeInTheDocument();
  });

  it('W03: DocumentHistory shows upload link status, matched document association, and issues/revokes a candidate upload link', async () => {
    const u = userEvent.setup();
    serve('interview', {
      '/applications/a1/document-history': {
        documents: [{ id: 'd1', type: 'Passport', name: 'Ahmed_Passport.pdf', uploadedAt: '2026-10-06T09:00:00.000Z', uploadedBy: { id: 'u-mariam', name: 'Mariam Farag' }, hasFile: true, version: 1 }],
        requests: [{
          id: 'req-1',
          documentType: 'Passport',
          at: '2026-10-05T09:00:00.000Z',
          status: 'Received',
          matchedDocumentId: 'd1',
          matchedDocumentName: 'Ahmed_Passport.pdf',
          associationKind: 'uploaded_after_request',
          deliveryMode: 'portal_link_active',
        }],
        portalLink: { status: 'none', expiresAt: null, portalPath: null },
      },
    });
    api.postApi.mockResolvedValueOnce({ status: 'active', expiresAt: '2026-10-20T09:00:00.000Z', portalPath: '/portal/tok-123' });
    renderFile('/applications/a1?tab=documents');
    const reqList = await screen.findByRole('list', { name: 'Document requests' });
    expect(reqList).toHaveTextContent('Passport requested · 5 Oct 2026');
    expect(reqList).toHaveTextContent('Upload link active · Uploaded after request (Ahmed_Passport.pdf)');
    expect(screen.queryByText(/does not create bytes for them/i)).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Issue upload link' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/applications/a1/document-portal-link', { action: 'issue' }));
    expect(await screen.findByText(/\/portal\/tok-123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy upload link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke upload link' })).toBeInTheDocument();
  });

  it('W06: partial withdrawal recovery after reload offers Finish withdrawal in AnswerDrawer', async () => {
    const u = userEvent.setup();
    const r = fileResponses('offer-sent');
    const offer = { ...(r['/offers/o1'] as Record<string, unknown>), status: 'Withdrawn', currentVersion: { ...((r['/offers/o1'] as { currentVersion: Record<string, unknown> }).currentVersion), status: 'Withdrawn' } };
    serve('offer-sent', { '/offers': [offer], '/offers/o1': offer });
    renderFile();
    const finishBtn = await screen.findByRole('button', { name: 'Finish withdrawal' });
    expect(finishBtn).toHaveClass('rf2-btn--primary');
    await u.click(finishBtn);
    const d = await screen.findByRole('dialog', { name: /Record answer/ });
    expect(within(d).getByText(/Offer status is already recorded as Withdrawn\. Submit to finish closing this file as Rejected\./)).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Offer', expectedVersion: 7, reason: 'Withdrawn by candidate' }));
    expect(api.patchApi).not.toHaveBeenCalledWith('/offers/o1/status', expect.anything());
  });
});
