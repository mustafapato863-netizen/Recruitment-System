import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../../api/__fixtures__/teamWork';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
const shellState = vi.hoisted(() => ({ setApprovalsCount: vi.fn() }));
const authState = vi.hoisted(() => ({
  user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: ['APPLICATION_VIEW'] as string[], roles: [{ code: 'HIRING_MANAGER' }] },
}));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock('../../../components/v2/shell/AppShellV2', async () => ({
  ...(await vi.importActual<object>('../../../components/v2/shell/AppShellV2')),
  useV2Shell: () => ({ setApprovalsCount: shellState.setApprovalsCount }),
}));
import { TeamWorkV2 } from '../TeamWorkV2';
import { cairoWeekBounds, compareTeamWorkload, interviewsThisWeekCount, reassignError, taskFor, type TeamFile } from '../../api/teamWork';

let responses: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  responses = { ...fx.teamPaths(), ...extra };
  api.getApi.mockImplementation(async (p: string) => {
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, `nf ${p}`);
  });
};
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; }
const renderAt = (path = '/team-work') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/team-work" element={<><TeamWorkV2 /><Loc /></>} /><Route path="/approvals" element={<><TeamWorkV2 /><Loc /></>} /></Routes></MemoryRouter>);
};
beforeEach(() => {
  vi.clearAllMocks();
  shellState.setApprovalsCount.mockReset();
  authState.user = { id: 'u-karim', displayName: 'Karim Hassan', permissions: ['APPLICATION_VIEW'], roles: [{ code: 'HIRING_MANAGER' }] };
  serve();
});
const PEOPLE = ['Mariam Farag', 'Noura Al-Dosari', 'Youssef Ibrahim'] as const;
const card = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;
const memberOf = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('article') as HTMLElement;
const rosterNames = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent).filter((name) => (PEOPLE as readonly string[]).includes(name ?? ''));
const summaryItem = (label: string) => within(screen.getByLabelText('Team summary')).getByText(label).closest('li') as HTMLElement;
const weekInterviews = () => interviewsThisWeekCount(Object.values(fx.apps).flat() as Array<{ interview?: { startAt: string } | null }>);
function mariamWithExtra() {
  const rows = structuredClone(fx.apps['u-mariam']) as Array<Record<string, unknown>>;
  const base = rows.find((row) => row.id === 'a2') as Record<string, unknown>;
  const candidate = { ...(base.candidate as Record<string, unknown>), id: 'c-a8', firstName: 'Extra', lastName: 'Person' };
  rows.push({ ...base, id: 'a8', applicationCode: 'APP-A8', candidateId: 'c-a8', stage: 'Applied', followUpDate: fx.day(5), gates: [], interview: null, candidate });
  return { data: rows, total: rows.length };
}
function mariamWithOpenCount(count: number) {
  const rows = structuredClone(fx.apps['u-mariam']).filter((row) => (row as Record<string, unknown>).stage !== 'Joined') as Array<Record<string, unknown>>;
  const base = rows[0];
  while (rows.length < count) {
    const id = `capacity-${rows.length + 1}`;
    const candidate = { ...(base.candidate as Record<string, unknown>), id: `c-${id}`, firstName: 'Capacity', lastName: String(rows.length + 1) };
    rows.push({ ...base, id, applicationCode: id, candidateId: candidate.id, candidate, stage: 'Applied', followUpDate: null, gates: [], interview: null });
  }
  return { data: rows, total: rows.length };
}

describe('Team work desk', () => {
  it('keeps one Team work heading and opens waiting items from the tab', async () => {
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.queryByText(/Open work of your/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Team work' })).toHaveLength(1);
    expect(screen.getByText("Oversee your team's workload, open items, and approvals.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redistribute work' })).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent(/Your reporting line appears here, including people who report through someone else/);
    expect(screen.getByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Youssef Ibrahim' })).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /Waiting on you/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=waiting');
    expect(screen.getByRole('heading', { name: 'Waiting on you' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review offer: Lina Hassan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team work' })).toBeInTheDocument();
  });

  it('keeps the waiting note as one line inside Waiting on you', async () => {
    serve({
      '/offers?status=Pending+Approval&pageSize=100': [],
      '/me/work?day=today': {
        date: fx.myWork.date,
        counts: { overdue: 0, today: 0, waitingOnOthers: 0 },
        overdue: [],
        dueToday: [],
        waitingOnOthers: [],
        targets: [],
        empty: true,
        emptyMessage: null,
        reminderWorkerHealthy: true,
      },
    });
    const u = userEvent.setup();
    renderAt('/team-work?tab=waiting');
    const waiting = (await screen.findByRole('heading', { name: 'Waiting on you' })).closest('section')!;
    const note = within(waiting).getByText('Nothing is waiting on your decision.');
    expect(note).toHaveTextContent(/^Nothing is waiting on your decision\.$/);
    expect(within(waiting).queryByRole('heading', { name: 'Nothing is waiting on your decision.' })).not.toBeInTheDocument();
    expect(within(waiting).getAllByRole('heading')).toHaveLength(1);
    await u.selectOptions(screen.getByLabelText('Decision type'), 'offers');
    expect(within(waiting).getByText('No decisions match this filter.')).toBeInTheDocument();
    expect(within(waiting).queryByText('Nothing is waiting on your decision.')).not.toBeInTheDocument();
  });
});

describe('M2 Team work', () => {
  it('prioritizes urgent workload, reconciles interview totals, hides closed files and pay; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt();
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.queryByText(/Open work of your/)).not.toBeInTheDocument();
    expect(rosterNames()).toEqual(['Noura Al-Dosari', 'Mariam Farag', 'Youssef Ibrahim']);
    expect(summaryItem('Team members')).toHaveTextContent('3');
    expect(summaryItem('Open items')).toHaveTextContent('8');
    expect(summaryItem('Overdue')).toHaveTextContent('3');
    expect(summaryItem('Overdue').querySelector('[data-tone="danger"]')).toBeTruthy();
    const memberInterviewTotal = Object.values(fx.apps).reduce(
      (sum, files) => sum + (interviewsThisWeekCount(files as TeamFile[]) ?? 0),
      0,
    );
    expect(weekInterviews()).toBe(memberInterviewTotal);
    expect(summaryItem('Interviews this week')).toHaveTextContent(String(memberInterviewTotal));
    expect(summaryItem('Interviews this week')).not.toHaveTextContent('—');
    await waitFor(() => expect(shellState.setApprovalsCount).toHaveBeenLastCalledWith(2));
    const m = memberOf('Mariam Farag');
    expect(m).toHaveTextContent('Recruiter-offshore');
    expect(m).toHaveTextContent('3 Open');
    expect(m).toHaveTextContent('1 Overdue');
    expect(m).toHaveTextContent(`${interviewsThisWeekCount(fx.apps['u-mariam'] as TeamFile[])} Interview`);
    expect(screen.queryByRole('columnheader', { name: 'Availability' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Team workload' })).not.toBeInTheDocument();
    expect(m).not.toHaveTextContent('Old Joiner');
    const lina = within(m).getByRole('link', { name: 'Follow-up overdue — Lina Hassan' });
    expect(lina).toHaveAttribute('href', '/applications/a3?returnTo=%2Fteam-work');
    expect(lina.closest('li')).toHaveTextContent('Overdue');
    expect(lina.closest('li')).toHaveTextContent('HRIS Developer · Offshore Cairo');
    expect(within(m).getByRole('link', { name: 'Follow up — Nourhan Sami' })).toHaveAttribute('href', '/applications/a2?returnTo=%2Fteam-work');
    expect(within(m).getByRole('link', { name: 'Follow up — Nourhan Sami' }).closest('li')).toHaveTextContent('Today');
    expect(memberOf('Noura Al-Dosari')).toHaveTextContent('3 Open');
    expect(memberOf('Noura Al-Dosari')).toHaveTextContent('2 Overdue');
    expect(memberOf('Youssef Ibrahim')).toHaveTextContent('2 Open');
    expect(memberOf('Youssef Ibrahim')).toHaveTextContent('0 Overdue');
    for (const title of [
      'Scorecard missing — Ahmed Embaby',
      'Follow-up overdue — Fahad Al-Qahtani',
      'Follow-up overdue — Sara Al-Otaibi',
      'Offer in progress — Hossam Nabil',
      'Interview — Rana Adel',
    ]) expect(screen.getByRole('link', { name: title })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Team members pages' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/62,?000|71,?500|858|EGP|40000/);
    expect(await axeViolations(container)).toEqual([]);
    await u.click(screen.getByRole('tab', { name: /Waiting on you/ }));
    const wait = screen.getByRole('heading', { name: 'Waiting on you' }).closest('section')!;
    expect(within(wait).getAllByRole('row')).toHaveLength(3);
    expect(within(wait).queryByRole('columnheader', { name: 'Site' })).toBeNull();
    expect(wait).toHaveTextContent(/Your scorecard — Ahmed Embaby, HRIS Developer.*Late/);
    expect(within(wait).getByRole('link', { name: 'Submit scorecard: Ahmed Embaby' })).toHaveAttribute('href', '/applications/a1?drawer=scorecard&interview=i1&returnTo=%2Fteam-work%3Ftab%3Dwaiting');
    expect(wait).toHaveTextContent(/Offer approval — Lina Hassan, HRIS Developer.*Offer v1 submitted by Mariam Farag/);
    expect(within(wait).getByRole('button', { name: 'Review offer: Lina Hassan' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('keeps the direct-report subtitle when every shown person reports to the signed-in user', async () => {
    serve({ '/users/assignable': fx.assignable.map((person) => ({ ...person, managerId: 'u-karim' })) });
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.queryByText(/Open work of your/)).not.toBeInTheDocument();
    expect(rosterNames()).toEqual(['Noura Al-Dosari', 'Mariam Farag', 'Youssef Ibrahim']);
    expect(screen.getByRole('note')).toHaveTextContent(/Your reporting line appears here, including people who report through someone else/);
    expect(screen.queryByText(/Your direct reports\./)).toBeNull();
  });
  it('a reporting line that is not all direct reports stays complete and is not labelled as direct reports', async () => {
    serve({
      '/users/assignable': [
        { id: 'u-mariam', displayName: 'Mariam Farag', status: 'Active', managerId: 'u-karim', roles: [{ code: 'ROLE_001', name: 'Recruiter-offshore' }] },
        { id: 'u-youssef', displayName: 'Youssef Ibrahim', status: 'Active', managerId: 'u-karim', roles: [{ code: 'ROLE_002', name: 'Recruiter-onshore' }] },
        { id: 'u-noura', displayName: 'Noura Al-Dosari', status: 'Active', managerId: 'u-mariam', roles: [{ code: 'ROLE_003', name: 'Recruiter-clinical' }] },
      ],
    });
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(screen.queryByText(/Open work of your/)).not.toBeInTheDocument();
    expect(rosterNames()).toEqual(['Noura Al-Dosari', 'Mariam Farag', 'Youssef Ibrahim']);
    expect(screen.getByRole('note')).toHaveTextContent(/people who report through someone else/);
    expect(screen.queryByText(/Your direct reports\./)).toBeNull();
    expect(screen.queryByText(/Your team, including indirect reports/)).toBeNull();
  });
  it('reporting-line totals stay put while job filters and View all change the lists', async () => {
    const u = userEvent.setup();
    renderAt();
    const summary = await screen.findByLabelText('Team summary');
    expect(within(summary).getByText('Overdue').closest('li')).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: 'Waiting on you 2' })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Job'), 'HRIS Developer');
    expect(screen.getByTestId('loc').textContent).toMatch(/job=HRIS(?:\+|%20)Developer/);
    expect(screen.getByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Youssef Ibrahim' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Noura Al-Dosari' })).toBeNull();
    expect(within(summary).getByText('Team members').closest('li')).toHaveTextContent('3');
    expect(within(summary).getByText('Open items').closest('li')).toHaveTextContent('8');
    expect(within(summary).getByText('Overdue').closest('li')).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: 'Waiting on you 2' })).toBeInTheDocument();
    expect(memberOf('Mariam Farag')).toHaveTextContent('3 Open');
    await u.selectOptions(screen.getByLabelText('Job'), '');
    await u.selectOptions(screen.getByLabelText('Item status'), 'overdue');
    expect(screen.queryByRole('heading', { name: 'Youssef Ibrahim' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(within(summary).getByText('Overdue').closest('li')).toHaveTextContent('3');
    await u.selectOptions(screen.getByLabelText('Item status'), '');
    await u.click(screen.getByRole('tab', { name: /Waiting on you/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=waiting');
    expect(screen.getByRole('heading', { name: 'Waiting on you' })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Decision type'), 'offers');
    expect(screen.getByRole('table')).toHaveTextContent('Lina Hassan');
    expect(screen.getByRole('table')).not.toHaveTextContent('Ahmed Embaby');
  });
  it('an empty reporting line says no team members are assigned', async () => {
    serve({ '/users/assignable': [] });
    renderAt();
    expect(await screen.findByText('No team members assigned')).toBeInTheDocument();
    expect(screen.getByText('People in your reporting line appear here with their open files.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mariam Farag' })).toBeNull();
    expect(screen.queryByRole('rowheader', { name: 'Mariam Farag' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Team members pages' })).not.toBeInTheDocument();
  });
  it('shows an empty member card when a person has no open items', async () => {
    serve({
      '/users/assignable': [...fx.assignable, { id: 'u-hana', displayName: 'Hana Adel', status: 'Active', roles: [] }],
      '/applications?primaryRecruiterId=u-hana&pageSize=100': { data: [], total: 0 },
    });
    renderAt();
    const empty = (await screen.findByRole('heading', { name: 'Hana Adel' })).closest('article')!;
    expect(empty).toHaveTextContent('No open items');
    expect(within(empty).getByRole('button', { name: 'Reassign: Hana Adel' })).toBeDisabled();
    expect(within(empty).queryByRole('link')).not.toBeInTheDocument();
    expect(within(empty).queryByRole('button', { name: /View all/ })).not.toBeInTheDocument();
  });
  it.each([[9, false], [10, true]] as const)('shows high-capacity warning at the 10-item boundary (%i open)', async (open, overloaded) => {
    serve({ '/applications?primaryRecruiterId=u-mariam&pageSize=100': mariamWithOpenCount(open) });
    renderAt();
    const member = (await screen.findByRole('heading', { name: 'Mariam Farag' })).closest('article')!;
    expect(member).toHaveTextContent(`${open} Open`);
    if (overloaded) expect(within(member).getByText('High capacity')).toBeInTheDocument();
    else expect(within(member).queryByText('High capacity')).not.toBeInTheDocument();
  });
  it('uses letter initials and a danger pill when a gate blocks the file', async () => {
    const youssef = structuredClone(fx.apps['u-youssef']) as Array<Record<string, unknown>>;
    const offer = youssef.find((row) => row.id === 'y2')!;
    offer.gates = [{ gate: 'offer-accepted', code: 'GATE_OFFER_NOT_ACCEPTED', met: false, missing: ['x'] }];
    serve({
      '/users/assignable': [
        ...fx.assignable,
        { id: 'u-zenah', displayName: 'Zenah (Recruiter)', status: 'Active', roles: [{ code: 'R', name: 'Recruiter' }] },
        { id: 'u-lady', displayName: 'Lady (Nursing Recruiter)', status: 'Active', roles: [{ code: 'R', name: 'Recruiter' }] },
      ],
      '/applications?primaryRecruiterId=u-zenah&pageSize=100': { data: [], total: 0 },
      '/applications?primaryRecruiterId=u-lady&pageSize=100': { data: [], total: 0 },
      '/applications?primaryRecruiterId=u-youssef&pageSize=100': { data: youssef, total: youssef.length },
    });
    renderAt();
    const zenah = (await screen.findByRole('heading', { name: 'Zenah' })).closest('article')!;
    const lady = screen.getByRole('heading', { name: 'Lady' }).closest('article')!;
    expect(zenah).toHaveTextContent('Recruiter');
    expect(zenah).not.toHaveTextContent('Zenah (Recruiter)');
    expect(lady).toHaveTextContent('Nursing Recruiter');
    expect(lady).not.toHaveTextContent('Lady (Nursing Recruiter)');
    expect(zenah.querySelector('.rf2-team__avatar')).toHaveTextContent('Z');
    expect(lady.querySelector('.rf2-team__avatar')).toHaveTextContent('L');
    expect(zenah.querySelector('.rf2-team__avatar')?.textContent).not.toMatch(/[^A-Z?]/);
    const blocked = screen.getByRole('link', { name: 'Offer not accepted yet — Hossam Nabil' }).closest('li')!;
    expect(blocked.querySelector('.rf2-chip')).toHaveTextContent('Needs review');
    expect(blocked.querySelector('.rf2-chip')).toHaveAttribute('data-tone', 'danger');
    expect(blocked.querySelector('.rf2-team__ticon')).toHaveAttribute('data-tone', 'danger');
    expect(blocked.querySelector('.rf2-chip svg')).toHaveClass('lucide-circle-alert');
    const scorecard = screen.getByRole('link', { name: 'Scorecard missing — Ahmed Embaby' }).closest('li')!;
    expect(scorecard.querySelector('.rf2-chip')).toHaveAttribute('data-tone', 'danger');
    expect(scorecard.querySelector('.rf2-chip svg')).toHaveClass('lucide-circle-alert');
  });
  it('paginates team members only when more than six are shown', async () => {
    const people = Array.from({ length: 7 }, (_, index) => ({
      id: `u-p${index}`,
      displayName: `Recruiter ${index + 1}`,
      status: 'Active',
      roles: [{ code: 'R', name: 'Recruiter' }],
    }));
    serve({
      '/users/assignable': people,
      ...Object.fromEntries(people.map((person) => [`/applications?primaryRecruiterId=${person.id}&pageSize=100`, { data: [], total: 0 }])),
    });
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Recruiter 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recruiter 6' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recruiter 7' })).not.toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Team members pages' });
    expect(pager).toHaveTextContent('Showing 1–6 of 7 team members');
    await u.click(within(pager).getByRole('button', { name: 'Page 2' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('page=2');
    expect(screen.getByRole('heading', { name: 'Recruiter 7' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recruiter 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Team members pages' })).toHaveTextContent('Showing 7–7 of 7 team members');
  });
  it('opens the reassign drawer for that person from the card', async () => {
    const u = userEvent.setup();
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'Reassign: Mariam Farag' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('reassign=u-mariam');
    const dialog = await screen.findByRole('dialog', { name: 'Reassign files on HRIS Developer' });
    expect(within(dialog).getByText('Current owner').parentElement).toHaveTextContent('Mariam Farag');
  });
  it('shows an em dash for interviews this week when schedules were not returned', async () => {
    const strip = (rows: unknown[]) => rows.map((row) => {
      const copy = { ...(row as Record<string, unknown>) };
      delete copy.interview;
      return copy;
    });
    serve({
      '/applications?primaryRecruiterId=u-mariam&pageSize=100': { data: strip(fx.apps['u-mariam']), total: fx.apps['u-mariam'].length },
      '/applications?primaryRecruiterId=u-youssef&pageSize=100': { data: strip(fx.apps['u-youssef']), total: fx.apps['u-youssef'].length },
      '/applications?primaryRecruiterId=u-noura&pageSize=100': { data: strip(fx.apps['u-noura']), total: fx.apps['u-noura'].length },
    });
    renderAt();
    const interviews = (await screen.findByLabelText('Team summary')).querySelector('li:last-child')!;
    expect(interviews).toHaveTextContent('Interviews this week');
    expect(interviews).toHaveTextContent('—');
    expect(interviews).toHaveTextContent('Interview schedule is not available yet.');
    expect(within(interviews as HTMLElement).getByText('—')).toBeInTheDocument();
    expect(within(interviews as HTMLElement).queryByText('0')).not.toBeInTheDocument();
  });
  it('reports list unavailable → honest empty state; offers list failing is not fatal', async () => {
    serve({ '/users/assignable': new ApiError(403, 'no') });
    renderAt();
    expect(await screen.findByText('Your reports list is not available')).toBeInTheDocument();
  });
  it('a failing files call → error with retry', async () => {
    serve({ '/applications?primaryRecruiterId=u-noura&pageSize=100': new ApiError(500, 'Server down') });
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    serve();
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mariam Farag')).toBeInTheDocument();
  });
  it('task rules and age: overdue › gate › offer › today › interview › next', () => {
    const base: TeamFile = { id: 'f', code: 'F', candidate: 'X', vacancyId: 'v', job: 'J', site: 'S', stage: 'Screening', followUpDate: null };
    const t = '2026-10-10';
    expect(taskFor({ ...base, followUpDate: '2026-10-09', stage: 'Offer', updatedAt: '2026-10-06T12:00:00.000Z' }, t))
      .toMatchObject({ kind: 'followup-overdue', tone: 'overdue', meta: 'J · S · 1d overdue' });
    expect(taskFor({ ...base, stage: 'Offer' }, t)).toMatchObject({ kind: 'offer', tone: 'waiting' });
    expect(taskFor({ ...base, followUpDate: t }, t)).toMatchObject({ kind: 'followup', tone: 'today' });
    expect(taskFor({ ...base, stage: 'Applied' }, t)).toMatchObject({ kind: 'next', tone: null, title: 'Applied — X' });
    expect(taskFor({ ...base, updatedAt: '2026-10-06T12:00:00.000Z' }, t).meta).toBe('J · S · 4d since update');
    expect(taskFor(base, t).meta).toBe('J · S');
  });
  it('counts current-week interviews on Cairo Sunday–Saturday boundaries', () => {
    expect(cairoWeekBounds('2026-10-10')).toEqual({ start: '2026-10-04', end: '2026-10-10' });
    expect(interviewsThisWeekCount([
      { interview: { startAt: '2026-10-03T22:30:00.000Z' } },
      { interview: { startAt: '2026-10-10T20:59:59.000Z' } },
      { interview: { startAt: '2026-10-10T21:00:00.000Z' } },
      { interview: null },
    ], '2026-10-10')).toBe(2);
    expect(interviewsThisWeekCount([{ interview: undefined }], '2026-10-10')).toBeNull();
  });
  it('sorts the team workload by overdue, open, current-week interviews and name', () => {
    const members = [
      { name: 'Sarah', overdueCount: 2, openCount: 12, interviewsCount: 1 },
      { name: 'Zayd', overdueCount: 2, openCount: 12, interviewsCount: 2 },
      { name: 'Amina', overdueCount: 2, openCount: 12, interviewsCount: 2 },
      { name: 'Sindu', overdueCount: 1, openCount: 5, interviewsCount: 0 },
      { name: 'Mona', overdueCount: 0, openCount: 0, interviewsCount: 0 },
    ];
    expect([...members].sort(compareTeamWorkload).map((member) => member.name)).toEqual(['Amina', 'Zayd', 'Sarah', 'Sindu', 'Mona']);
  });
});

describe('Compact workload review', () => {
  it('opens workload in a drawer without repeating the roster and returns keyboard focus on close', async () => {
    serve({ '/applications?primaryRecruiterId=u-mariam&pageSize=100': mariamWithExtra() });
    const u = userEvent.setup();
    const { baseElement } = renderAt();
    const trigger = await screen.findByRole('button', { name: 'View all 4' });
    await u.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Mariam Farag' });
    expect(screen.getByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Team workload' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Applications by job' })).toBeInTheDocument();
    expect(within(dialog).getByText(/4 active applications/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Owned jobs unavailable/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Old Joiner')).not.toBeInTheDocument();
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('preselects the reviewed job and keeps the review open when reassignment conflicts', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValue(new ApiError(409, 'Conflict', { code: 'REASSIGN_CONFLICT', message: 'Conflict' }, { code: 'REASSIGN_CONFLICT' }));
    renderAt('/team-work?workload=u-mariam');
    const workload = await screen.findByRole('dialog', { name: 'Mariam Farag' });
    await u.click(within(workload).getByRole('button', { name: 'Move applications: HRIS Developer' }));
    const dialog = screen.getByRole('dialog', { name: 'Redistribute applications' });
    expect(within(dialog).getByLabelText(/^Job/)).toHaveValue('v-hris-developer');
    await u.selectOptions(within(dialog).getByLabelText(/^New primary recruiter/), 'u-noura');
    await u.type(within(dialog).getByLabelText(/^Reason/), 'Share workload');
    await u.click(within(dialog).getByRole('button', { name: 'Review redistribution' }));
    expect(api.postApi).not.toHaveBeenCalled();
    await u.click(within(dialog).getByRole('button', { name: 'Confirm redistribution' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A file changed while reassigning; nothing was moved.');
    expect(screen.getByRole('dialog', { name: 'Redistribute applications' })).toBeInTheDocument();
    expect(memberOf('Mariam Farag')).toHaveTextContent('3 Open');
    expect(memberOf('Mariam Farag')).toHaveTextContent('1 Overdue');
    expect(screen.queryByText(/files moved from/)).not.toBeInTheDocument();
  });

  it('does not report a successful handoff when the server omits its result', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({});
    renderAt('/team-work?reassign=u-noura&handoff=job');
    const dialog = await screen.findByRole('dialog', { name: 'Redistribute applications' });
    await u.selectOptions(within(dialog).getByLabelText(/^New primary recruiter/), 'u-mariam');
    await u.type(within(dialog).getByLabelText(/^Reason/), 'Share workload');
    await u.click(within(dialog).getByRole('button', { name: 'Review redistribution' }));
    await u.click(within(dialog).getByRole('button', { name: 'Confirm redistribution' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not confirm this reassignment.');
    expect(screen.queryByText(/files moved from/)).not.toBeInTheDocument();
  });

  it('blocks a workload deep link outside the loaded team without showing another person’s files', async () => {
    renderAt('/team-work?workload=outside-team');
    const dialog = await screen.findByRole('dialog', { name: 'Recruiter workload' });
    expect(within(dialog).queryByRole('button', { name: /Move applications/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/permission|access/i)).toBeInTheDocument();
  });
});

describe('M06 Reassign (B7 POST /files/reassign)', () => {
  it('one file → applicationIds, new owner from my reports only, reason required; toast + reload; axe', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b1', toUserId: 'u-youssef', moved: [{ applicationId: 'a1', fromUserId: 'u-mariam' }], unchanged: [] });
    const { baseElement } = renderAt();
    await u.click(await screen.findByRole('button', { name: /^Mariam Farag$/ }));
    await u.click(screen.getByRole('button', { name: /^Reassign$/ }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText('Current owner').parentElement).toHaveTextContent('Mariam Farag');
    const to = within(d).getByLabelText(/^New primary recruiter/);
    expect(within(to).queryByRole('option', { name: /Mariam/ })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'One file' }));
    await u.selectOptions(within(d).getByLabelText(/^File/), 'a1');
    await u.selectOptions(to, 'u-youssef');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText(/A reason is required/)).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Reason/), 'Balance load');
    expect(within(d).getByRole('note')).toHaveTextContent('1 open file moves to Youssef Ibrahim’s Open jobs and My Work. Each file’s history records “Owner changed from Mariam Farag to Youssef Ibrahim by Karim Hassan”.');
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['a1'], toUserId: 'u-youssef', reason: 'Balance load' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 file moved from Mariam Farag to Youssef Ibrahim.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }, 10000);
  it('redistributes one job’s applications only after choosing a source and reviewing the handoff', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b', toUserId: 'u-mariam', moved: [{ applicationId: 'n1' }, { applicationId: 'n2' }, { applicationId: 'n3' }], unchanged: [] });
    renderAt('/team-work?handoff=pick');
    const picker = await screen.findByRole('dialog', { name: 'Redistribute work' });
    expect(screen.getByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Team workload' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(within(picker).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await u.selectOptions(within(picker).getByLabelText('Current recruiter'), 'u-noura');
    await u.click(within(picker).getByRole('button', { name: 'Continue' }));
    const dialog = screen.getByRole('dialog', { name: 'Redistribute applications' });
    expect(within(dialog).queryByRole('button', { name: 'One file' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'All their files' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Confirm redistribution' })).toBeNull();
    await u.selectOptions(within(dialog).getByLabelText(/^New primary recruiter/), 'u-mariam');
    expect(within(dialog).getByText(/Mariam Farag: 3 active applications · 1 overdue/)).toBeInTheDocument();
    await u.type(within(dialog).getByLabelText(/^Reason/), 'Balance workload');
    await u.click(within(dialog).getByRole('button', { name: 'Review redistribution' }));
    expect(api.postApi).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('list', { name: 'Affected files' }).children).toHaveLength(3);
    expect(within(dialog).getByText(/owner will not change/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Confirm redistribution' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledExactlyOnceWith('/files/reassign', { applicationIds: ['n1', 'n2', 'n3'], toUserId: 'u-mariam', reason: 'Balance workload' }));
    expect(await screen.findByRole('status')).toHaveTextContent('3 files moved from Noura Al-Dosari to Mariam Farag.');
  });
  it('whole job → that report’s open files on the job; all their files → fromUserId', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b', toUserId: 'u-mariam', moved: [{ applicationId: 'n1' }, { applicationId: 'n2' }, { applicationId: 'n3' }], unchanged: [] });
    renderAt('/team-work?reassign=u-noura');
    const d = await screen.findByRole('dialog', { name: 'Reassign files on Radiology Technician' });
    expect(within(d).getByRole('button', { name: 'All files on a job' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('note')).toHaveTextContent('3 open files move');
    expect(within(d).getByRole('note')).toHaveTextContent('Only files move: the job and its owner stay as they are.');
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-mariam');
    await u.type(within(d).getByLabelText(/^Reason/), 'Leave');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1', 'n2', 'n3'], toUserId: 'u-mariam', reason: 'Leave' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    serve();
    await u.click(await screen.findByRole('button', { name: /^Youssef Ibrahim$/ }));
    await u.click(screen.getByRole('button', { name: /^Reassign$/ }));
    const d2 = await screen.findByRole('dialog');
    await u.click(within(d2).getByRole('button', { name: 'All their files' }));
    await u.selectOptions(within(d2).getByLabelText(/^New primary recruiter/), 'u-noura');
    await u.type(within(d2).getByLabelText(/^Reason/), 'Moving to clinical');
    await u.click(within(d2).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenLastCalledWith('/files/reassign', { fromUserId: 'u-youssef', toUserId: 'u-noura', reason: 'Moving to clinical' }));
  });
  it('B7 codes land on the right field; nothing moved', async () => {
    const u = userEvent.setup();
    const err = (status: number, code: string, message: string) => new ApiError(status, message, { code, message }, { code });
    api.postApi.mockRejectedValueOnce(err(400, 'REASSIGN_TARGET_INELIGIBLE', 'The target must be an active, non-admin user.'))
      .mockRejectedValueOnce(err(409, 'REASSIGN_FILE_CLOSED', 'File APP-A1 is closed.'));
    renderAt('/team-work?reassign=u-mariam&file=a1');
    const d = await screen.findByRole('dialog', { name: 'Reassign Ahmed Embaby' });
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-noura');
    await u.type(within(d).getByLabelText(/^Reason/), 'Balance');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText('That person cannot own files (inactive or an administrator).')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText(/A closed file .* cannot move\. Nothing was moved\./)).toBeInTheDocument();
  });
  it('reassignError: all B7 codes, 403 fallback, message fallback', () => {
    const e = (code: string, s = 409) => new ApiError(s, 'm', { code }, { code });
    expect(reassignError(e('REASSIGN_ADMIN_FORBIDDEN', 403))).toMatchObject({ text: 'Administrators cannot reassign files.' });
    expect(reassignError(e('REASSIGN_NOT_MANAGER', 403))).toMatchObject({ field: 'what' });
    expect(reassignError(e('REASSIGN_REASON_REQUIRED', 400))).toMatchObject({ field: 'reason' });
    expect(reassignError(e('REASSIGN_CONFLICT'))).toMatchObject({ text: expect.stringMatching(/Reload/) });
    expect(reassignError(new ApiError(403, 'x'))).toMatchObject({ text: 'You do not have permission to reassign these files.' });
    expect(reassignError(new ApiError(500, 'Boom'))).toMatchObject({ text: 'Boom' });
  });
});

describe('M2 CoS follow-ups', () => {
  it('prefers GET /team/work for files (server counts, waiting incl. scorecards); people come from /users/assignable (#21); no per-report calls', async () => {
    serve({ '/team/work': fx.teamWorkApi });
    renderAt();
    // #21 B2-16: the roster is /users/assignable, so a report with nothing open on /team/work still has a row.
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(screen.queryByText(/Open work of your/)).not.toBeInTheDocument();
    const calls = api.getApi.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('/users/assignable');
    expect(calls.some((c) => c.startsWith('/applications?primaryRecruiterId='))).toBe(false);
    expect(memberOf('Mariam Farag')).toHaveTextContent('3 Open');
    expect(memberOf('Mariam Farag')).toHaveTextContent('1 Overdue');
    expect(memberOf('Noura Al-Dosari')).toHaveTextContent('No open items');
    await userEvent.setup().click(screen.getByRole('tab', { name: /Waiting on you/ }));
    const wait = screen.getByRole('heading', { name: 'Waiting on you' }).closest('section')!;
    expect(wait).toHaveTextContent(/Offer v2 submitted by Mariam Farag/);
    expect(wait).toHaveTextContent(/Your scorecard — Rana Adel, BI Data Analyst.*Late/);
  });
  it('team/work failing with 500 is an error (not a silent fallback)', async () => {
    serve({ '/team/work': new ApiError(500, 'Team work down') });
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Team work down');
  });
  it('reason list from master data (active only); Other needs a note; sent as the name', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/reassign-reasons': fx.reassignReasons });
    api.postApi.mockResolvedValue({ batchId: 'b', toUserId: 'u-youssef', moved: [{ applicationId: 'n1' }], unchanged: [] });
    renderAt('/team-work?reassign=u-noura&file=n1');
    const d = await screen.findByRole('dialog');
    const sel = await within(d).findByRole('combobox', { name: /^Reason/ });
    expect(within(sel).queryByRole('option', { name: 'Old reason' })).toBeNull();
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.selectOptions(sel, 'Other');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText('Say why (at least 3 characters).')).toBeInTheDocument();
    await u.selectOptions(sel, 'Leave');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1'], toUserId: 'u-youssef', reason: 'Leave' }));
  });
  it('#21: "Other" goes as reason "Other" + note (never "Other: …" in reason); REASON_REQUIRED lands on the note', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/reassign-reasons': fx.reassignReasons });
    api.postApi.mockRejectedValueOnce(new ApiError(400, '"Other" needs a short note.', { statusCode: 400, code: 'REASON_REQUIRED', message: '"Other" needs a short note.' }, { code: 'REASON_REQUIRED' }))
      .mockResolvedValue({ batchId: 'b', toUserId: 'u-youssef', moved: [{ applicationId: 'n1' }], unchanged: [] });
    renderAt('/team-work?reassign=u-noura&file=n1');
    const d = await screen.findByRole('dialog');
    const sel = await within(d).findByRole('combobox', { name: /^Reason/ });
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.selectOptions(sel, 'Other');
    await u.type(within(d).getByLabelText(/^Say why/), 'Covering a peak');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1'], toUserId: 'u-youssef', reason: 'Other', note: 'Covering a peak' }));
    expect(await within(d).findByText('"Other" needs a short note (at least 3 characters).')).toBeInTheDocument();
  });
});

describe('B2F-6 job Hold/Close for the owner’s manager', () => {
  const q = (o: Record<string, unknown>) => ({ code: 'VAC-1', branch: { id: 'b1', name: 'Cairo HQ' }, headcount: { approved: 2, joined: 0, remaining: 2 }, pipelineCounts: {}, needsActionCount: 0, health: null, lastActivity: null, nextAction: null, ...o });
  it('a report’s open jobs show Hold/Close; hold uses the hold list + holdUntil, close uses the close list + "Other" note', async () => {
    const u = userEvent.setup();
    serve({
      '/vacancies/work-queue?page=1&pageSize=100': { data: [
        q({ id: 'v1', title: 'HRIS Developer', status: 'Open', owner: { id: 'u-mariam', displayName: 'Mariam Farag' } }),
        q({ id: 'v2', title: 'Payroll Lead', status: 'On Hold', owner: { id: 'u-noura', displayName: 'Noura Al-Dosari' } }),
        q({ id: 'v3', title: 'Not my team', status: 'Open', owner: { id: 'u-x', displayName: 'X' } }),
        { id: 'v4', redacted: true, title: 'Redacted', branch: null, seats: { filled: 0, target: 1 } },
      ], total: 4 },
      '/master-data/catalog/hold-reasons': [{ id: 'h1', name: 'Budget review', status: 'Active' }, { id: 'h2', name: 'Other', status: 'Active' }],
      '/master-data/catalog/close-reasons': [{ id: 'c1', name: 'Filled internally', status: 'Active' }, { id: 'c2', name: 'Other', status: 'Active' }],
      '/vacancies/v1/status-history': [],
    });
    api.postApi.mockResolvedValue({ id: 'v1' });
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Not my team');
    expect(document.body).not.toHaveTextContent('Redacted');
    expect(screen.queryByRole('button', { name: 'Hold HRIS Developer' })).toBeNull();
    await u.click(screen.getByRole('button', { name: /^Noura Al-Dosari$/ }));
    await u.click(screen.getByRole('tab', { name: /Assignments/ }));
    const noura = screen.getByRole('heading', { name: 'Noura Al-Dosari' }).closest('section')!;
    expect(within(noura).queryByRole('button', { name: 'Hold Payroll Lead' })).toBeNull();
    expect(within(noura).getByRole('button', { name: 'Close Payroll Lead' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Back to Team work' }));
    await u.click(screen.getByRole('button', { name: /^Mariam Farag$/ }));
    await u.click(screen.getByRole('tab', { name: /Assignments/ }));
    const m = screen.getByRole('heading', { name: 'Mariam Farag' }).closest('section')!;
    expect(within(m).getByRole('button', { name: 'Hold HRIS Developer' })).toBeInTheDocument();
    expect(within(m).getByRole('button', { name: 'Close HRIS Developer' })).toBeInTheDocument();

    await u.click(within(m).getByRole('button', { name: 'Hold HRIS Developer' }));
    let d = await screen.findByRole('dialog');
    await u.selectOptions(await within(d).findByRole('combobox', { name: /reason/i }), 'Budget review');
    await u.type(within(d).getByLabelText(/until/i), '2099-01-15');
    await u.click(within(d).getByRole('button', { name: /^Put on hold$|^Hold job$|^Hold$/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', expect.objectContaining({ reason: 'Budget review', holdUntil: '2099-01-15' })));

    await u.click(await within(card('Mariam Farag')).findByRole('button', { name: 'Close HRIS Developer' }));
    d = await screen.findByRole('dialog');
    await u.selectOptions(await within(d).findByRole('combobox', { name: /reason/i }), 'Other');
    await u.click(within(d).getByRole('button', { name: 'Close job' }));
    await u.click(within(d).getByRole('button', { name: /Confirm close/ }));
    expect(api.postApi).not.toHaveBeenCalledWith('/vacancies/v1/close', expect.anything());
    await u.type(within(d).getByLabelText(/note|why/i), 'Merged with another role');
    await u.click(within(d).getByRole('button', { name: 'Close job' }));
    await u.click(within(d).getByRole('button', { name: /Confirm close/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/close', expect.objectContaining({ reason: 'Other', note: 'Merged with another role' })));
  });
});

const pendingReq = {
  id: 'req-1', requestCode: 'REQ-1', status: 'Pending Approval' as const,
  branchId: 'b1', positionId: 'p1', requesterId: 'u-mariam', requesterName: 'Mariam Farag',
  positionTitle: 'Ward Nurse', branchName: 'SGH Jeddah', departmentName: 'Nursing',
  requestedHeadcount: 2, dueDate: '2026-12-01', justification: 'Cover a leaver',
  primaryRecruiter: { id: 'u-mariam', name: 'Mariam Farag' },
  createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z',
};
const changesReq = { ...pendingReq, id: 'req-2', requestCode: 'REQ-2', status: 'Changes Requested' as const, positionTitle: 'Lab Tech' };

describe('M01 recruiter details and M03 drilldown', () => {
  it('opens recruiter details from the card and returns to the team list', async () => {
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Mariam Farag' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /^Mariam Farag$/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('recruiter=u-mariam');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Mariam Farag']);
    expect(screen.queryByRole('heading', { name: 'Team work' })).not.toBeInTheDocument();
    const kpis = screen.getByRole('list', { name: 'Recruiter workload KPIs' });
    const items = within(kpis).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Open files3', 'Overdue1', 'Due today1', 'Waiting on candidate1']);
    expect(screen.getByText('Recruiter-offshore · Direct report')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getAllByRole('row').filter((row) => within(row).queryByText('Ahmed Embaby'))).toHaveLength(1);
    expect(table).not.toHaveTextContent('Old Joiner');
    expect(screen.getByRole('link', { name: 'Open Ahmed Embaby' })).toHaveAttribute('href', expect.stringContaining('/applications/a1?returnTo='));
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /Assignments/ }));
    expect(screen.getByRole('columnheader', { name: 'Site' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'File primary recruiter' })).toBeInTheDocument();
    expect(screen.getByText('Job ownership remains independent of application file reassignment.')).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /Recent activity/ }));
    expect(screen.getByText('Chronological authorized activity feed; no activity-based scoring.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Back to Team work' }));
    expect(screen.getByTestId('loc').textContent).not.toMatch(/recruiter=/);
    expect(rosterNames()).toEqual(['Noura Al-Dosari', 'Mariam Farag', 'Youssef Ibrahim']);
  });

  it('says when the recruiter is outside the reporting line, and names an indirect report', async () => {
    const first = renderAt('/team-work?recruiter=u-missing');
    expect(await screen.findByRole('alert')).toHaveTextContent('This recruiter is not in your reporting line.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to Team work' }));
    expect(screen.getByTestId('loc').textContent).not.toMatch(/recruiter=/);
    first.unmount();
    serve({
      '/users/assignable': [
        { id: 'u-mariam', displayName: 'Mariam Farag', status: 'Active', managerId: 'u-karim', roles: [{ code: 'ROLE_001', name: 'Recruiter-offshore' }] },
        { id: 'u-youssef', displayName: 'Youssef Ibrahim', status: 'Active', managerId: 'u-karim', roles: [{ code: 'ROLE_002', name: 'Recruiter-onshore' }] },
        { id: 'u-noura', displayName: 'Noura Al-Dosari', status: 'Active', managerId: 'u-mariam', roles: [{ code: 'ROLE_003', name: 'Recruiter-clinical' }] },
      ],
    });
    renderAt('/team-work?recruiter=u-noura');
    expect(await screen.findByRole('heading', { name: 'Noura Al-Dosari' })).toBeInTheDocument();
    expect(screen.getByText('Recruiter-clinical · Indirect report (reporting line)')).toBeInTheDocument();
  });
});

describe('M04 reassignment review', () => {
  it('reviews the move, keeps the selection, and confirms through the same reassign call', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b1', toUserId: 'u-youssef', moved: [{ applicationId: 'a1', fromUserId: 'u-mariam' }], unchanged: [] });
    renderAt('/team-work?reassign=u-mariam&file=a1');
    const d = await screen.findByRole('dialog', { name: 'Reassign Ahmed Embaby' });
    await u.click(within(d).getByRole('button', { name: 'Review reassignment' }));
    expect(within(d).getByText(/A reason is required/)).toBeInTheDocument();
    expect(within(d).queryByTestId('reassign-review-preview')).toBeNull();
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.type(within(d).getByLabelText(/^Reason/), 'Balance load');
    await u.click(within(d).getByRole('button', { name: 'Review reassignment' }));
    const preview = within(d).getByTestId('reassign-review-preview');
    expect(preview).toHaveTextContent('Ahmed Embaby — HRIS Developer');
    expect(preview).toHaveTextContent('Mariam Farag → Youssef Ibrahim');
    expect(preview).toHaveTextContent('Job/requisition owner will not change.');
    expect(preview).toHaveTextContent('Moving files updates primary recruiter access for the selected applications.');
    await u.click(within(d).getByRole('button', { name: 'Back from review' }));
    expect(within(d).queryByTestId('reassign-review-preview')).toBeNull();
    expect(within(d).getByLabelText(/^Reason/)).toHaveValue('Balance load');
    await u.click(within(d).getByRole('button', { name: 'Review reassignment' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm reassignment' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['a1'], toUserId: 'u-youssef', reason: 'Balance load' }));
  });
});

describe('M02 waiting queue and M10 approval decision', () => {
  it('keeps summary chips out of the heading list and previews a disabled decision', async () => {
    const u = userEvent.setup();
    renderAt('/team-work?tab=waiting&approval=sample');
    const waiting = (await screen.findByRole('heading', { name: 'Waiting on you' })).closest('section')!;
    expect(within(waiting).getAllByRole('heading')).toHaveLength(1);
    expect(within(waiting).getByText('Offer approvals 1')).toBeInTheDocument();
    expect(within(waiting).getByText('Requisition approvals 0')).toBeInTheDocument();
    expect(within(waiting).getByText('Changes requested 0')).toBeInTheDocument();
    expect(within(waiting).queryByRole('columnheader', { name: 'Site' })).toBeNull();
    expect(within(waiting).getByRole('button', { name: 'Preview approval decision screen' })).toBeInTheDocument();
    const decision = screen.getByRole('region', { name: 'Approval decision' });
    expect(decision).toHaveTextContent('SAMPLE / preview mode — Nothing is currently waiting in your live approval queue');
    expect(decision).toHaveTextContent('Team work / Waiting on you / Approval decision');
    expect(within(decision).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(within(decision).getByRole('button', { name: 'Return for changes' })).toBeDisabled();
    expect(within(decision).getByRole('button', { name: 'Decline' })).toBeDisabled();
    await u.click(within(decision).getByRole('button', { name: 'Approve' }));
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('lists a pending requisition and confirms a return before writing', async () => {
    authState.user = { ...authState.user, permissions: ['APPLICATION_VIEW', 'VACANCY_REQUEST_VIEW'] };
    serve({ '/vacancy-requests': [pendingReq, changesReq] });
    api.postApi.mockResolvedValue({ ...pendingReq, status: 'Changes Requested' });
    const u = userEvent.setup();
    renderAt('/team-work?tab=waiting');
    const waiting = (await screen.findByRole('heading', { name: 'Waiting on you' })).closest('section')!;
    expect(await within(waiting).findByText('Ward Nurse (REQ-1) · SGH Jeddah')).toBeInTheDocument();
    expect(within(waiting).queryByText('Lab Tech (REQ-2) · SGH Jeddah')).toBeNull();
    expect(within(waiting).getByText('Requisition approvals 1')).toBeInTheDocument();
    expect(within(waiting).getByText('Changes requested 1')).toBeInTheDocument();
    expect(within(waiting).queryByRole('columnheader', { name: 'Site' })).toBeNull();
    expect(within(waiting).getAllByRole('heading')).toHaveLength(1);
    await u.click(within(waiting).getByRole('button', { name: 'Review' }));
    const decision = await screen.findByRole('region', { name: 'Approval decision' });
    expect(decision).toHaveTextContent('Draft → Submitted → Pending Approval');
    expect(within(decision).getByText('Cover a leaver')).toBeInTheDocument();
    expect(within(decision).getByRole('link', { name: 'View related requisition' })).toHaveAttribute('href', '/vacancy-requests?req=req-1');
    await u.type(within(decision).getByLabelText(/Reason \/ comment/), '   ');
    await u.click(within(decision).getByRole('button', { name: 'Return for changes' }));
    expect(await within(decision).findByText('A reason of at least 3 characters is required.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.clear(within(decision).getByLabelText(/Reason \/ comment/));
    await u.type(within(decision).getByLabelText(/Reason \/ comment/), 'Fix the site');
    await u.click(within(decision).getByRole('button', { name: 'Return for changes' }));
    expect(within(decision).getByText('Pending Approval → Changes Requested. The requester can edit and resubmit. No job is opened.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.click(within(decision).getByRole('button', { name: 'Confirm return' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/req-1/request-changes', { comment: 'Fix the site' }));
  });
});

describe('M01 to M03 to M04', () => {
  it('opens recruiter details, walks the workload tabs, and previews a reassignment', async () => {
    const u = userEvent.setup();
    renderAt();
    await u.click(await screen.findByRole('button', { name: /^Mariam Farag$/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('recruiter=u-mariam');
    const kpis = screen.getByRole('list', { name: 'Recruiter workload KPIs' });
    expect(within(kpis).getByText('Open files')).toBeInTheDocument();
    expect(within(kpis).getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Open files/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /Overdue/ }));
    expect(screen.getByRole('tab', { name: /Overdue/ })).toHaveAttribute('aria-selected', 'true');
    await u.click(screen.getByRole('tab', { name: /Assignments/ }));
    expect(screen.getByText('Job ownership remains independent of application file reassignment.')).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /Recent activity/ }));
    expect(screen.getByText('Chronological authorized activity feed; no activity-based scoring.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /^Reassign$/ }));
    const dialog = await screen.findByRole('dialog');
    await u.selectOptions(within(dialog).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.type(within(dialog).getByLabelText(/^Reason/), 'Balance load');
    await u.click(within(dialog).getByRole('button', { name: 'Review reassignment' }));
    const preview = within(dialog).getByTestId('reassign-review-preview');
    expect(preview).toHaveTextContent('Ahmed Embaby — HRIS Developer');
    expect(preview).toHaveTextContent('Mariam Farag → Youssef Ibrahim');
    expect(preview).toHaveTextContent('Job/requisition owner will not change.');
  });

  it('supports activity period filtering, search, and KPI summaries on team activity tab', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/team-work?tab=activity');
    expect(await screen.findByRole('radiogroup', { name: 'Activity tracking period' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /All activity/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Last 7 days/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Last 30 days/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter activity/)).toBeInTheDocument();
    expect(screen.getByText('In selected period')).toBeInTheDocument();

    await u.click(screen.getByRole('radio', { name: /Last 7 days/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('period=7d');

    const searchInput = screen.getByLabelText(/Filter activity/);
    await u.type(searchInput, 'NonExistentCandidateOrJob12345');
    expect(screen.getByText('No activity for this period')).toBeInTheDocument();

    await u.clear(searchInput);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('M02 to M10', () => {
  it('opens a live approval from Waiting on you, requires a reason, and links the requisition', async () => {
    const u = userEvent.setup();
    const sample = renderAt('/team-work?tab=waiting&approval=sample');
    const preview = await screen.findByRole('region', { name: 'Approval decision' });
    expect(preview).toHaveTextContent('SAMPLE / preview mode — Nothing is currently waiting in your live approval queue');
    expect(within(preview).getByRole('button', { name: 'Return for changes' })).toBeDisabled();
    expect(within(preview).getByRole('button', { name: 'Decline' })).toBeDisabled();
    sample.unmount();

    authState.user = { ...authState.user, permissions: ['APPLICATION_VIEW', 'VACANCY_REQUEST_VIEW'] };
    serve({ '/vacancy-requests': [pendingReq] });
    renderAt('/team-work?tab=waiting');
    const waiting = (await screen.findByRole('heading', { name: 'Waiting on you' })).closest('section')!;
    expect(await within(waiting).findByText('Ward Nurse (REQ-1) · SGH Jeddah')).toBeInTheDocument();
    await u.click(within(waiting).getByRole('button', { name: 'Review' }));
    const decision = await screen.findByRole('region', { name: 'Approval decision' });
    expect(decision).not.toHaveTextContent('SAMPLE / preview mode');
    expect(within(decision).getByRole('link', { name: 'View related requisition' })).toHaveAttribute('href', '/vacancy-requests?req=req-1');
    await u.click(within(decision).getByRole('button', { name: 'Return for changes' }));
    expect(await within(decision).findByText('A reason of at least 3 characters is required.')).toBeInTheDocument();
    await u.click(within(decision).getByRole('button', { name: 'Decline' }));
    expect(within(decision).getByText('A reason of at least 3 characters is required.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(decision).getByLabelText(/Reason \/ comment/), 'Not a fit');
    await u.click(within(decision).getByRole('button', { name: 'Decline' }));
    expect(within(decision).getByText('Pending Approval → Rejected. The requisition closes. No job is opened.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('renders dedicated Approvals header and 3-card Approvals summary on /approvals', async () => {
    renderAt('/approvals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Approvals' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Team work' })).toBeNull();
    const summary = screen.getByRole('list', { name: 'Approvals summary' });
    expect(within(summary).getByText('Offer approvals')).toBeInTheDocument();
    expect(within(summary).getByText('Requisition approvals')).toBeInTheDocument();
    expect(within(summary).getByText('Scorecards due')).toBeInTheDocument();
  });
});
