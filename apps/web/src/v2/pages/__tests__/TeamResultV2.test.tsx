import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'manager' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { ReportsRoute } from '../ReportsRoute';
import { cairoMonth, cairoWeek, monthLabel, type EmployeeTargetItem } from '../../api/myResult';
import { shiftMonth, trailingMonths } from '../../api/teamResult';

const tile = (value: number, of: number, sampleSize: number, detail: string, tooFewToJudge: boolean) => ({
  value,
  of,
  sampleSize,
  detail,
  tooFewToJudge,
});

/** Exact B8 #20 /results/team shape (plus pay a bad screen might show). */
const team = (extra: Record<string, unknown> = {}) => ({
  scope: 'team',
  month: '2026-10',
  range: { from: '2026-10-01', to: '2026-10-31' },
  filters: { vacancyId: null, managerId: null },
  people: [
    { id: 'u-y', name: 'Youssef Ibrahim' },
    { id: 'u-m', name: 'Mariam Farag' },
    { id: 'u-n', name: 'Noura Al-Dosari' },
  ],
  tiles: {
    seats: tile(4, 8, 3, '3 jobs', false),
    overdueFollowUps: tile(3, 24, 24, '3 of 24 follow-ups due', false),
    screensReachedInterview: tile(5, 10, 10, '5 of 10 screens', false),
    offersAccepted: tile(3, 4, 4, '3 of 4 sent', true),
  },
  salaryBudget: 999999,
  ...extra,
});

const renderAt = (path = '/reports') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback="…">
        <Routes>
          <Route path="/reports" element={<ReportsRoute />} />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
};

const urls = () => api.getApi.mock.calls.map((call) => String(call[0]));
const windowFor = (month: string, branchId?: string, vacancyId?: string) =>
  trailingMonths(month, 6, cairoMonth()).map((item) => {
    const q = new URLSearchParams(item === month ? { periodType: 'monthly', periodKey: item } : { month: item });
    if (item === month) q.set('month', item);
    if (vacancyId) q.set('vacancyId', vacancyId);
    if (branchId) q.set('branchId', branchId);
    return `/results/team?${q}`;
  });
const monthIn = (url: string) => new URL(url, 'http://localhost').searchParams.get('month') ?? new URL(url, 'http://localhost').searchParams.get('periodKey');
const targetsTable = () => screen.getByRole('table', { name: 'Team targets & progress' });
const kpiItem = (list: HTMLElement, label: string) => {
  const item = within(list).getByText(label).closest('li');
  if (!item) throw new Error(`Missing KPI ${label}`);
  return item;
};

beforeEach(() => {
  vi.clearAllMocks();
  shell.value = { seat: 'manager' };
  api.getApi.mockResolvedValue(team());
  api.postApi.mockReset();
  api.patchApi.mockReset();
});

const screeningTarget = (overrides: Partial<EmployeeTargetItem> = {}): EmployeeTargetItem => ({
  id: 'tgt-1',
  employeeId: 'u-m',
  employeeName: 'Mariam Farag',
  metric: 'screenings_completed',
  metricLabel: 'Screenings completed',
  periodType: 'monthly',
  periodKey: '2026-10',
  periodLabel: 'October 2026',
  vacancyId: null,
  jobTitle: null,
  target: 20,
  achieved: 8,
  remaining: 12,
  progressPercent: 40,
  version: 1,
  revisions: [
    {
      id: 'rev-1',
      priorTarget: 10,
      newTarget: 20,
      reason: 'Coverage for October hiring',
      actorName: 'Hoda Samir',
      createdAt: '2026-10-02T08:00:00.000Z',
    },
  ],
  records: [
    {
      id: 'rec-1',
      applicationId: 'app-9',
      candidateName: 'Nour Adel',
      jobTitle: 'HRIS Developer',
      date: '2026-10-15T09:00:00.000Z',
      dateLabel: 'Completed',
      status: 'Counted',
      counted: true,
    },
  ],
  ...overrides,
});

describe('M4 Team results (B8 /results/team & in-page target workspace)', () => {
  it('renders Team results heading, context label with employee count, 4 summary cards, alphabetical matrix, Hiring analysis, no pay; axe', async () => {
    const { container } = renderAt();
    expect(await screen.findByRole('heading', { level: 1, name: 'Team results' })).toBeInTheDocument();
    expect(screen.queryByText('Team result › Reports & analysis')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Reports & analysis' })).toBeNull();
    expect(screen.getByTestId('team-results-context')).toHaveTextContent(`Direct reports · 3 employees · ${monthLabel(cairoMonth())}`);

    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledWith(`/results/team?periodType=monthly&periodKey=${cairoMonth()}&month=${cairoMonth()}`);
    expect(urls()).toEqual(windowFor(cairoMonth()));

    const kpis = screen.getByRole('list', { name: `Team summary for ${monthLabel(cairoMonth())}` });
    expect(within(kpis).getAllByRole('listitem')).toHaveLength(4);
    expect(kpiItem(kpis, 'Confirmed joinings')).toHaveTextContent('4');
    expect(kpiItem(kpis, 'Confirmed joinings')).toHaveTextContent('4 of 8 approved seats');
    const offers = kpiItem(kpis, 'Offer acceptance');
    expect(offers).toHaveTextContent('3 of 4');
    expect(offers).toHaveTextContent('Too few to judge');
    expect(offers).not.toHaveTextContent('%');
    const overdue = kpiItem(kpis, 'Overdue follow-ups');
    expect(overdue).toHaveTextContent('3');
    expect(overdue).toHaveTextContent('3 of 24 due');

    const matrix = targetsTable();
    const rows = within(matrix).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('EmployeeScreeningInterviewsFeedbackJoinings');
    expect(rows.slice(1).map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'MFMariam FaragRecruiterEdit planDetails',
      'NANoura Al-DosariRecruiterEdit planDetails',
      'YIYoussef IbrahimRecruiterEdit planDetails',
    ]);
    expect(within(rows[1]!).getAllByText('Not set')).toHaveLength(4);

    expect(screen.getByRole('heading', { name: 'Hiring analysis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hiring funnel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actual vs target' })).toBeInTheDocument();
    expect(screen.getByText('Overdue follow-ups history')).toBeInTheDocument();
    expect(screen.getByText('How these measures are counted')).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/999999|#\d|75(?:\.0)?%/);
    expect(container.textContent).not.toMatch(/vs previous/i);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('avoids undefined percentage comparisons when previous value is zero and shows delta when previous is positive', async () => {
    const current = cairoMonth();
    const previous = shiftMonth(current, -1);
    api.getApi.mockImplementation(() => {
      const base = team();
      base.tiles.seats = tile(0, 8, 3, '0 jobs', false);
      base.tiles.overdueFollowUps = tile(0, 24, 24, '0 of 24 follow-ups due', false);
      return Promise.resolve(base);
    });
    const zeroRender = renderAt();
    const zeroKpis = await screen.findByRole('list', { name: `Team summary for ${monthLabel(current)}` });
    expect(kpiItem(zeroKpis, 'Confirmed joinings').querySelector('.rf2-tres__delta')).toBeNull();
    expect(kpiItem(zeroKpis, 'Overdue follow-ups').querySelector('.rf2-tres__delta')).toBeNull();
    zeroRender.unmount();

    api.getApi.mockImplementation((url: string) => {
      const base = team();
      if (monthIn(url) === previous) {
        base.tiles.seats = tile(2, 8, 3, '2 jobs', false);
        base.tiles.overdueFollowUps = tile(6, 24, 24, '6 of 24 follow-ups due', false);
      }
      return Promise.resolve(base);
    });
    renderAt();
    const kpis = await screen.findByRole('list', { name: `Team summary for ${monthLabel(current)}` });
    expect(kpiItem(kpis, 'Confirmed joinings').querySelector('.rf2-tres__delta')).toHaveTextContent('+100%');
    const overdue = kpiItem(kpis, 'Overdue follow-ups');
    expect(overdue.querySelector('.rf2-tres__delta')).toHaveTextContent('-50%');
    expect(overdue.querySelector('.rf2-tres__delta')).toHaveAttribute('data-tone', 'good');
    expect(kpiItem(kpis, 'Offer acceptance').querySelector('.rf2-tres__delta')).toBeNull();
  });

  it('renders both analysis panels before targets, including actual work without a target, plus concise empty states', async () => {
    const tiles = team().tiles;
    api.getApi.mockResolvedValue(team({
      rows: [
        { person: { id: 'u-m', name: 'Mariam Farag' }, tiles: { ...tiles, seats: tile(3, 5, 2, '2 jobs', false) }, workCounts: { screenings_completed: 8, interviews_conducted: 4, feedback_submitted: 3, seats_joined: 3 } },
        { person: { id: 'u-y', name: 'Youssef Ibrahim' }, tiles: { ...tiles, seats: tile(1, 3, 1, '1 job', false) }, workCounts: { screenings_completed: 2, interviews_conducted: 1, feedback_submitted: 1, seats_joined: 1 } },
      ],
      funnel: [
        { label: 'Applications', count: 10, stepPercent: null },
        { label: 'Screened', count: 8, stepPercent: 80 },
        { label: 'Interviewed', count: 4, stepPercent: 50 },
        { label: 'Offered', count: 2, stepPercent: 50 },
        { label: 'Joined', count: 1, stepPercent: 50 },
      ],
    }));
    const shown = renderAt();
    const funnel = await screen.findByRole('list', { name: 'Hiring funnel counts' });
    expect(funnel).toHaveTextContent('Applications');
    expect(funnel).toHaveTextContent('10');
    expect(funnel).toHaveTextContent('Screened');
    expect(funnel).toHaveTextContent('8 (80%)');
    expect(funnel).toHaveTextContent('Joined');
    expect(funnel).toHaveTextContent('1 (50%)');
    expect(screen.getByText('Conversion: 10.0%')).toBeInTheDocument();

    const joiningsList = screen.getByRole('list', { name: 'Screenings completed: actual vs target' });
    expect(funnel.compareDocumentPosition(targetsTable()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(joiningsList).toHaveTextContent('Not set');
    expect(joiningsList).toHaveTextContent('Mariam Farag');
    expect(joiningsList).toHaveTextContent('8 actual');
    expect(joiningsList).toHaveTextContent('Youssef Ibrahim');
    expect(joiningsList).toHaveTextContent('2 actual');
    shown.unmount();

    api.getApi.mockResolvedValue(team({
      funnel: [
        { label: 'Applications', count: 0, stepPercent: null },
        { label: 'Screened', count: 0, stepPercent: null },
        { label: 'Interviewed', count: 0, stepPercent: null },
        { label: 'Offered', count: 0, stepPercent: null },
        { label: 'Joined', count: 0, stepPercent: null },
      ],
      tiles: { ...team().tiles, seats: tile(0, 8, 3, '0 jobs', false), overdueFollowUps: tile(0, 0, 0, '0 due', false) },
    }));
    renderAt();
    expect(await screen.findByText(`No applications in ${monthLabel(cairoMonth())}.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actual vs target' })).toBeInTheDocument();
    expect(screen.getByText(`No overdue follow-ups in ${monthLabel(cairoMonth())}.`)).toBeInTheDocument();
  });

  it('sends the selected site as branchId and keeps the team scope on direct reports', async () => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue(team({ sites: [{ id: 'b-riyadh', name: 'Riyadh' }] }));
    renderAt();
    await screen.findByRole('table', { name: 'Team targets & progress' });
    expect(urls().some((url) => url.includes('branchId=') || url.includes('managerId='))).toBe(false);
    await u.selectOptions(screen.getByLabelText('Site'), 'b-riyadh');
    await waitFor(() => expect(urls().filter((url) => url.includes('branchId=b-riyadh'))).toEqual(windowFor(cairoMonth(), 'b-riyadh')));
    expect(urls().some((url) => url.includes('managerId='))).toBe(false);
  });

  it('distinguishes 0 / 10, Not set, Target exceeded (12 / 10 capped at 100%), and Unavailable with Retry', async () => {
    const u = userEvent.setup();
    const zeroTarget = screeningTarget({
      id: 'tgt-zero',
      employeeId: 'u-m',
      metric: 'screenings_completed',
      target: 10,
      achieved: 0,
      remaining: 10,
      progressPercent: 0,
    });
    const exceededTarget = screeningTarget({
      id: 'tgt-exceed',
      employeeId: 'u-m',
      metric: 'interviews_conducted',
      metricLabel: 'Interviews conducted',
      target: 10,
      achieved: 12,
      remaining: 0,
      progressPercent: 120,
    });
    api.getApi.mockResolvedValueOnce(team({ targets: [zeroTarget, exceededTarget] }));
    const { unmount } = renderAt('/reports?month=2026-10');
    const matrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    const mariamRow = within(matrix).getAllByRole('row')[1]!;
    const cells = within(mariamRow).getAllByRole('cell');

    // Cell 0: Screening -> 0 / 10
    expect(cells[0]).toHaveTextContent('0 / 10');
    expect(cells[0]).toHaveTextContent('10 remaining · 0%');
    // Cell 1: Interviews -> 12 / 10 (exceeded, bar capped at 100%)
    expect(cells[1]).toHaveTextContent('12 / 10');
    const bar = within(cells[1]!).getByRole('progressbar', { name: 'Interviews progress for Mariam Farag' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(cells[1]).toHaveTextContent('Target exceeded');
    // Cell 2 & 3: Feedback & Joinings -> Not set
    expect(cells[2]).toHaveTextContent('Not set');
    expect(cells[3]).toHaveTextContent('Not set');
    unmount();

    // Unavailable state with Retry when targets cannot be loaded
    api.getApi.mockImplementation((url: string) => {
      if (String(url).startsWith('/results/targets')) {
        return Promise.resolve({ targets: [zeroTarget] });
      }
      return Promise.resolve(team({ targets: null }));
    });
    renderAt('/reports?month=2026-10');
    const errorMatrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    expect(within(errorMatrix).getAllByText('Unavailable').length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(errorMatrix).getByText('0 / 10')).toBeInTheDocument());
  });

  it('keeps All jobs and individual-job targets distinct without summing or overwriting scopes', async () => {
    const u = userEvent.setup();
    const allJobsTarget = screeningTarget({
      id: 'tgt-all',
      vacancyId: null,
      jobTitle: null,
      target: 15,
      achieved: 5,
      remaining: 10,
      progressPercent: 33,
    });
    const jobSpecificTarget = screeningTarget({
      id: 'tgt-v1',
      vacancyId: 'v1',
      jobTitle: 'HRIS Developer',
      target: 20,
      achieved: 8,
      remaining: 12,
      progressPercent: 40,
    });
    api.getApi.mockResolvedValue(
      team({
        targets: [allJobsTarget, jobSpecificTarget],
        jobOptions: [{ id: 'v1', title: 'HRIS Developer' }],
      }),
    );

    renderAt('/reports?month=2026-10');
    const matrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    // In "All jobs" scope, shows only the All jobs target (5 / 15), never 13 / 35 or 8 / 20
    expect(within(matrix).getByText('5 / 15')).toBeInTheDocument();
    expect(within(matrix).queryByText('8 / 20')).toBeNull();

    // Switch Job scope filter to HRIS Developer (v1)
    await u.selectOptions(screen.getByLabelText('Job scope'), 'v1');
    const updatedMatrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    await waitFor(() => expect(within(updatedMatrix).getByText('8 / 20')).toBeInTheDocument());
    expect(within(updatedMatrix).queryByText('5 / 15')).toBeNull();
  });

  it('keeps actual joining activity available even when no joining target is set', async () => {
    const u = userEvent.setup();
    const tiles = team().tiles;
    const mariamDetails = {
      seats: [
        {
          id: 'j1',
          applicationId: 'app-join-1',
          candidateName: 'Nour Adel',
          jobTitle: 'HRIS Developer',
          date: '2026-10-12',
          dateLabel: 'Actual joining date',
          status: 'Joined',
          counted: true,
        },
      ],
      overdueFollowUps: [],
      screensReachedInterview: [],
      offersAccepted: [],
    };
    api.getApi.mockResolvedValue(
      team({
        rows: [
          { person: { id: 'u-m', name: 'Mariam Farag' }, tiles: { ...tiles, seats: tile(2, 4, 2, '2 jobs', false) }, details: mariamDetails },
          { person: { id: 'u-y', name: 'Youssef Ibrahim' }, tiles },
        ],
        targets: [],
      }),
    );

    renderAt('/reports?month=2026-10');
    const matrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    const mariamRow = within(matrix).getAllByRole('row')[1]!;
    const joiningsCell = within(mariamRow).getAllByRole('cell')[3]!;
    expect(joiningsCell).toHaveTextContent('Not set');
    expect(joiningsCell).toHaveTextContent('2 achieved');

    await u.click(within(joiningsCell).getByRole('button', { name: 'View supporting records for Mariam Farag Confirmed joinings' }));
    const recordsTable = screen.getByRole('table', { name: 'Supporting records for Confirmed joinings' });
    expect(within(recordsTable).getByRole('rowheader', { name: 'Nour Adel' })).toBeInTheDocument();
    expect(within(recordsTable).getByRole('link', { name: 'Open file' })).toHaveAttribute(
      'href',
      '/applications/app-join-1?returnTo=%2Freports%3Fmonth%3D2026-10',
    );
  });

  it('month nav: previous month; next disabled on the current month', async () => {
    const u = userEvent.setup();
    renderAt();
    await screen.findByRole('table', { name: 'Team targets & progress' });
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(urls()).toEqual(windowFor(cairoMonth()));
    await u.click(screen.getByRole('button', { name: 'Previous month' }));
    const previous = shiftMonth(cairoMonth(), -1);
    await waitFor(() => expect(urls().slice(6)).toEqual(windowFor(previous)));
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
  });

  it('403 (no direct reports) → explained; 404 → not available; 500 → retry', async () => {
    const u = userEvent.setup();
    api.getApi.mockRejectedValueOnce(new ApiError(403, 'no reports'));
    const { unmount } = renderAt();
    expect(await screen.findByText(/Nobody reports to you yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    unmount();

    api.getApi.mockRejectedValueOnce(new ApiError(404, 'nf'));
    const r2 = renderAt();
    expect(await screen.findByText('Team result is not available yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    r2.unmount();

    api.getApi.mockRejectedValueOnce(new ApiError(500, 'Down'));
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Down');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Team targets & progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('Export downloads the month’s visible names and measures and leaves the salary figure out', async () => {
    const u = userEvent.setup();
    const blobs: Blob[] = [];
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) blobs.push(blob);
      return 'blob:team-result';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    let download = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    renderAt();
    await screen.findByRole('table', { name: 'Team targets & progress' });
    const callsBefore = api.getApi.mock.calls.length;
    await u.click(screen.getByRole('button', { name: 'Export' }));
    expect(click).toHaveBeenCalledOnce();
    expect(download).toBe(`team-result-${cairoMonth()}.csv`);
    expect(api.getApi).toHaveBeenCalledTimes(callsBefore);
    const csv = await blobs[0].text();
    expect(csv).toContain(monthLabel(cairoMonth()));
    expect(csv).toContain('All sites');
    expect(csv).toContain('Direct reports');
    expect(csv).toContain('Mariam Farag');
    expect(csv).toContain('Noura Al-Dosari');
    expect(csv).toContain('Youssef Ibrahim');
    expect(csv).toContain('4 of 8');
    expect(csv).not.toMatch(/75(?:\.0)?%/);
    expect(csv).not.toContain('999999');
    click.mockRestore();
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  });
});

describe('In-page target creation, inline editing, supporting records, history, and weekly mode', () => {
  it('opens supporting records in the page with filter-preserving Open file links and collapsible history', async () => {
    const u = userEvent.setup();
    const target = screeningTarget({
      records: [
        ...(screeningTarget().records ?? []),
        {
          id: 'rec-dated',
          applicationId: 'app-8',
          candidateName: 'Omar Nabil',
          jobTitle: 'HRIS Developer',
          date: '2026-11-02T10:00:00.000Z',
          dateLabel: 'Screened 2 Nov 2026',
          status: 'Counted',
          counted: true,
        },
      ],
    });
    api.getApi.mockResolvedValue(team({ targets: [target], sites: [{ id: 'b-riyadh', name: 'Riyadh' }] }));

    renderAt('/reports?month=2026-10&site=b-riyadh');
    const matrix = await screen.findByRole('table', { name: 'Team targets & progress' });
    expect(urls().some((url) => url.includes('/results/targets'))).toBe(false);

    const achievedBtn = within(matrix).getByRole('button', { name: 'View supporting records for Mariam Farag Screenings completed' });
    expect(achievedBtn).toHaveTextContent('8 / 20');
    await u.click(achievedBtn);

    const records = screen.getByRole('table', { name: 'Supporting records for Screenings completed' });
    expect(within(records).getByRole('columnheader', { name: 'Candidate' })).toBeInTheDocument();
    expect(within(records).getByRole('columnheader', { name: 'Completion date' })).toBeInTheDocument();
    expect(within(records).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(within(records).getByRole('rowheader', { name: 'Nour Adel' })).toBeInTheDocument();
    expect(within(records).getByRole('cell', { name: /Completed: 15 Oct 2026/ })).toBeInTheDocument();
    expect(within(records).getByRole('cell', { name: 'Screened 2 Nov 2026' })).toBeInTheDocument();
    expect(within(records).getAllByRole('link', { name: 'Open file' }).map((link) => link.getAttribute('href'))).toEqual([
      '/applications/app-9?returnTo=%2Freports%3Fmonth%3D2026-10%26site%3Db-riyadh',
      '/applications/app-8?returnTo=%2Freports%3Fmonth%3D2026-10%26site%3Db-riyadh',
    ]);

    // History stays collapsed until requested
    const summary=screen.getByText('Change history');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await u.click(summary);
    const historyBox=summary.closest('details')!;
    expect(historyBox).toHaveAttribute('open');
    expect(historyBox).toHaveTextContent('10 → 20');
    expect(historyBox).toHaveTextContent('Coverage for October hiring');
    expect(historyBox).toHaveTextContent('Hoda Samir');
  });

  it('saves all four monthly quantities in one request, with visible preview and no weekly writes; returns focus', async () => {
    const u=userEvent.setup();
    api.getApi.mockImplementation((url:string)=>Promise.resolve(url.startsWith('/results/targets')?{targets:[]}:team()));
    const saved=[['screenings_completed',20],['interviews_conducted',12],['feedback_submitted',10],['seats_joined',2]].map(([metric,target],i)=>screeningTarget({id:`plan-${i}`,metric:metric as EmployeeTargetItem['metric'],target:Number(target)}));
    api.postApi.mockResolvedValue({targets:saved});
    const {container}=renderAt('/reports?month=2026-10');
    await screen.findByRole('table',{name:'Team targets & progress'});
    const trigger=screen.getByRole('button',{name:'Set monthly targets'});
    await u.click(trigger);
    const editor=screen.getByRole('form',{name:'Monthly target plan'});
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.selectOptions(within(editor).getByLabelText('Employee'),'u-m');
    await waitFor(()=>expect(within(editor).getByLabelText('Screenings completed')).toBeEnabled());
    for(const [label,value]of [['Screenings completed','20'],['Interviews conducted','12'],['Feedback submitted','10'],['Confirmed joinings','2']])await u.type(within(editor).getByLabelText(label!),value!);
    await u.click(within(editor).getByText('Weekly distribution · automatic'));
    expect(within(editor).getByRole('region',{name:'Weekly distribution preview'})).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
    await u.click(within(editor).getByRole('button',{name:'Save monthly plan'}));
    await waitFor(()=>expect(screen.queryByRole('form',{name:'Monthly target plan'})).toBeNull());
    expect(api.postApi).toHaveBeenCalledTimes(1);
    expect(api.postApi).toHaveBeenCalledWith('/results/target-plans',{employeeId:'u-m',month:'2026-10',vacancyId:null,reason:'',targets:[
      {metric:'screenings_completed',targetQuantity:20,version:null},{metric:'interviews_conducted',targetQuantity:12,version:null},{metric:'feedback_submitted',targetQuantity:10,version:null},{metric:'seats_joined',targetQuantity:2,version:null},
    ]});
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(screen.getByText(/Monthly plan saved for October 2026/)).toBeInTheDocument();
  });

  it('keeps edits after a version conflict, reloads the whole plan, and saves with the latest version',async()=>{
    const u=userEvent.setup();let current=screeningTarget();
    api.getApi.mockImplementation((url:string)=>Promise.resolve(url.startsWith('/results/targets')?{targets:[current]}:team({targets:[current]})));
    api.postApi.mockRejectedValueOnce(new ApiError(409,'The monthly plan was updated.'));
    renderAt('/reports?month=2026-10');await screen.findByRole('table',{name:'Team targets & progress'});
    await u.click(screen.getByRole('button',{name:'Edit monthly plan for Mariam Farag'}));
    const editor=screen.getByRole('form',{name:'Monthly target plan'});
    const quantity=within(editor).getByLabelText('Screenings completed');await waitFor(()=>expect(quantity).toHaveValue(20));
    await u.clear(quantity);await u.type(quantity,'25');await u.type(within(editor).getByLabelText(/Reason for change/),'Coverage adjustment');
    await u.click(within(editor).getByRole('button',{name:'Save monthly plan'}));
    expect(await within(editor).findByText('The monthly plan was updated.')).toBeInTheDocument();expect(quantity).toHaveValue(25);
    current=screeningTarget({target:30,version:2});
    await u.click(within(editor).getByRole('button',{name:'Reload latest plan'}));await waitFor(()=>expect(quantity).toHaveValue(30));
    await u.clear(quantity);await u.type(quantity,'35');await u.type(within(editor).getByLabelText(/Reason for change/),'New coverage');
    api.postApi.mockResolvedValue({targets:[screeningTarget({target:35,version:3})]});
    await u.click(within(editor).getByRole('button',{name:'Save monthly plan'}));
    await waitFor(()=>expect(api.postApi).toHaveBeenLastCalledWith('/results/target-plans',expect.objectContaining({targets:[{metric:'screenings_completed',targetQuantity:35,version:2}]})));
  });

  it('guards unsaved employee/month changes and rejects fractional monthly input',async()=>{
    const u=userEvent.setup();
    api.getApi.mockImplementation((url:string)=>Promise.resolve(url.startsWith('/results/targets')?{targets:[]}:team()));
    renderAt('/reports?month=2026-10');await screen.findByRole('table',{name:'Team targets & progress'});
    await u.click(screen.getByRole('button',{name:'Edit monthly plan for Mariam Farag'}));
    const editor=screen.getByRole('form',{name:'Monthly target plan'});const quantity=within(editor).getByLabelText('Screenings completed');
    await waitFor(()=>expect(quantity).toBeEnabled());await u.type(quantity,'1.5');
    await u.click(within(editor).getByRole('button',{name:'Save monthly plan'}));expect(api.postApi).not.toHaveBeenCalled();
    expect(within(editor).getByRole('alert')).toHaveTextContent('positive whole number');
    await u.selectOptions(within(editor).getByLabelText('Employee'),'u-y');
    const prompt=screen.getByRole('alert',{name:'Unsaved monthly plan'});expect(prompt).toHaveTextContent('unsaved changes');
    await u.click(within(prompt).getByRole('button',{name:'Keep editing'}));expect(quantity).toHaveValue(1.5);
    await u.selectOptions(within(editor).getByLabelText('Employee'),'u-y');await u.click(screen.getByRole('button',{name:'Discard changes'}));
    await waitFor(()=>expect(within(editor).getByLabelText('Employee')).toHaveValue('u-y'));await waitFor(()=>expect(quantity).toHaveValue(null));
  });

  it('reloads site-scoped progress after saving a monthly plan instead of applying unfiltered achieved counts',async()=>{
    const u=userEvent.setup();const existing=screeningTarget({achieved:2});
    const refreshed=screeningTarget({target:25,achieved:3,version:2});
    api.getApi.mockImplementation((url:string)=>Promise.resolve(url.startsWith('/results/targets')?{targets:url.includes('employeeId=')?[existing]:[refreshed]}:team({targets:[existing]})));
    api.postApi.mockResolvedValue({targets:[screeningTarget({target:25,achieved:99,version:2})]});
    renderAt('/reports?month=2026-10&site=b-riyadh');await screen.findByRole('table',{name:'Team targets & progress'});
    await u.click(screen.getByRole('button',{name:'Edit monthly plan for Mariam Farag'}));
    const editor=screen.getByRole('form',{name:'Monthly target plan'});const quantity=within(editor).getByLabelText('Screenings completed');
    await waitFor(()=>expect(quantity).toHaveValue(20));await u.clear(quantity);await u.type(quantity,'25');await u.type(within(editor).getByLabelText(/Reason for change/),'Site coverage');
    await u.click(within(editor).getByRole('button',{name:'Save monthly plan'}));
    await waitFor(()=>expect(within(targetsTable()).getByText('3 / 25')).toBeInTheDocument());
    expect(within(targetsTable()).queryByText('99 / 25')).toBeNull();
    expect(urls()).toContain('/results/targets?scope=team&periodType=monthly&periodKey=2026-10&branchId=b-riyadh');
  });

  it('switches to real Weekly analytics with a weekly funnel, counts and targets, without using monthly totals', async () => {
    const u=userEvent.setup();
    const week=cairoWeek();
    const weeklyTarget=screeningTarget({id:'weekly-target',periodType:'weekly',periodKey:week,periodLabel:'Week of 2 Nov 2026',target:5,achieved:2,remaining:3,progressPercent:40});
    api.getApi.mockImplementation((url:string)=>{
      if(url.includes('periodType=weekly'))return Promise.resolve(team({periodType:'weekly',periodKey:week,periodLabel:'Week of 2 Nov 2026',targets:[weeklyTarget],tiles:{...team().tiles,seats:tile(1,2,2,'',false),offersAccepted:tile(2,6,6,'',false)},funnel:[{label:'Applications',count:3,stepPercent:null},{label:'Screened',count:2,stepPercent:67}]}));
      return Promise.resolve(team());
    });
    renderAt('/reports?month=2026-10');
    await screen.findByRole('table',{name:'Team targets & progress'});
    await u.click(screen.getByRole('button',{name:'Weekly'}));
    await waitFor(()=>expect(urls()).toContain(`/results/team?periodType=weekly&periodKey=${week}`));
    expect(await screen.findByText('2 / 5')).toBeInTheDocument();
    const kpis=screen.getByRole('list',{name:'Team summary for Week of 2 Nov 2026'});
    expect(kpiItem(kpis,'Confirmed joinings')).toHaveTextContent('1');
    expect(kpiItem(kpis,'Offer acceptance')).toHaveTextContent('33.3%');
    expect(screen.getByRole('list',{name:'Hiring funnel counts'})).toHaveTextContent('3');
    expect(screen.queryByText(/Calculated for calendar months only/)).toBeNull();
    expect(screen.queryByText(/Weekly hiring funnel is not available/)).toBeNull();
  });

  it('opens recruiter performance drill-down from Details and refuses someone outside direct reports', async () => {
    const u = userEvent.setup();
    renderAt('/reports?recruiter=u-stranger');
    expect(await screen.findByRole('alert')).toHaveTextContent('This person is not one of your direct reports in Team result.');
    await u.click(screen.getByRole('button', { name: 'Back to Team result' }));
    expect(screen.getByRole('heading', { name: 'Team results' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Open performance details for Mariam Farag' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Mariam Farag - /);
    expect(screen.getByRole('list', { name: 'Recruiter delivery measures' })).toHaveTextContent('4 of 8');
  });
});
