import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { myWorkFixture } from '../../api/myWork.fixtures';
import type { MyWorkResponse, MyWorkResult, WorkItem } from '../../api/myWork';
import { MyWorkV2 } from '../MyWorkV2';

function LocationProbe() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }

const { authState, patchApi, fetchTargetsForPeriod, fetchMyWorkActivity } = vi.hoisted(() => ({
  authState: { user: { displayName: 'Mariam Farag' } as { displayName: string; id?: string; permissions?: string[] } },
  patchApi: vi.fn().mockResolvedValue({}),
  fetchTargetsForPeriod: vi.fn().mockResolvedValue({ targets: [] }),
  fetchMyWorkActivity: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../api/myResult', async () => ({ ...(await vi.importActual<object>('../../api/myResult')), fetchTargetsForPeriod }));
vi.mock('../../api/myWorkActivity', () => ({ fetchMyWorkActivity }));
vi.mock('../../../api/client', async () => {
  const actual = await vi.importActual<object>('../../../api/client');
  return { ...actual, patchApi };
});

type Variant = NonNullable<Parameters<typeof myWorkFixture>[0]>['variant'];
const ok = (variant?: Variant, source: MyWorkResult['source'] = 'api') => vi.fn(async (day: 'today' | 'tomorrow' = 'today'): Promise<MyWorkResult> => ({ data: myWorkFixture({ variant, day }), source }));

function renderPage(load: (day?: 'today' | 'tomorrow') => Promise<MyWorkResult>, path = '/my-work') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<><MyWorkV2 load={load as never} /><LocationProbe /></>} /></Routes></MemoryRouter>);
}
afterEach(() => {
  document.documentElement.removeAttribute('data-ui');
  authState.user = { displayName: 'Mariam Farag' };
  patchApi.mockReset();
  patchApi.mockResolvedValue({});
  fetchTargetsForPeriod.mockReset();
  fetchTargetsForPeriod.mockResolvedValue({ targets: [] });
  fetchMyWorkActivity.mockReset();
  fetchMyWorkActivity.mockResolvedValue([]);
});

function rowsIn(bucket: string) {
  return screen.getAllByTestId('work-row').filter((row) => row.getAttribute('data-bucket') === bucket);
}

describe('My Work desk', () => {
  it('greets by first name on the home desk, with the header as the only My Work', async () => {
    renderPage(ok());
    const welcome = screen.getByText('Welcome back, Mariam.');
    expect(screen.queryByText('Your next actions, ordered by urgency.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Next actions' })).not.toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Next actions' })).toHaveAttribute('aria-selected', 'true');
    const allTasks = screen.getByRole('button', { name: 'All tasks' });
    expect(allTasks).toHaveClass('rf2-btn--secondary', 'rf2-btn--md');
    expect(allTasks).toHaveAttribute('aria-pressed', 'true');
    const tabs = screen.getByRole('tablist', { name: 'My Work sections' });
    expect(welcome.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
  });

  it('fills the next action on the first Overdue, Today, and Waiting row', async () => {
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });

    const overdue = within(rowsIn('overdue')[0]!);
    expect(overdue.getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveClass('rf2-btn--primary');

    const today = within(rowsIn('dueToday')[0]!);
    expect(today.getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--primary');
    expect(today.getByRole('link', { name: 'Put on hold: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--tertiary');

    const waiting = within(rowsIn('waitingOnOthers')[0]!);
    expect(waiting.getByText('Salma Farouk — offer waiting on Karim Hassan')).toBeInTheDocument();
    expect(waiting.getByText("Waiting on Karim Hassan's approval")).toBeInTheDocument();
    expect(waiting.getByRole('link', { name: 'Open offer: Offer OFF-1' })).toHaveClass('rf2-btn--primary');
    const refused = waiting.getByRole('button', { name: 'Send offer' });
    expect(refused).toBeDisabled();
    expect(refused).toHaveAccessibleDescription('Waiting for approval');

    const laterToday = within(rowsIn('dueToday')[1]!);
    expect(laterToday.getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveClass('rf2-btn--secondary');
    expect(laterToday.getByRole('button', { name: 'Submit scorecard' })).toBeDisabled();

    const stillWaiting = within(rowsIn('waitingOnOthers')[1]!);
    expect(stillWaiting.getByText('Waiting on interviewer')).toBeInTheDocument();
    expect(stillWaiting.getByRole('link', { name: 'Open interview: Interview: Omar Said' })).toHaveClass('rf2-btn--tertiary');
    const gated = stillWaiting.getByRole('button', { name: 'Move to Offer' });
    expect(gated).toBeDisabled();
    expect(gated).toHaveAccessibleDescription('Gate not met: scorecard not submitted');

    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(3);
    expect(screen.queryByText(/caught up/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
    expect(screen.queryByText('No action for you')).not.toBeInTheDocument();
  });

  it('fills the first row of the bucket a recruiter filters to', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });

    await u.click(screen.getByRole('button', { name: '1 Overdue' }));
    expect(within(rowsIn('overdue')[0]!).getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveClass('rf2-btn--primary');
    expect(screen.queryByText('Screening: Nourhan Sami')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);

    await u.click(screen.getByRole('button', { name: '2 Today' }));
    expect(within(rowsIn('dueToday')[0]!).getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--primary');
    expect(within(rowsIn('dueToday')[1]!).getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveClass('rf2-btn--secondary');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);

    await u.click(screen.getByRole('button', { name: '2 Waiting' }));
    expect(within(rowsIn('waitingOnOthers')[0]!).getByRole('link', { name: 'Open offer: Offer OFF-1' })).toHaveClass('rf2-btn--primary');
    expect(within(rowsIn('waitingOnOthers')[1]!).getByRole('link', { name: 'Open interview: Interview: Omar Said' })).toHaveClass('rf2-btn--tertiary');
    expect(within(rowsIn('waitingOnOthers')[0]!).getByRole('button', { name: 'Send offer' })).toBeDisabled();
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
  });

  it('keeps one empty card, and the interview and joining sentences stay exact', async () => {
    const u = userEvent.setup();
    renderPage(ok('empty'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No open work assigned to you.' })).not.toBeInTheDocument();
    expect(screen.queryByText(/caught up/i)).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    expect(screen.getByRole('heading', { name: 'No upcoming interviews assigned to you.' })).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByRole('heading', { name: 'No joining dates on your accepted cases.' })).toBeInTheDocument();
    expect(screen.getByTestId('joining-footnote')).toHaveTextContent('Counts update after joining is confirmed. A scheduled start is not a completed hire.');
  });

  it('keeps the interview and joining row actions', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    const manage = screen.getByRole('link', { name: 'Manage interview: Nourhan Sami · HRIS Developer' });
    expect(manage).toHaveClass('rf2-btn--secondary');
    expect(manage).toHaveAttribute('href', '/applications/a2?drawer=schedule&interview=iv2&returnTo=%2Fmy-work%3Ftab%3Dinterviews');
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveClass('rf2-btn--secondary');
    expect(screen.getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', '/applications/a3?drawer=prehire&returnTo=%2Fmy-work%3Ftab%3Djoining');
    expect(screen.getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', '/applications/a8?drawer=prehire&returnTo=%2Fmy-work%3Ftab%3Djoining');
  });
});

describe('My Work (E02) from the #9 contract', () => {
  it('renders one urgency list and the three filters without repeating job cards', async () => {
    renderPage(ok());
    expect(await screen.findByRole('list', { name: 'Next actions' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
    expect(screen.queryByText('Your next actions, ordered by urgency.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Work' })).not.toBeInTheDocument();
    expect(screen.getByText('Today · 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Job: HRIS Developer' })).not.toBeInTheDocument();
    expect(screen.queryByText('Hire target')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');

    const list = screen.getByRole('list', { name: 'Next actions' });
    expect(rowsIn('overdue').map((row) => row.textContent?.includes('Interview: Ahmed Embaby'))).toEqual([true]);
    const overdue = within(rowsIn('overdue')[0]!);
    expect(overdue.getByText('Interview: Ahmed Embaby')).toBeInTheDocument();
    expect(overdue.getByText('Your scorecard is missing')).toBeInTheDocument();
    expect(overdue.getByTestId('candidate')).toHaveTextContent('Ahmed Embaby · Interview');
    expect(overdue.getByTestId('sla')).toHaveTextContent('Overdue');
    expect(overdue.getByTestId('due')).toHaveTextContent('Due 18 Oct');
    expect(overdue.getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveAttribute('href', '/applications/a1?drawer=scorecard&interview=i1&returnTo=%2Fmy-work');

    const todayRows = rowsIn('dueToday');
    const today = within(list);
    expect(today.getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveAttribute('href', '/vacancies/j1');
    expect(today.getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveAttribute('href', '/applications/a2?returnTo=%2Fmy-work');
    expect(today.getByText('19 Oct, 11:30–12:00')).toBeInTheDocument();
    expect(today.getByRole('link', { name: 'Room 2A' })).toHaveAttribute('href', 'https://rooms.sgh.test/2a');
    const disabled = today.getByRole('button', { name: 'Submit scorecard' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription('Interview has not ended');
    expect(disabled).toHaveAttribute('title', 'Interview has not ended');
    expect(today.getByRole('link', { name: 'Put on hold: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--tertiary');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(3);
    expect(today.getByRole('link', { name: /^Review applicants/ })).toHaveClass('rf2-btn--primary');
    expect(todayRows).toHaveLength(2);

    const waitingRows = rowsIn('waitingOnOthers');
    expect(within(waitingRows[0]!).getByText('Salma Farouk — offer waiting on Karim Hassan')).toBeInTheDocument();
    expect(within(waitingRows[0]!).getByText("Waiting on Karim Hassan's approval")).toBeInTheDocument();
    expect(within(waitingRows[0]!).getByText('Waiting on approval')).toBeInTheDocument();
    expect(within(waitingRows[1]!).getByText('Waiting on interviewer')).toBeInTheDocument();
    expect(within(waitingRows[1]!).getByText('2 scorecard(s) missing')).toBeInTheDocument();
    expect(within(waitingRows[0]!).getByRole('link', { name: 'Open offer: Offer OFF-1' })).toHaveAttribute('href', '/applications/a3?drawer=offer&returnTo=%2Fmy-work');
    expect(within(waitingRows[0]!).getByRole('button', { name: 'Send offer' })).toBeDisabled();
    expect(within(waitingRows[1]!).getByRole('link', { name: 'Open interview: Interview: Omar Said' })).toHaveAttribute('href', '/applications/a4?returnTo=%2Fmy-work');
    expect(within(waitingRows[1]!).getByRole('button', { name: 'Move to Offer' })).toBeDisabled();
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['1', '2', '2']);
    expect(counts.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: 'Overdue actions' })).getAllByTestId('work-row')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Today actions' })).getAllByTestId('work-row')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Waiting on others actions' })).getAllByTestId('work-row')).toHaveLength(2);
    expect(screen.queryByTestId('sample-data-note')).not.toBeInTheDocument();
  });

  it('keeps multiple job targets on the jobs desk instead of duplicating them above the queue', async () => {
    renderPage(ok('multi-target'));
    expect(await screen.findByRole('list', { name: 'Next actions' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your targets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Job:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
    expect(screen.queryByText('Your next actions, ordered by urgency.')).not.toBeInTheDocument();
  });

  it('worker stale: SLA chips hidden with a note; due facts still shown', async () => {
    const { container } = renderPage(ok('stale-worker'));
    expect(await screen.findByTestId('sla-hidden')).toHaveTextContent('SLA flags are hidden');
    expect(screen.queryAllByTestId('sla')).toHaveLength(0);
    expect(screen.getAllByTestId('due').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Google|Meet|self-schedule/i);
  });

  it('never shows pay', async () => {
    const { container } = renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    expect(container.textContent).not.toMatch(/salary|pay\b|AED|EGP|SAR|compensation/i);
  });

  it('sample-data notice in dev fixture mode', async () => {
    renderPage(ok(undefined, 'fixture'));
    expect(await screen.findByTestId('sample-data-note')).toBeInTheDocument();
  });

  it('Tomorrow (E05): switch syncs the URL, loads day=tomorrow, lists booked interviews with time, room URL and interviewers', async () => {
    const u = userEvent.setup();
    const load = ok();
    renderPage(load);
    await screen.findByRole('list', { name: 'Next actions' });
    expect(screen.getByRole('button', { name: 'Show today' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Show tomorrow' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/my-work?day=tomorrow');
    expect(load).toHaveBeenLastCalledWith('tomorrow');
    expect(await screen.findByText('Tomorrow · 20 Oct 2026')).toBeInTheDocument();
    const tomorrow = screen.getByRole('list', { name: 'Next actions' });
    expect(within(tomorrow).getByText('Tomorrow, 10:00–11:00')).toBeInTheDocument();
    expect(within(tomorrow).getByRole('link', { name: 'Room 4B' })).toHaveAttribute('href', 'https://rooms.sgh.test/4b');
    expect(within(tomorrow).getAllByTestId('interviewers')[0]).toHaveTextContent('With Dr. Hana Saleh, Kareem Fathy');
    expect(within(tomorrow).getByText('No room yet')).toBeInTheDocument();
    expect(within(rowsIn('dueToday')[0]!).getByTestId('sla')).toHaveTextContent('Due tomorrow');
    expect(screen.getByRole('button', { name: '2 Tomorrow' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Show today' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/);
  });

  it('deep link ?day=tomorrow loads tomorrow', async () => {
    const load = ok();
    renderPage(load, '/my-work?day=tomorrow');
    expect(await screen.findByRole('button', { name: '2 Tomorrow' })).toBeInTheDocument();
    expect(screen.getByText('Tomorrow, 10:00–11:00')).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith('tomorrow');
  });
});

describe('Empty (E03), loading, error, forbidden', () => {
  it('server empty: emptyMessage, no strip', async () => {
    renderPage(ok('empty'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your targets' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(screen.queryByRole('list', { name: 'Next actions' })).not.toBeInTheDocument();
  });
  it('shows the empty queue and jobs link without job cards when only hiring targets exist', async () => {
    renderPage(ok('targets-only'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Job: HRIS Developer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
    expect(screen.queryByText('Open files on your jobs that need you appear here.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Next actions' })).not.toBeInTheDocument();
  });
  it('loading skeleton', () => {
    renderPage(() => new Promise(() => {}));
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading your work…');
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
  });
  it('error with retry', async () => {
    const u = userEvent.setup();
    const load = vi.fn().mockRejectedValueOnce(new ApiError(500, 'Server exploded')).mockImplementation(async () => ({ data: myWorkFixture(), source: 'api' }));
    renderPage(load);
    const alert = await screen.findByRole('alert');
    await u.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Next actions' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('403 forbidden', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError(403, 'nope')));
    expect(await screen.findByText('You do not have access to My Work')).toBeInTheDocument();
  });
});

describe('focused daily queue', () => {
  it('keeps open jobs one click away and does not repeat the count filters', async () => {
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    expect(screen.queryByLabelText('Priority summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('definition')).not.toBeInTheDocument();
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((node) => node.textContent)).toEqual(['1', '2', '2']);
    expect(screen.getByRole('button', { name: '1 Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 Waiting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All tasks' })).toBeInTheDocument();
    expect(screen.queryByTestId('open-jobs-count')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Open pipeline/ })).not.toBeInTheDocument();
  });

  it('groups overdue, today, and waiting rows, and marks only the first action in each bucket', async () => {
    const u = userEvent.setup();
    const source = myWorkFixture();
    const offer = source.waitingOnOthers[0]!;
    const waitingOnOthers = [
      offer,
      source.waitingOnOthers[1]!,
      {
        ...offer,
        id: 'off-candidate',
        reason: 'Offer waiting for approval',
        waitingOn: 'candidate' as const,
        candidate: { id: 'c9', name: 'Lina Hassan' },
        approver: { id: 'u-karim', name: 'Karim Hassan' },
      },
    ];
    const data = { ...source, waitingOnOthers, counts: { ...source.counts, waitingOnOthers: waitingOnOthers.length } };
    renderPage(async () => ({ data, source: 'api' }));
    const list = await screen.findByRole('list', { name: 'Next actions' });
    expect(screen.getAllByRole('list', { name: 'Next actions' })).toHaveLength(1);

    const rows = within(list).getAllByTestId('work-row');
    const groups = rows.map((row) => row.getAttribute('data-priority-group'));
    expect(groups).toEqual(rows.map((row) => row.getAttribute('data-bucket')));
    const firstToday = groups.indexOf('dueToday');
    const firstWaiting = groups.indexOf('waitingOnOthers');
    expect(firstToday).toBeGreaterThan(0);
    expect(firstWaiting).toBeGreaterThan(firstToday);
    expect(groups.slice(0, firstToday).every((group) => group === 'overdue')).toBe(true);
    expect(groups.slice(firstToday, firstWaiting).every((group) => group === 'dueToday')).toBe(true);
    expect(groups.slice(firstWaiting).every((group) => group === 'waitingOnOthers')).toBe(true);
    expect(within(list).getAllByTestId('bucket-label').map((label) => label.textContent)).toEqual(['Overdue', 'Today', 'Waiting on others']);
    expect(within(list).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Overdue', 'Today', 'Waiting on others']);

    for (const bucket of ['overdue', 'dueToday', 'waitingOnOthers']) {
      const bucketRows = rows.filter((row) => row.getAttribute('data-bucket') === bucket);
      expect(bucketRows[0]!.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
      for (const row of bucketRows.slice(1)) expect(row.querySelector('.rf2-btn--primary')).not.toBeInTheDocument();
    }
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(3);
    expect(rowsIn('overdue')[0]!.querySelector('.rf2-task-row__icon')).toHaveAttribute('data-tone', 'danger');
    expect(rowsIn('dueToday')[0]!.querySelector('.rf2-task-row__icon')).toHaveAttribute('data-tone', 'info');

    const waiting = rowsIn('waitingOnOthers');
    expect(waiting).toHaveLength(3);
    for (const row of waiting) expect(row.querySelector('.rf2-task-row__icon')).toHaveAttribute('data-tone', 'warning');
    expect(within(waiting[0]!).getByText('Waiting on approval')).toBeInTheDocument();
    expect(within(waiting[0]!).getByRole('link', { name: 'Open offer: Offer OFF-1' })).toHaveClass('rf2-btn--primary');
    expect(within(waiting[0]!).getByRole('button', { name: 'Send offer' })).toBeDisabled();
    expect(within(waiting[0]!).queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(within(waiting[1]!).getByText('Waiting on interviewer')).toBeInTheDocument();
    expect(within(waiting[1]!).getByRole('button', { name: 'Move to Offer' })).toBeDisabled();
    expect(within(waiting[1]!).queryByRole('link', { name: /Submit scorecard/ })).not.toBeInTheDocument();
    const candidate = within(waiting[2]!);
    expect(candidate.getByText('Waiting on candidate')).toBeInTheDocument();
    expect(candidate.getByText('Lina Hassan — offer waiting on the candidate').textContent).not.toMatch(/approval/i);
    expect(candidate.getByRole('button', { name: 'Send offer' })).toBeDisabled();
    expect(candidate.queryByRole('link', { name: /Submit scorecard|Approve/ })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: '1 Overdue' }));
    expect(screen.queryByTestId('bucket-label')).not.toBeInTheDocument();
    expect(rowsIn('overdue')).toHaveLength(1);
    expect(rowsIn('overdue')[0]).toHaveAttribute('data-priority-group', 'overdue');
  });
});

describe('keyboard + a11y', () => {
  it('tab order reaches the queue directly after the target period and section controls', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.tab();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Show today' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Show tomorrow' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveFocus();
    await u.tab();
    expect(screen.queryByRole('link', { name: /My result/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Overdue' })).toHaveFocus();
    await u.tab();
    await u.tab();
    await u.tab();
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: /^Submit scorecard/ })).toHaveFocus();
  });
  it.each(['mariam', 'empty', 'targets-only', 'multi-target', 'stale-worker'] as const)('%s has no axe violations', async (variant) => {
    const { container } = renderPage(ok(variant));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('tabs, filters, and caller data', () => {
  it('selects each filter, resets with All tasks, and keeps the counts', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('button', { name: '1 Overdue' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('filter=overdue');
    expect(screen.getByRole('button', { name: '1 Overdue' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'false');
    expect(rowsIn('overdue')).toHaveLength(1);
    expect(screen.queryByText('Screening: Nourhan Sami')).not.toBeInTheDocument();
    expect(screen.queryByText('Salma Farouk — offer waiting on Karim Hassan')).not.toBeInTheDocument();
    expect(Array.from(screen.getByLabelText('Counts').querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['1', '2', '2']);
    await u.click(screen.getByRole('button', { name: '1 Overdue' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/);
    expect(screen.getAllByTestId('work-row')).toHaveLength(5);

    await u.click(screen.getByRole('button', { name: '2 Today' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('filter=today');
    expect(rowsIn('dueToday')).toHaveLength(2);
    expect(screen.queryByText('Interview: Ahmed Embaby')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);

    await u.click(screen.getByRole('button', { name: '2 Waiting' }));
    expect(rowsIn('waitingOnOthers')).toHaveLength(2);
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'All tasks' }));
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/);
    expect(screen.getAllByTestId('work-row')).toHaveLength(5);
  });

  it('a sent offer names the candidate and does not say it is waiting for approval', async () => {
    const data = myWorkFixture();
    const offer = data.waitingOnOthers[0]!;
    data.waitingOnOthers = [{
      ...offer,
      reason: 'Offer waiting for approval',
      waitingOn: 'candidate',
      candidate: { id: 'c9', name: 'Lina Hassan' },
      approver: { id: 'u-karim', name: 'Karim Hassan' },
    }, data.waitingOnOthers[1]!];
    renderPage(async () => ({ data, source: 'api' }));
    const row = within((await screen.findAllByTestId('work-row')).find((item) => item.getAttribute('data-bucket') === 'waitingOnOthers')!);
    expect(row.getByText('Lina Hassan — offer waiting on the candidate').textContent).not.toMatch(/approval/i);
    expect(row.getByText('Waiting on candidate').textContent).not.toMatch(/approval/i);
    expect(row.getByText('Waiting on Lina Hassan').textContent).not.toMatch(/approval/i);
    expect(row.getByRole('button', { name: 'Send offer' })).toHaveAccessibleDescription('Waiting for approval');
  });

  it('upcoming interviews keep file links and evaluation links apart, including a held job', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    const data = myWorkFixture();
    data.upcomingInterviews = [
      ...(data.upcomingInterviews ?? []),
      {
        id: 'iv-score', title: 'Ahmed Embaby · HRIS Developer', candidateName: 'Ahmed Embaby', jobTitle: 'HRIS Developer',
        startAt: '2026-10-18T08:00:00.000Z', endAt: '2026-10-18T09:00:00.000Z', room: { name: null, url: null }, interviewers: [],
        access: 'file', applicationId: 'a1', held: false, status: 'scorecard_overdue',
        action: { key: 'open-interview', label: 'View scorecard', disabled: false },
      },
      {
        id: 'iv-assigned-score', title: 'Hana Adel · BI Data Analyst', candidateName: 'Hana Adel', jobTitle: 'BI Data Analyst',
        startAt: '2026-10-18T07:00:00.000Z', endAt: '2026-10-18T08:00:00.000Z', room: { name: null, url: null }, interviewers: [],
        access: 'evaluation', held: false, status: 'scorecard_overdue',
        action: { key: 'submit-scorecard', label: 'Submit scorecard', disabled: false },
      },
    ];
    renderPage(async () => ({ data, source: 'api' }));
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=interviews');
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming interviews assigned to you or your candidates.')).not.toBeInTheDocument();
    const schedule = screen.getByRole('region', { name: 'Interview schedule' });
    expect(within(schedule).getByRole('link', { name: 'Manage interview: Nourhan Sami · HRIS Developer' })).toHaveAttribute('href', '/applications/a2?drawer=schedule&interview=iv2&returnTo=%2Fmy-work%3Ftab%3Dinterviews');
    expect(within(schedule).getByRole('link', { name: 'View scorecard: Ahmed Embaby · HRIS Developer' })).toHaveAttribute('href', '/applications/a1?drawer=scorecard&interview=iv-score&returnTo=%2Fmy-work%3Ftab%3Dinterviews');
    expect(within(schedule).getByRole('link', { name: 'Room 2A' })).toHaveAttribute('href', 'https://rooms.sgh.test/2a');
    expect(within(schedule).getByText(/19 Oct · 11:30–12:00/)).toBeInTheDocument();
    const held = within(schedule).getByText('Youssef Hamdy · Data Analyst').closest('li')!;
    expect(within(held).getByText(/On hold/)).toBeInTheDocument();
    expect(within(held).getByRole('link', { name: 'Manage interview: Youssef Hamdy · Data Analyst' })).toHaveAttribute('href', '/applications/a6?drawer=schedule&interview=iv-held&returnTo=%2Fmy-work%3Ftab%3Dinterviews');
    const assigned = screen.getByRole('region', { name: 'Your assigned interviews' });
    const evaluation = within(assigned).getByRole('link', { name: 'Open evaluation: Rana Adel · BI Data Analyst' });
    expect(evaluation).toHaveAttribute('href', '/my-interviews?interview=iv-assigned');
    expect(evaluation.getAttribute('href')).not.toContain('/applications/');
    const assignedScore = within(assigned).getByRole('link', { name: 'Submit scorecard: Hana Adel · BI Data Analyst' });
    expect(assignedScore).toHaveAttribute('href', '/my-interviews?interview=iv-assigned-score&scorecard=1');
    expect(assignedScore.getAttribute('href')).not.toContain('/applications/');
    expect(assigned.textContent).toMatch(/CV and evaluation only/);
    expect(assigned.innerHTML).not.toContain('/applications/');
  });

  it('without application view a file interview stays disabled and an assigned interview stays open', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: [] };
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    const schedule = screen.getByRole('region', { name: 'Interview schedule' });
    const blocked = within(schedule).getAllByRole('button', { name: 'Manage interview' });
    expect(blocked).toHaveLength(2);
    for (const button of blocked) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Opening the recruiting file needs application view.');
    }
    expect(within(schedule).queryByRole('link', { name: /Manage interview|View scorecard|Submit scorecard/ })).not.toBeInTheDocument();
    expect(schedule.innerHTML).not.toContain('/applications/');
    const assigned = screen.getByRole('region', { name: 'Your assigned interviews' });
    const evaluation = within(assigned).getByRole('link', { name: 'Open evaluation: Rana Adel · BI Data Analyst' });
    expect(evaluation).toHaveAttribute('href', '/my-interviews?interview=iv-assigned');
    expect(evaluation.getAttribute('href')).not.toContain('/applications/');
  });

  it('joining soon shows readiness without counting a hire', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByText('Welcome back, Mariam.')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming start dates, readiness and remaining checks.')).not.toBeInTheDocument();
    const joining = screen.getByRole('region', { name: 'Joining soon' });
    expect(within(joining).getByText('Lina Hassan · HRIS Developer')).toBeInTheDocument();
    expect(within(joining).getByText('Starts 1 Nov · 2 of 2 checks complete · Final approval pending')).toBeInTheDocument();
    expect(within(joining).getByText('Approval pending')).toBeInTheDocument();
    expect(within(joining).getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', '/hires/hc1?returnTo=%2Fmy-work%3Ftab%3Djoining');
    expect(within(joining).getByText('Mona Said · Staff Nurse — ICU')).toBeInTheDocument();
    expect(within(joining).getByText(/Starts 4 Nov · 2 of 3 checks complete · Licence review assigned · On hold/)).toBeInTheDocument();
    expect(within(joining).getByText('Licence pending')).toBeInTheDocument();
    expect(within(joining).getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', '/applications/a8?drawer=prehire&returnTo=%2Fmy-work%3Ftab%3Djoining');
    expect(within(joining).getByTestId('joining-footnote')).toHaveTextContent('A scheduled start is not a completed hire');
    expect(within(joining).queryByText('Joined')).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Next actions' }));
    expect(screen.queryByRole('region', { name: 'Job: HRIS Developer' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Next actions' })).toBeInTheDocument();
  });

  it('file access opens the checklist; evaluation never opens the recruiting file', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    renderPage(ok());
    await screen.findByRole('tab', { name: 'Joining soon' });
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', '/applications/a3?drawer=prehire&returnTo=%2Fmy-work%3Ftab%3Djoining');
    expect(screen.getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', '/applications/a8?drawer=prehire&returnTo=%2Fmy-work%3Ftab%3Djoining');
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    const assigned = screen.getByRole('region', { name: 'Your assigned interviews' });
    expect(within(assigned).getByRole('link').getAttribute('href')).toBe('/my-interviews?interview=iv-assigned');
  });

  it('restores tab, filter and day from the URL', async () => {
    const u = userEvent.setup();
    const load = ok();
    renderPage(load, '/my-work?tab=joining&filter=waiting&day=tomorrow');
    expect(await screen.findByRole('tab', { name: 'Joining soon' })).toHaveAttribute('aria-selected', 'true');
    expect(load).toHaveBeenCalledWith('tomorrow');
    expect(screen.getByText('Tomorrow · 20 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Starts 1 Nov · 2 of 2 checks complete · Final approval pending')).toBeInTheDocument();
    const kept = encodeURIComponent('/my-work?tab=joining&filter=waiting&day=tomorrow');
    expect(screen.getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', `/hires/hc1?returnTo=${kept}`);
    expect(screen.getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', `/applications/a8?drawer=prehire&returnTo=${kept}`);
    await u.click(screen.getByRole('tab', { name: 'Next actions' }));
    expect(screen.getByRole('button', { name: '2 Waiting' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('loc')).toHaveTextContent('filter=waiting');
    expect(screen.getByTestId('loc')).toHaveTextContent('day=tomorrow');
    expect(screen.getByTestId('loc')).not.toHaveTextContent('tab=');
    expect(screen.queryByText('Interview: Ahmed Embaby')).not.toBeInTheDocument();
    expect(screen.getByText('Salma Farouk — offer waiting on Karim Hassan')).toBeInTheDocument();
  });

  it('back restores the previous tab, filter and day', async () => {
    const u = userEvent.setup();
    const load = ok();
    const router = createMemoryRouter(
      [{ path: '/my-work', element: <><MyWorkV2 load={load as never} /><LocationProbe /></> }],
      { initialEntries: ['/my-work'] },
    );
    document.documentElement.setAttribute('data-ui', 'v2');
    render(<RouterProvider router={router} />);
    await screen.findByRole('list', { name: 'Next actions' });
    await u.click(screen.getByRole('button', { name: 'Show tomorrow' }));
    await screen.findByRole('button', { name: '2 Tomorrow' });
    await u.click(screen.getByRole('button', { name: '2 Waiting' }));
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=joining');
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('button', { name: '2 Waiting' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('loc')).toHaveTextContent('day=tomorrow');
    expect(screen.getByTestId('loc')).not.toHaveTextContent('tab=joining');
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByRole('button', { name: '2 Waiting' })).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.getByTestId('loc')).toHaveTextContent('day=tomorrow');
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/));
  });

  it('an absent upcoming or joining array is unavailable, and an empty array stays empty', async () => {
    const u = userEvent.setup();
    const populated = myWorkFixture();
    const absent: MyWorkResponse = { ...populated };
    delete absent.upcomingInterviews;
    delete absent.joiningSoon;
    const { unmount } = renderPage(async () => ({ data: absent, source: 'api' }));
    await screen.findByRole('tab', { name: 'Upcoming interviews' });
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    expect(screen.getByText('Upcoming interviews are unavailable in this response.')).toBeInTheDocument();
    expect(screen.queryByText('Nourhan Sami · HRIS Developer')).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByText('Joining cases are unavailable in this response.')).toBeInTheDocument();
    expect(screen.queryByText('Lina Hassan · HRIS Developer')).not.toBeInTheDocument();
    unmount();

    renderPage(ok('empty'));
    await screen.findByRole('tab', { name: 'Upcoming interviews' });
    await u.click(screen.getByRole('tab', { name: 'Upcoming interviews' }));
    expect(screen.getByText('No upcoming interviews assigned to you.')).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByText('No joining dates on your accepted cases.')).toBeInTheDocument();
    expect(screen.getByTestId('joining-footnote')).toBeInTheDocument();
  });
});

function taskItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title' | 'entity'>): WorkItem {
  return {
    type: 'task',
    dueAt: '2026-10-19T12:00:00.000Z',
    reason: 'Task',
    nextAction: { code: 'complete-task', label: 'Complete task' },
    actions: [{ key: 'complete-task', label: 'Complete task', disabled: false }],
    ...overrides,
  };
}

function queueWithTasks(tasks: WorkItem[]): MyWorkResponse {
  const data = myWorkFixture();
  data.overdue = [];
  data.waitingOnOthers = [];
  data.dueToday = tasks;
  data.counts = { overdue: 0, today: tasks.length, waitingOnOthers: 0 };
  data.empty = false;
  return data;
}

describe('task completion and reschedule', () => {
  const standalone = taskItem({ id: 't-standalone', title: 'Call the candidate', entity: { type: 'task', id: 't-standalone' } });
  const linked = taskItem({ id: 't-linked', title: 'Review application file', entity: { type: 'application', id: 'a1' } });
  const candidate = taskItem({
    id: 't-candidate',
    title: 'Follow up with Nour Ali',
    entity: { type: 'task', id: 't-candidate' },
    candidate: { id: 'c1', name: 'Nour Ali' },
  });

  function renderTasks() {
    const load = vi.fn(async (): Promise<MyWorkResult> => ({ data: queueWithTasks([standalone, linked, candidate]), source: 'api' }));
    renderPage(load);
    return load;
  }

  it('shows complete and reschedule on a standalone task, and open record on a linked task', async () => {
    renderTasks();
    const alone = within((await screen.findAllByTestId('work-row')).find((row) => row.textContent?.includes('Call the candidate'))!);
    expect(alone.getByRole('button', { name: 'Complete task: Call the candidate' })).toHaveClass('rf2-btn--primary');
    expect(alone.getByRole('button', { name: 'Reschedule: Call the candidate' })).toBeInTheDocument();
    expect(alone.queryByRole('link', { name: 'Open record: Call the candidate' })).not.toBeInTheDocument();

    const application = within(screen.getAllByTestId('work-row').find((row) => row.textContent?.includes('Review application file'))!);
    expect(application.getByRole('link', { name: 'Open record: Review application file' })).toHaveAttribute('href', '/applications/a1?returnTo=%2Fmy-work');
    expect(application.getByRole('button', { name: 'Complete task: Review application file' })).toHaveClass('rf2-btn--secondary');
    expect(application.getByRole('button', { name: 'Reschedule: Review application file' })).toBeInTheDocument();

    const person = within(screen.getAllByTestId('work-row').find((row) => row.textContent?.includes('Follow up with Nour Ali'))!);
    expect(person.getByRole('link', { name: 'Open record: Follow up with Nour Ali' })).toHaveAttribute('href', '/candidates/c1?returnTo=%2Fmy-work');
    expect(person.getByRole('button', { name: 'Complete task: Follow up with Nour Ali' })).toBeInTheDocument();
    expect(person.getByRole('button', { name: 'Reschedule: Follow up with Nour Ali' })).toBeInTheDocument();
  });

  it('completes a task through PATCH and reloads the queue', async () => {
    const u = userEvent.setup();
    let calls = 0;
    const load = vi.fn(async (): Promise<MyWorkResult> => {
      calls += 1;
      const tasks = calls > 1 ? [linked, candidate] : [standalone, linked, candidate];
      return { data: queueWithTasks(tasks), source: 'api' };
    });
    renderPage(load);
    const complete = await screen.findByRole('button', { name: 'Complete task: Call the candidate' });
    await u.click(complete);
    await waitFor(() => expect(patchApi).toHaveBeenCalledWith('/tasks/t-standalone/status', { status: 'Completed' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete task: Review application file' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Complete task: Call the candidate' })).not.toBeInTheDocument();
  });

  it('keeps a failed completion or reschedule on the row with an alert', async () => {
    const u = userEvent.setup();
    const load = vi.fn(async (): Promise<MyWorkResult> => ({ data: queueWithTasks([standalone, linked]), source: 'api' }));
    renderPage(load);
    const row = () => screen.getAllByTestId('work-row').find((item) => item.textContent?.includes('Call the candidate'))!;
    patchApi.mockRejectedValueOnce(new ApiError(409, 'This task could not be completed.'));
    await u.click(await screen.findByRole('button', { name: 'Complete task: Call the candidate' }));
    const alert = await within(row()).findByRole('alert');
    expect(alert).toHaveClass('rf2-mywork__task-error');
    expect(alert).toHaveTextContent('This task could not be completed.');
    expect(within(row()).getByRole('button', { name: 'Complete task: Call the candidate' })).toBeEnabled();
    expect(load).toHaveBeenCalledTimes(1);

    await u.click(within(row()).getByRole('button', { name: 'Reschedule: Call the candidate' }));
    const draft = '2026-12-01T15:30';
    fireEvent.change(within(row()).getByLabelText('Due date for Call the candidate'), { target: { value: draft } });
    patchApi.mockRejectedValueOnce(new ApiError(400, 'Choose a future follow-up date and time'));
    await u.click(within(row()).getByRole('button', { name: 'Save due date' }));
    expect(await within(row()).findByRole('alert')).toHaveTextContent('Choose a future follow-up date and time');
    expect(within(row()).getByRole('button', { name: 'Save due date' })).toBeEnabled();
    expect(within(row()).getByRole('button', { name: 'Complete task: Call the candidate' })).toBeEnabled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(patchApi).toHaveBeenLastCalledWith('/tasks/t-standalone/reschedule', { dueAt: new Date(draft).toISOString() });
  });

  it('reschedules a task through PATCH and reloads the queue', async () => {
    const u = userEvent.setup();
    const load = vi.fn(async (): Promise<MyWorkResult> => ({ data: queueWithTasks([standalone]), source: 'api' }));
    renderPage(load);
    await u.click(await screen.findByRole('button', { name: 'Reschedule: Call the candidate' }));
    const draft = '2026-12-01T15:30';
    fireEvent.change(screen.getByLabelText('Due date for Call the candidate'), { target: { value: draft } });
    await u.click(screen.getByRole('button', { name: 'Save due date' }));
    await waitFor(() => expect(patchApi).toHaveBeenCalledWith('/tasks/t-standalone/reschedule', { dueAt: new Date(draft).toISOString() }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('ignores a second completion click while the first request is in flight', async () => {
    const u = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    patchApi.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const load = vi.fn(async (): Promise<MyWorkResult> => ({ data: queueWithTasks([standalone]), source: 'api' }));
    renderPage(load);
    const complete = await screen.findByRole('button', { name: 'Complete task: Call the candidate' });
    await u.click(complete);
    expect(complete).toBeDisabled();
    fireEvent.click(complete);
    expect(patchApi).toHaveBeenCalledTimes(1);
    release({});
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});

describe('My Work compact interview sidebar', () => {
  it('shows real clickable interviews without duplicated notifications, My Result, or sample widgets', async () => {
    authState.user = { id: 'u1', displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    renderPage(ok());
    const sidebar = await screen.findByRole('region', { name: 'Upcoming interviews' });
    expect(within(sidebar).getAllByRole('listitem')).toHaveLength(3);
    expect(within(sidebar).getByRole('link', { name: 'Manage interview: Nourhan Sami · HRIS Developer' })).toHaveAttribute('href', '/applications/a2?drawer=schedule&interview=iv2&returnTo=%2Fmy-work');
    expect(screen.queryByText("Today's schedule")).not.toBeInTheDocument();
    expect(screen.queryByText('Aisha Mohammed')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent activity')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My result/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Last activity' })).toBeInTheDocument();
    expect(fetchMyWorkActivity).toHaveBeenCalledWith('u1');
  });

  it('shows an honest empty interview state without sample appointments', async () => {
    renderPage(ok('empty'));
    const sidebar = await screen.findByRole('region', { name: 'Upcoming interviews' });
    expect(within(sidebar).getByText('No upcoming interviews assigned to you.')).toBeInTheDocument();
    expect(within(sidebar).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('does not invent interview records when the API omits the schedule', async () => {
    const data = myWorkFixture();
    delete data.upcomingInterviews;
    renderPage(async () => ({ data, source: 'api' }));
    const sidebar = await screen.findByRole('region', { name: 'Upcoming interviews' });
    expect(within(sidebar).getByRole('status')).toHaveTextContent('Upcoming interviews are unavailable');
    expect(within(sidebar).getByRole('button', { name: 'Retry interviews' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('listitem')).not.toBeInTheDocument();
  });
});
