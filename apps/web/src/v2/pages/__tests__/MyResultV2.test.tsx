import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { MyResultV2 } from '../MyResultV2';
import { cairoMonth, cairoWeek, fetchMyResult, type EmployeeTargetItem } from '../../api/myResult';

type Tile = { value: number; of: number; sampleSize: number; detail: string; tooFewToJudge?: boolean };
const result = (tiles: Partial<Record<string, Tile>> = {}, overrides: Record<string, unknown> = {}) => ({
  scope: 'me',
  month: '2026-10',
  range: { from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T22:00:00.000Z' },
  asOf: '2026-10-31T10:00:00.000Z',
  filters: { vacancyId: 'v1', managerId: null },
  people: [{ id: 'u-mariam', name: 'Mariam Farag' }],
  capacity: { approved: 3, joined: 1, remaining: 2 },
  vacancies: [
    { id: 'v1', title: 'HRIS Developer', approvedHeadcount: 3, joinedHeadcount: 1, remainingHeadcount: 2 },
    { id: 'v2', title: 'Medical Coder', approvedHeadcount: 2, joinedHeadcount: 0, remainingHeadcount: 2 },
  ],
  details: {
    seats: [
      {
        id: 'hc-1',
        applicationId: 'app-1',
        candidateName: 'Nour Ali',
        jobTitle: 'HRIS Developer',
        vacancyId: 'v1',
        date: '2026-10-15T09:00:00.000Z',
        dateLabel: 'Actual joining date',
        status: 'Joined in month',
        counted: true,
      },
    ],
    overdueFollowUps: [
      {
        id: 'app-2',
        applicationId: 'app-2',
        candidateName: 'Sara Ahmed',
        jobTitle: 'HRIS Developer',
        vacancyId: 'v1',
        date: '2026-10-12T00:00:00.000Z',
        dateLabel: 'Follow-up due',
        status: 'Overdue (needs action)',
        counted: true,
      },
    ],
    screensReachedInterview: [],
    offersAccepted: [],
  },
  tiles: {
    seats: { value: 1, of: 3, sampleSize: 1, detail: '1 joined in October 2026 against 3 seats on 1 job.', tooFewToJudge: false },
    overdueFollowUps: { value: 1, of: 9, sampleSize: 9, detail: '1 of 9 follow-ups due in October 2026 were not acted on by their date.', tooFewToJudge: false },
    screensReachedInterview: { value: 1, of: 2, sampleSize: 2, detail: '1 of 2 screens with a note in October 2026 reached Interview.', tooFewToJudge: true },
    offersAccepted: { value: 0, of: 0, sampleSize: 0, detail: '0 of 0 offers sent in October 2026 were accepted.', tooFewToJudge: true },
    ...tiles,
  },
  monthlySalary: 42000,
  ...overrides,
});
const serve = (body: unknown, vacOverride: Record<string, unknown> = {}) =>
  api.getApi.mockImplementation(async (p: string) =>
    p.startsWith('/vacancies/')
      ? { id: 'v1', title: null, position: { title: 'HRIS Developer' }, approvedHeadcount: 3, joinedHeadcount: 1, ...vacOverride }
      : body,
  );
const renderAt = (path = '/my-result?job=v1&month=2026-10') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/my-result" element={<MyResultV2 />} />
        <Route path="/my-work" element={<p>my work</p>} />
        <Route path="/applications/:id" element={<p>application file</p>} />
      </Routes>
    </MemoryRouter>,
  );
};
beforeEach(() => {
  api.getApi.mockReset();
  shell.value = { seat: 'employee' };
});

describe('E04 My result', () => {
  it('B8 /results/me; four tiles; server tooFewToJudge; seats exempt; no pay; axe', async () => {
    serve(result());
    const { container } = renderAt();
    expect(await screen.findByRole('region', { name: 'Seats' })).toHaveTextContent(
      /Joined this month: 1Remaining seats today: 2 · 1 of 3 filled1 joined in October 2026 against 3 seats on 1 job\.Based on 1 record · seats are always shown/,
    );
    expect(within(screen.getByRole('region', { name: 'Seats' })).queryByText('Too few to judge')).toBeNull();
    expect(api.getApi).toHaveBeenCalledWith('/results/me?month=2026-10&vacancyId=v1');
    expect(screen.getByText('October 2026 · monthly · HRIS Developer only.')).toBeInTheDocument();
    expect(screen.getByTestId('my-result-freshness')).toHaveTextContent(/Live cohort as of .* · Africa\/Cairo/);
    expect(screen.getByRole('region', { name: 'Overdue follow-ups' })).toHaveTextContent(
      /^Overdue follow-ups1 of 9past their follow-up date1 of 9 follow-ups due in October 2026 were not acted on by their date\.Based on 9 records/,
    );
    const screens = screen.getByRole('region', { name: 'Screens with a note' });
    expect(within(screens).getByText('Too few to judge')).toBeInTheDocument();
    expect(screens).toHaveTextContent('1 of 2 so far');
    expect(screens).toHaveTextContent('Based on 2 records · needs 5');
    expect(screen.getByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent(
      /Too few to judge.*0 of 0 so far.*Based on 0 records · needs 5/,
    );
    expect(container.textContent).not.toMatch(/42000|salary|%/i);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('R01: separates monthly joins from current remaining seats when prior joins already filled the job', async () => {
    serve(
      result(
        {
          seats: {
            value: 1,
            of: 3,
            sampleSize: 1,
            detail: '1 joined in October 2026 · 3 of 3 filled today (0 remaining) on 1 job.',
            tooFewToJudge: false,
          },
        },
        { capacity: { approved: 3, joined: 3, remaining: 0 } },
      ),
      { approvedHeadcount: 3, joinedHeadcount: 3 },
    );
    renderAt('/my-result?job=v1&month=2026-10');
    const seats = await screen.findByRole('region', { name: 'Seats' });
    expect(seats).toHaveTextContent('Joined this month: 1');
    expect(seats).toHaveTextContent('Remaining seats today: 0 · 3 of 3 filled');
    expect(seats).not.toHaveTextContent('2 open');
  });

  it('R06: month nav, job scope selector, Reset filters, and expandable underlying records with returnTo', async () => {
    const u = userEvent.setup();
    serve(result());
    renderAt('/my-result?job=v1&month=2026-09');
    await screen.findByRole('region', { name: 'Seats' });

    // Expand Overdue follow-ups records
    await u.click(screen.getByRole('button', { name: 'View Overdue follow-ups records' }));
    const details = await screen.findByRole('region', { name: 'Overdue follow-ups records' });
    expect(details).toHaveTextContent('Sara Ahmed');
    expect(details).toHaveTextContent('Overdue (needs action)');
    const openLink = within(details).getByRole('link', { name: 'Open file for Sara Ahmed' });
    expect(openLink.getAttribute('href')).toContain('/applications/app-2?returnTo=');
    expect(decodeURIComponent(openLink.getAttribute('href')!)).toContain('month=2026-09');
    expect(decodeURIComponent(openLink.getAttribute('href')!)).toContain('job=v1');
    expect(decodeURIComponent(openLink.getAttribute('href')!)).toContain('measure=overdueFollowUps');

    // Switch Job scope to All my jobs
    await u.selectOptions(screen.getByLabelText('Job scope'), 'all');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/results/me?month=2026-09'));

    // Reset filters returns to current month and all jobs
    await u.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith(`/results/me?month=${cairoMonth()}`));
  });

  it('server flag wins over the count; the under-5 rule only when the flag is missing', async () => {
    serve(
      result({
        offersAccepted: { value: 3, of: 5, sampleSize: 5, detail: 'd', tooFewToJudge: true },
        screensReachedInterview: { value: 2, of: 3, sampleSize: 3, detail: 'd', tooFewToJudge: false },
        overdueFollowUps: { value: 0, of: 2, sampleSize: 2, detail: 'd' },
        seats: { value: 0, of: 4, sampleSize: 0, detail: 'd' },
      }),
      { approvedHeadcount: 4, joinedHeadcount: 0 },
    );
    renderAt();
    expect(await screen.findByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent('Too few to judge');
    expect(screen.getByRole('region', { name: 'Screens with a note' })).toHaveTextContent(/2 of 3reached interview/);
    expect(screen.getByRole('region', { name: 'Overdue follow-ups' })).toHaveTextContent('Too few to judge');
    expect(screen.getByRole('region', { name: 'Seats' })).toHaveTextContent('Joined this month: 0');
    expect(screen.getByRole('region', { name: 'Seats' })).toHaveTextContent('Remaining seats today: 4 · 0 of 4 filled');
  });

  it('404 (B8 not built) → honest unavailable state, no fixtures', async () => {
    api.getApi.mockRejectedValue(new ApiError(404, 'Cannot GET /api/v1/results/me'));
    renderAt('/my-result');
    expect(await screen.findByText('My result is not available yet')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Seats' })).not.toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledWith(`/results/me?month=${cairoMonth()}`);
  });

  it('malformed body → unavailable; 403 → forbidden; 500 → retry', async () => {
    api.getApi.mockResolvedValueOnce({ hello: 1 });
    expect(await fetchMyResult('2026-10')).toEqual({ kind: 'unavailable' });
    api.getApi.mockRejectedValueOnce(new ApiError(403, 'no'));
    const { unmount } = renderAt();
    expect(await screen.findByText(/does not include results/)).toBeInTheDocument();
    unmount();
    const u = userEvent.setup();
    serve(result());
    api.getApi.mockRejectedValueOnce(new ApiError(500, 'boom'));
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Seats' })).toBeInTheDocument();
  });

  it('v2 Employee only: other seats go to My Work without calling the API', async () => {
    shell.value = null;
    renderAt();
    expect(await screen.findByText('my work')).toBeInTheDocument();
    expect(api.getApi).not.toHaveBeenCalled();
  });

  it('shows a screening target of 20 with 8 qualifying records, and no way to edit it', async () => {
    const u = userEvent.setup();
    const target: EmployeeTargetItem = {
      id: 'tgt-1',
      employeeId: 'u-mariam',
      employeeName: 'Mariam Farag',
      metric: 'screenings_completed',
      metricLabel: 'Screenings completed',
      periodType: 'monthly',
      periodKey: '2026-10',
      periodLabel: 'October 2026',
      vacancyId: 'v1',
      jobTitle: 'HRIS Developer',
      target: 20,
      achieved: 8,
      remaining: 12,
      progressPercent: 40,
      records: [
        {
          id: 'rec-1',
          applicationId: 'app-9',
          candidateName: 'Nour Adel',
          jobTitle: 'HRIS Developer',
          date: '2026-10-15T09:00:00.000Z',
          dateLabel: 'Completed',
          status: 'Screening completed',
          counted: true,
        },
      ],
    };
    serve(result({}, { targets: [target] }));
    renderAt();
    const section = await screen.findByTestId('my-activity-targets');
    expect(section).toHaveTextContent('Screenings completed · HRIS Developer');
    expect(section).toHaveTextContent('8/20');
    expect(section).toHaveTextContent('12 remaining');
    expect(section).toHaveTextContent('40%');
    expect(screen.queryByRole('button', { name: /manage targets|save target|update target|edit target|create target/i })).toBeNull();
    expect(screen.queryByLabelText('Reason for change')).toBeNull();
    expect(api.getApi.mock.calls.map((call) => String(call[0])).some((url) => url.startsWith('/results/targets'))).toBe(false);

    await u.click(within(section).getByRole('button', { name: 'View records for Screenings completed' }));
    const records = within(section).getByRole('table', { name: 'Supporting records for Screenings completed' });
    expect(within(records).getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(within(records).getByRole('columnheader', { name: 'Job' })).toBeInTheDocument();
    expect(within(records).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(within(records).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(within(records).getByRole('rowheader', { name: 'Nour Adel' })).toBeInTheDocument();
    expect(within(records).getByRole('cell', { name: 'HRIS Developer' })).toBeInTheDocument();
    expect(within(records).getByText('Screening completed')).toBeInTheDocument();
    expect(within(records).getByRole('cell', { name: /Completed: 15 Oct 2026/ })).toBeInTheDocument();
    const openFile = within(records).getByRole('link', { name: 'Open file for Nour Adel' });
    expect(openFile.getAttribute('href')).toContain('/applications/app-9?returnTo=');
    expect(decodeURIComponent(openFile.getAttribute('href')!)).toContain('/my-result?job=v1&month=2026-10');
  });

  it('shows an empty target period without a progress mark', async () => {
    serve(result({}, { targets: [] }));
    renderAt();
    const section = await screen.findByTestId('my-activity-targets');
    expect(section).toHaveTextContent('No targets assigned for this period.');
    expect(section.textContent).not.toMatch(/%/);
    expect(within(section).getByRole('group', { name: 'Target period' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manage targets|save target|update target|edit target/i })).toBeNull();
  });

  it('switches to weekly targets and retries a failed load without showing a false zero', async () => {
    const u = userEvent.setup();
    let weeklyOk = false;
    const monthly: EmployeeTargetItem = {
      id: 'tgt-m',
      employeeId: 'u-mariam',
      employeeName: 'Mariam Farag',
      metric: 'screenings_completed',
      metricLabel: 'Screenings completed',
      periodType: 'monthly',
      periodKey: '2026-10',
      periodLabel: 'October 2026',
      vacancyId: 'v1',
      jobTitle: null,
      target: 20,
      achieved: 8,
      remaining: 12,
      progressPercent: 40,
    };
    const weekly: EmployeeTargetItem = {
      ...monthly,
      id: 'tgt-w',
      periodType: 'weekly',
      periodKey: cairoWeek(),
      periodLabel: 'This week',
      target: 5,
      achieved: 2,
      remaining: 3,
      progressPercent: 40,
    };
    api.getApi.mockImplementation(async (p: string) => {
      if (p.startsWith('/vacancies/')) {
        return { id: 'v1', title: null, position: { title: 'HRIS Developer' }, approvedHeadcount: 3, joinedHeadcount: 1 };
      }
      if (p.startsWith('/results/targets')) {
        if (!weeklyOk) throw new ApiError(503, 'Weekly targets are unavailable.');
        return { targets: [weekly] };
      }
      return result({}, { targets: [monthly] });
    });
    renderAt();
    const section = await screen.findByTestId('my-activity-targets');
    expect(section).toHaveTextContent('8/20');
    expect(api.getApi.mock.calls.map((call) => String(call[0])).some((url) => url.startsWith('/results/targets'))).toBe(false);

    await u.click(within(section).getByRole('button', { name: 'Weekly' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent('Weekly targets are unavailable.');
    expect(section.textContent).not.toMatch(/8\/20|12 remaining|0\/|0 remaining|0%|%/);
    expect(within(section).queryByText('2/5')).toBeNull();

    weeklyOk = true;
    await u.click(within(section).getByRole('button', { name: 'Try again' }));
    expect(await within(section).findByText('2/5')).toBeInTheDocument();
    expect(section).toHaveTextContent('3 remaining');
    expect(section).toHaveTextContent('40%');
    const targetUrls = api.getApi.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith('/results/targets'));
    expect(targetUrls).toEqual([
      `/results/targets?scope=me&periodType=weekly&periodKey=${cairoWeek()}&vacancyId=v1`,
      `/results/targets?scope=me&periodType=weekly&periodKey=${cairoWeek()}&vacancyId=v1`,
    ]);
  });

  it('keeps weekly targets off the Monthly tab and does not repeat a date already in the label', async () => {
    const u = userEvent.setup();
    const monthly: EmployeeTargetItem = {
      id: 'tgt-m',
      employeeId: 'u-mariam',
      employeeName: 'Mariam Farag',
      metric: 'screenings_completed',
      metricLabel: 'Screenings completed',
      periodType: 'monthly',
      periodKey: '2026-10',
      periodLabel: 'October 2026',
      vacancyId: 'v1',
      jobTitle: 'HRIS Developer',
      target: 20,
      achieved: 8,
      remaining: 12,
      progressPercent: 40,
      records: [
        {
          id: 'rec-bare',
          applicationId: 'app-9',
          candidateName: 'Nour Adel',
          jobTitle: 'HRIS Developer',
          date: '2026-10-15T09:00:00.000Z',
          dateLabel: 'Completed',
          status: 'Screening completed',
          counted: true,
        },
        {
          id: 'rec-dated',
          applicationId: 'app-10',
          candidateName: 'Omar Nabil',
          jobTitle: 'HRIS Developer',
          date: '2026-10-15T09:00:00.000Z',
          dateLabel: 'Screened 15 Oct 2026',
          status: 'Screening completed',
          counted: true,
        },
        {
          id: 'rec-plain',
          applicationId: '',
          candidateName: 'Lina Hassan',
          jobTitle: 'HRIS Developer',
          date: '2026-10-16T09:00:00.000Z',
          dateLabel: '',
          status: 'Recorded',
          counted: false,
        },
      ],
    };
    const weeklyOverlap: EmployeeTargetItem = {
      ...monthly,
      id: 'tgt-week-overlap',
      periodType: 'weekly',
      periodKey: cairoWeek(),
      periodLabel: 'This week',
      jobTitle: null,
      target: 5,
      achieved: 8,
      remaining: 0,
      progressPercent: 100,
      records: [],
    };
    const withoutPeriod = { ...monthly };
    delete (withoutPeriod as { periodType?: EmployeeTargetItem['periodType'] }).periodType;
    const legacy = {
      ...withoutPeriod,
      id: 'tgt-legacy',
      metric: 'interviews_conducted',
      metricLabel: 'Interviews conducted',
      jobTitle: null,
      target: 9,
      achieved: 3,
      remaining: 6,
      progressPercent: 33,
      records: [],
    } as EmployeeTargetItem;
    const weeklyReady: EmployeeTargetItem = {
      ...weeklyOverlap,
      id: 'tgt-week-ready',
      target: 5,
      achieved: 2,
      remaining: 3,
      progressPercent: 40,
    };
    api.getApi.mockImplementation(async (p: string) => {
      if (p.startsWith('/vacancies/')) {
        return { id: 'v1', title: null, position: { title: 'HRIS Developer' }, approvedHeadcount: 3, joinedHeadcount: 1 };
      }
      if (p.startsWith('/results/targets')) return { targets: [weeklyReady] };
      return result({}, { targets: [monthly, weeklyOverlap, legacy] });
    });
    renderAt();
    const section = await screen.findByTestId('my-activity-targets');
    expect(section).toHaveTextContent('Screenings completed · HRIS Developer');
    expect(section).toHaveTextContent('8/20');
    expect(section).toHaveTextContent('Interviews conducted');
    expect(section).toHaveTextContent('3/9');
    expect(section).not.toHaveTextContent('8/5');
    expect(api.getApi.mock.calls.map((call) => String(call[0])).some((url) => url.startsWith('/results/targets'))).toBe(false);

    await u.click(within(section).getByRole('button', { name: 'View records for Screenings completed' }));
    const records = within(section).getByRole('table', { name: 'Supporting records for Screenings completed' });
    expect(within(records).getByRole('cell', { name: /Completed: 15 Oct 2026/ })).toBeInTheDocument();
    expect(within(records).getByRole('cell', { name: 'Screened 15 Oct 2026' })).toBeInTheDocument();
    expect(records.textContent).not.toContain('Screened 15 Oct 2026:');
    expect(within(records).getByRole('cell', { name: '16 Oct 2026' })).toBeInTheDocument();

    await u.click(within(section).getByRole('button', { name: 'Weekly' }));
    expect(await within(section).findByText('2/5')).toBeInTheDocument();
    expect(section).toHaveTextContent('3 remaining');
    expect(section).not.toHaveTextContent('8/20');
    expect(section).not.toHaveTextContent('3/9');
    expect(section).not.toHaveTextContent('8/5');
  });
});
