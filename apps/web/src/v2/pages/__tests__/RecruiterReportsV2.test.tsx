import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportOverview, UserProfile } from '@recruitflow/contracts';
import type * as ApiClientModule from '../../../api/client';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { AppShellV2 } from '../../../components/v2/shell/AppShellV2';
import { ThemeProvider } from '../../../theme/ThemeContext';
import { RecruiterReportsV2 } from '../RecruiterReportsV2';

const api = vi.hoisted(() => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
}));

vi.mock('../../../api/client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('../../../api/client');
  return {
    ...actual,
    getApi: (path: string, opts?: unknown) => api.getApi(path, opts),
    postApi: (path: string, body?: unknown) => api.postApi(path, body),
  };
});

vi.mock('../../../quickguide', () => ({
  QuickGuideProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  QuickGuideModal: () => null,
  useQuickGuide: () => ({ openGuide: vi.fn() }),
}));

const employeeUser: UserProfile = {
  id: 'u-rec',
  email: 'recruiter@sgh.test',
  displayName: 'Sarah Ahmed',
  organizationId: 'org-1',
  organizationName: 'SGH',
  roles: [{ id: 'r-rec', code: 'RECRUITER', name: 'Recruiter' }],
  permissions: ['APPLICATION_VIEW', 'VACANCY_VIEW', 'CANDIDATE_VIEW'],
  lastLoginAt: null,
};

function makeOverview(overrides: Partial<ReportOverview> = {}): ReportOverview {
  return {
    asOf: '2026-10-31T10:30:00.000Z',
    range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' },
    kpis: {
      timeToFill: { value: 18, sampleCount: 1 },
      timeToOffer: { value: 12, target: 25 },
      offerAcceptanceRate: { value: 50, accepted: 1, total: 2 },
      interviewNoShowRate: { value: 0, noShows: 0, total: 3 },
      topSource: { name: 'LinkedIn', conversionRate: 20 },
      totalJoined: { count: 1, branches: 1 },
    },
    summaryCards: {
      newCandidates: { count: 6, previousCount: 5, changePct: 20 },
      interviewsScheduled: { count: 3, previousCount: 2, changePct: 50 },
      offersSent: { count: 2, previousCount: 2, changePct: 0 },
      hires: { count: 1, previousCount: 0, changePct: null },
    },
    topJobs: [
      { vacancyId: 'vac-1', jobTitle: 'Registered Nurse', vacancyCode: 'VAC-101', applicationsCount: 4, joinedCount: 1 },
      { vacancyId: 'vac-2', jobTitle: 'Medical Coder', vacancyCode: 'VAC-102', applicationsCount: 2, joinedCount: 0 },
    ],
    trend: [
      { periodStart: '2026-10-05T00:00:00.000Z', label: 'Oct 5', applications: 4, interviews: 2, offers: 1, joined: 1 },
      { periodStart: '2026-10-12T00:00:00.000Z', label: 'Oct 12', applications: 2, interviews: 1, offers: 1, joined: 0 },
      { periodStart: '2026-10-19T00:00:00.000Z', label: 'Oct 19', applications: 0, interviews: 0, offers: 0, joined: 0 },
    ],
    sourceBreakdown: [],
    funnel: [],
    hiringByPosition: [],
    recruiterWorkload: [],
    filterOptions: {
      branches: [],
      positions: [],
      recruiters: [],
      vacancies: [
        { id: 'vac-1', label: 'Registered Nurse (VAC-101)' },
        { id: 'vac-2', label: 'Medical Coder (VAC-102)' },
      ],
    },
    reachedFunnel: {
      cohortTotal: 6,
      reachedInterview: 3,
      joined: 1,
      tooFewToJudge: false,
      stages: [
        { stage: 'Applied', label: 'Applied', reachedCount: 6, pctOfCohort: 100 },
        { stage: 'Screening', label: 'Screening', reachedCount: 5, pctOfCohort: 83 },
        { stage: 'Interview', label: 'Interview', reachedCount: 3, pctOfCohort: 50 },
        { stage: 'Offer', label: 'Offer', reachedCount: 1, pctOfCohort: 17 },
        { stage: 'Pre-Hire', label: 'Pre-Hire', reachedCount: 1, pctOfCohort: 17 },
        { stage: 'Joined', label: 'Joined', reachedCount: 0, pctOfCohort: 0 },
      ],
      outcomes: [
        { outcome: 'REJECTED', label: 'Rejected', count: 1, pctOfCohort: 17 },
        { outcome: 'WITHDRAWN', label: 'Withdrawn', count: 1, pctOfCohort: 17 },
      ],
      records: [
        {
          applicationId: 'app-1',
          candidateId: 'cand-1',
          candidateName: 'Mariam Essam',
          vacancyId: 'vac-1',
          jobTitle: 'Registered Nurse',
          currentStage: 'Interview',
          reachedStages: ['Applied', 'Screening', 'Interview'],
          outcome: 'ACTIVE',
          ownerName: 'Sarah Ahmed',
          blockerSummary: 'Pending scorecard (Dr. Nour Ali)',
          appliedAt: '2026-10-05T09:00:00.000Z',
          updatedAt: '2026-10-20T09:00:00.000Z',
        },
        {
          applicationId: 'app-2',
          candidateId: 'cand-2',
          candidateName: 'Omar Hassan',
          vacancyId: 'vac-2',
          jobTitle: 'Medical Coder',
          currentStage: 'Rejected',
          reachedStages: ['Applied', 'Screening', 'Interview'],
          outcome: 'REJECTED',
          ownerName: 'Sarah Ahmed',
          blockerSummary: 'Closed (Rejected)',
          appliedAt: '2026-10-12T09:00:00.000Z',
          updatedAt: '2026-10-18T09:00:00.000Z',
        },
      ],
    },
    sourcePerformance: {
      totalApplicants: 6,
      totalReachedInterview: 3,
      totalJoined: 1,
      sources: [
        {
          source: 'LinkedIn',
          applicants: 4,
          reachedInterview: 2,
          joined: 1,
          interviewRatePct: 50,
          hireRatePct: 25,
          tooFewToJudge: true,
        },
        {
          source: 'Referral',
          applicants: 2,
          reachedInterview: 1,
          joined: 0,
          interviewRatePct: 50,
          hireRatePct: 0,
          tooFewToJudge: true,
        },
      ],
      records: [
        {
          applicationId: 'app-1',
          candidateId: 'cand-1',
          candidateName: 'Mariam Essam',
          vacancyId: 'vac-1',
          jobTitle: 'Registered Nurse',
          source: 'LinkedIn',
          rawSource: 'linkedin.com',
          currentStage: 'Interview',
          reachedInterview: true,
          joined: false,
          ownerName: 'Sarah Ahmed',
          appliedAt: '2026-10-05T09:00:00.000Z',
        },
        {
          applicationId: 'app-2',
          candidateId: 'cand-2',
          candidateName: 'Omar Hassan',
          vacancyId: 'vac-2',
          jobTitle: 'Medical Coder',
          source: 'Referral',
          rawSource: 'Employee Ref',
          currentStage: 'Rejected',
          reachedInterview: true,
          joined: false,
          ownerName: 'Sarah Ahmed',
          appliedAt: '2026-10-12T09:00:00.000Z',
        },
      ],
    },
    ...overrides,
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function renderReports(initialEntry = '/reports') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<AppShellV2 user={employeeUser} seat="employee" onSignOut={() => {}} />}>
            <Route
              path="/reports"
              element={
                <>
                  <LocationProbe />
                  <RecruiterReportsV2 />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('RecruiterReportsV2 — single-page recruitment analytics dashboard', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.postApi.mockReset();
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/notifications/unread-count') return { unreadCount: 0 };
      if (path.startsWith('/reports/overview')) return makeOverview();
      return {};
    });
  });

  it('renders the header, 4 summary cards with honest growth comparison, and the 2x2 analytics grid without report tabs', async () => {
    const u = userEvent.setup();
    renderReports('/reports');

    const summaryRegion = await screen.findByRole('region', { name: 'Recruitment summary' });
    expect(screen.getAllByRole('heading', { level: 1, name: 'Reports' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Get insights into your recruitment activity.')).toBeInTheDocument();

    // No report tabs exist
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    // Default filters at upper right: Last 30 days and All jobs
    const periodSelect = screen.getByRole('combobox', { name: 'Period' }) as HTMLSelectElement;
    const jobSelect = screen.getByRole('combobox', { name: 'Job' }) as HTMLSelectElement;
    expect(periodSelect.value).toBe('30d');
    expect(jobSelect.value).toBe('all');

    // 4 summary cards
    expect(within(summaryRegion).getByText('New candidates')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('Interviews scheduled')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('Offers sent')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('Hires')).toBeInTheDocument();

    expect(screen.getByTestId('kpi-new-candidates')).toHaveTextContent('6');
    expect(screen.getByTestId('kpi-interviews-scheduled')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-offers-sent')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-hires')).toHaveTextContent('1');

    // Growth percentages shown only when valid previous-period comparison exists
    expect(within(summaryRegion).getByText('↑ 20%')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('↑ 50%')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('0%')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('No prior baseline')).toBeInTheDocument();

    // 1. Applications trend with hover tooltip and 0% bar for zero applications
    expect(screen.getByRole('heading', { name: 'Applications trend' })).toBeInTheDocument();
    expect(screen.getByTestId('trend-bar-2')).toHaveStyle({ height: '0%' });
    const firstTrendBtn = screen.getByRole('button', { name: /5 Oct 2026: 4 applications/i });
    await u.hover(firstTrendBtn);
    expect(await screen.findByTestId('trend-tooltip')).toHaveTextContent('5 Oct 2026');
    expect(screen.getByTestId('trend-tooltip')).toHaveTextContent('4 applications');

    // 2. Applications by source doughnut total reconciles with source counts
    expect(screen.getByRole('heading', { name: 'Applications by source' })).toBeInTheDocument();
    expect(screen.getByTestId('source-donut-total')).toHaveTextContent('6');
    expect(screen.getByTestId('source-val-LinkedIn')).toHaveTextContent('4 (67%)');
    expect(screen.getByTestId('source-val-Referral')).toHaveTextContent('2 (33%)');

    // 3. Top jobs by applications
    expect(screen.getByRole('heading', { name: 'Top jobs by applications' })).toBeInTheDocument();
    expect(screen.getByTestId('topjob-bar-Registered Nurse')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('topjob-bar-Medical Coder')).toHaveStyle({ width: '50%' });

    // 4. Stage conversion (Applied, Screening, Interview, Offer, Hired)
    expect(screen.getByRole('heading', { name: 'Stage conversion' })).toBeInTheDocument();
    expect(screen.getByTestId('funnel-val-Applied')).toHaveTextContent('100% (6)');
    expect(screen.getByTestId('funnel-val-Screening')).toHaveTextContent('83% (5)');
    expect(screen.getByTestId('funnel-val-Interview')).toHaveTextContent('50% (3)');
    expect(screen.getByTestId('funnel-val-Offer')).toHaveTextContent('17% (1)');
    expect(screen.getByTestId('funnel-val-Hired')).toHaveTextContent('0% (0)');
    expect(screen.getByTestId('funnel-bar-Hired')).toHaveStyle({ width: '0%' });
  });

  it('opens requested details within the same page while preserving filters when clicking charts or cards', async () => {
    const u = userEvent.setup();
    renderReports('/reports?job=vac-1');

    await screen.findByRole('region', { name: 'Recruitment summary' });
    expect(screen.queryByRole('region', { name: 'Selected report details' })).not.toBeInTheDocument();

    // Click Referral in Applications by source
    await u.click(screen.getByRole('button', { name: /Referral/i }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/reports?job=vac-1&source=Referral');

    const detailsRegion = await screen.findByRole('region', { name: 'Selected report details' });
    expect(within(detailsRegion).getByText('Applications by source: Referral')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Omar Hassan')).toBeInTheDocument();
    expect(within(detailsRegion).queryByText('Mariam Essam')).not.toBeInTheDocument();

    // Open file link preserves returnTo with active filters
    const openLink = within(detailsRegion).getByRole('link', { name: 'Open file' });
    expect(openLink.getAttribute('href')).toContain(
      `returnTo=${encodeURIComponent('/reports?job=vac-1&source=Referral')}`,
    );

    // Click Registered Nurse in Top jobs by applications
    await u.click(screen.getByRole('button', { name: /Registered Nurse/i }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/reports?job=vac-1&drillJob=Registered+Nurse');
    expect(within(detailsRegion).getByText('Top job: Registered Nurse')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Mariam Essam')).toBeInTheDocument();

    // Close details
    await u.click(within(detailsRegion).getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('region', { name: 'Selected report details' })).not.toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/reports?job=vac-1');
  });

  it('updates period and job filters and handles small-sample, error, and forbidden states honestly', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementationOnce(async () =>
      makeOverview({
        reachedFunnel: {
          ...makeOverview().reachedFunnel!,
          cohortTotal: 3,
          tooFewToJudge: true,
        },
      }),
    );

    renderReports('/reports');
    expect(await screen.findByTestId('conversion-small-sample')).toHaveTextContent('Too few to judge (n=3)');

    // Filter by job
    await u.selectOptions(screen.getByRole('combobox', { name: 'Job' }), 'vac-1');
    await waitFor(() => {
      const reportCalls = api.getApi.mock.calls.filter(([p]) => String(p).startsWith('/reports/overview'));
      expect(reportCalls.at(-1)?.[0]).toContain('vacancyId=vac-1');
    });

    // Error state and retry
    api.getApi.mockRejectedValueOnce(new ApiError(500, 'Database connection timeout'));
    await u.selectOptions(screen.getByRole('combobox', { name: 'Period' }), '90d');
    expect(await screen.findByText('Could not load reports')).toBeInTheDocument();
    expect(screen.getByText('Database connection timeout')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Applications trend' })).toBeInTheDocument();
  });

  it('passes axe accessibility checks and supports stage conversion, summary card, and date drilldowns plus 403 state', async () => {
    const u = userEvent.setup();
    const { container, unmount } = renderReports('/reports');

    await screen.findByRole('region', { name: 'Recruitment summary' });
    expect(await axeViolations(container)).toEqual([]);

    // Click Interview stage in Stage conversion
    await u.click(screen.getByRole('button', { name: 'Interview: 50% (3)' }));
    const detailsRegion = await screen.findByRole('region', { name: 'Selected report details' });
    expect(within(detailsRegion).getByText('Stage conversion: Interview')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Mariam Essam')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Omar Hassan')).toBeInTheDocument();

    // Click New candidates summary card
    await u.click(screen.getByRole('button', { name: /New candidates/i }));
    expect(within(detailsRegion).getByText('New candidates in period')).toBeInTheDocument();

    // Click a trend bar (5 Oct 2026)
    await u.click(screen.getByRole('button', { name: /5 Oct 2026: 4 applications/i }));
    expect(within(detailsRegion).getByText('Applications on 5 Oct 2026')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Mariam Essam')).toBeInTheDocument();
    expect(within(detailsRegion).queryByText('Omar Hassan')).not.toBeInTheDocument();

    unmount();

    // 403 Forbidden state
    api.getApi.mockRejectedValueOnce(new ApiError(403, 'Forbidden'));
    renderReports('/reports');
    expect(await screen.findByText('Your role does not include reports.')).toBeInTheDocument();
  });
});
