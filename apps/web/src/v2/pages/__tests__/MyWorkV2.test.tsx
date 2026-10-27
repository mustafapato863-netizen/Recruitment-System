import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { myWorkFixture } from '../../api/myWork.fixtures';
import type { MyWorkResponse, MyWorkResult } from '../../api/myWork';
import { MyWorkV2 } from '../MyWorkV2';

function LocationProbe() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }

const { authState } = vi.hoisted(() => ({
  authState: { user: { displayName: 'Mariam Farag' } as { displayName: string; id?: string; permissions?: string[] } },
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => authState }));

type Variant = NonNullable<Parameters<typeof myWorkFixture>[0]>['variant'];
const ok = (variant?: Variant, source: MyWorkResult['source'] = 'api') => vi.fn(async (day: 'today' | 'tomorrow' = 'today'): Promise<MyWorkResult> => ({ data: myWorkFixture({ variant, day }), source }));

function renderPage(load: (day?: 'today' | 'tomorrow') => Promise<MyWorkResult>, path = '/my-work') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<><MyWorkV2 load={load as never} /><LocationProbe /></>} /></Routes></MemoryRouter>);
}
afterEach(() => {
  document.documentElement.removeAttribute('data-ui');
  authState.user = { displayName: 'Mariam Farag' };
});

function rowsIn(bucket: string) {
  return screen.getAllByTestId('work-row').filter((row) => row.getAttribute('data-bucket') === bucket);
}

describe('My Work desk', () => {
  it('lets the subtitle lead, with the header as the only My Work', async () => {
    renderPage(ok());
    const subtitle = await screen.findByText('Your next actions, ordered by urgency.');
    expect(screen.queryByRole('heading', { name: 'My Work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Next actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'All tasks' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'My Work sections' });
    expect(subtitle.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('My Work (E02) from the #9 contract', () => {
  it('renders the target chip, one urgency list, and the three filters', async () => {
    renderPage(ok());
    expect(await screen.findByText('Your next actions, ordered by urgency.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Work' })).not.toBeInTheDocument();
    expect(screen.getByText('Today · 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Your next actions, ordered by urgency.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/notifications');
    const strip = screen.getByRole('region', { name: 'Job: HRIS Developer' });
    expect(within(strip).getByText('Hire target')).toBeInTheDocument();
    expect(within(strip).getByText('1 of 3 joined')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'Open pipeline: HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(within(strip).getByText('25 Oct 2026')).toBeInTheDocument();
    expect(within(strip).getByText('VAC-1 · Information Technology · Cairo HQ · Owner: Mariam Adel')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');

    const list = screen.getByRole('list', { name: 'Next actions' });
    expect(rowsIn('overdue').map((row) => row.textContent?.includes('Interview: Ahmed Embaby'))).toEqual([true]);
    const overdue = within(rowsIn('overdue')[0]!);
    expect(overdue.getByText('Interview: Ahmed Embaby')).toBeInTheDocument();
    expect(overdue.getByText('Your scorecard is missing')).toBeInTheDocument();
    expect(overdue.getByTestId('candidate')).toHaveTextContent('Ahmed Embaby · Interview');
    expect(overdue.getByTestId('sla')).toHaveTextContent('Overdue');
    expect(overdue.getByTestId('due')).toHaveTextContent('Due 18 Oct');
    expect(overdue.getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveAttribute('href', '/applications/a1?drawer=scorecard&interview=i1');

    const todayRows = rowsIn('dueToday');
    const today = within(list);
    expect(today.getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveAttribute('href', '/vacancies/j1');
    expect(today.getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveAttribute('href', '/applications/a2');
    expect(today.getByText('19 Oct, 11:30–12:00')).toBeInTheDocument();
    expect(today.getByRole('link', { name: 'Room 2A' })).toHaveAttribute('href', 'https://rooms.sgh.test/2a');
    const disabled = today.getByRole('button', { name: 'Submit scorecard' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription('Interview has not ended');
    expect(disabled).toHaveAttribute('title', 'Interview has not ended');
    expect(today.getByRole('link', { name: 'Put on hold: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--secondary');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    expect(today.getByRole('link', { name: /^Review applicants/ })).toHaveClass('rf2-btn--primary');
    expect(todayRows).toHaveLength(2);

    const waitingRows = rowsIn('waitingOnOthers');
    const waiting = within(waitingRows[0]!.parentElement!);
    expect(within(waitingRows[0]!).getByText('Salma Farouk — offer waiting on Karim Hassan')).toBeInTheDocument();
    expect(within(waitingRows[0]!).getByText("Waiting on Karim Hassan's approval")).toBeInTheDocument();
    expect(within(waitingRows[0]!).getByText('Waiting on approval')).toBeInTheDocument();
    expect(within(waitingRows[1]!).getByText('Waiting on interviewer')).toBeInTheDocument();
    expect(within(waitingRows[1]!).getByText('2 scorecard(s) missing')).toBeInTheDocument();
    expect(waiting.queryByRole('button', { name: 'Send offer' })).not.toBeInTheDocument();
    expect(waitingRows.every((row) => within(row).queryByRole('link') === null)).toBe(true);
    expect(waiting.getAllByText('Read-only')).toHaveLength(2);
    expect(waiting.getAllByText('No action for you')).toHaveLength(2);
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['1', '2', '2']);
    expect(counts.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('sample-data-note')).not.toBeInTheDocument();
  });

  it('renders one strip per target when there are several', async () => {
    renderPage(ok('multi-target'));
    const list = await screen.findByRole('list', { name: 'Your targets' });
    expect(within(list).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Job: HRIS Developer', 'Job: Data Analyst']);
    expect(within(list).getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText('Your next actions, ordered by urgency.')).toBeInTheDocument();
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
  it('targets but no work items (#9 empty=true ignores targets): target strip + empty state (E03)', async () => {
    renderPage(ok('targets-only'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Job: HRIS Developer' })).toBeInTheDocument();
    expect(screen.getByText('Open files on your jobs that need you appear here.')).toBeInTheDocument();
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

describe('keyboard + a11y', () => {
  it('tab order reaches the strip link and each action', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('list', { name: 'Next actions' });
    await u.tab();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Show today' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Show tomorrow' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('tab', { name: 'Next actions' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: 'HRIS Developer' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: 'My result →' })).toHaveAttribute('href', expect.stringMatching(/^\/my-result\?job=/));
    expect(screen.getByRole('link', { name: 'My result →' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: /^Open pipeline/ })).toHaveFocus();
    await u.tab();
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
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(0);
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
    expect(row.getByText('Lina Hassan — offer waiting on the candidate')).toBeInTheDocument();
    expect(row.getByText('Waiting on candidate')).toBeInTheDocument();
    expect(row.getByText('Waiting on Lina Hassan')).toBeInTheDocument();
    expect(row.queryByText(/approval/i)).not.toBeInTheDocument();
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
    expect(screen.getByText('Upcoming interviews assigned to you or your candidates.')).toBeInTheDocument();
    const schedule = screen.getByRole('region', { name: 'Interview schedule' });
    expect(within(schedule).getByRole('link', { name: 'Manage interview: Nourhan Sami · HRIS Developer' })).toHaveAttribute('href', '/applications/a2?drawer=schedule&interview=iv2');
    expect(within(schedule).getByRole('link', { name: 'View scorecard: Ahmed Embaby · HRIS Developer' })).toHaveAttribute('href', '/applications/a1?drawer=scorecard&interview=iv-score');
    expect(within(schedule).getByRole('link', { name: 'Room 2A' })).toHaveAttribute('href', 'https://rooms.sgh.test/2a');
    expect(within(schedule).getByText(/19 Oct · 11:30–12:00/)).toBeInTheDocument();
    const held = within(schedule).getByText('Youssef Hamdy · Data Analyst').closest('li')!;
    expect(within(held).getByText(/On hold/)).toBeInTheDocument();
    expect(within(held).getByRole('link', { name: 'Manage interview: Youssef Hamdy · Data Analyst' })).toHaveAttribute('href', '/applications/a6?drawer=schedule&interview=iv-held');
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
    expect(screen.getByText('Upcoming start dates, readiness and remaining checks.')).toBeInTheDocument();
    const joining = screen.getByRole('region', { name: 'Joining soon' });
    expect(within(joining).getByText('Lina Hassan · HRIS Developer')).toBeInTheDocument();
    expect(within(joining).getByText('Starts 1 Nov · 2 of 2 checks complete · Final approval pending')).toBeInTheDocument();
    expect(within(joining).getByText('Approval pending')).toBeInTheDocument();
    expect(within(joining).getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', '/hires/hc1');
    expect(within(joining).getByText('Mona Said · Staff Nurse — ICU')).toBeInTheDocument();
    expect(within(joining).getByText(/Starts 4 Nov · 2 of 3 checks complete · Licence review assigned · On hold/)).toBeInTheDocument();
    expect(within(joining).getByText('Licence pending')).toBeInTheDocument();
    expect(within(joining).getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', '/applications/a8?drawer=prehire');
    expect(within(joining).getByTestId('joining-footnote')).toHaveTextContent('A scheduled start is not a completed hire');
    expect(within(joining).queryByText('Joined')).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Next actions' }));
    expect(within(screen.getByRole('region', { name: 'Job: HRIS Developer' })).getByText('1 of 3 joined')).toBeInTheDocument();
  });

  it('file access opens the checklist; evaluation never opens the recruiting file', async () => {
    const u = userEvent.setup();
    authState.user = { displayName: 'Mariam Farag', permissions: ['APPLICATION_VIEW'] };
    renderPage(ok());
    await screen.findByRole('tab', { name: 'Joining soon' });
    await u.click(screen.getByRole('tab', { name: 'Joining soon' }));
    expect(screen.getByRole('link', { name: 'Open checklist: Lina Hassan' })).toHaveAttribute('href', '/applications/a3?drawer=prehire');
    expect(screen.getByRole('link', { name: 'View readiness: Mona Said' })).toHaveAttribute('href', '/applications/a8?drawer=prehire');
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
