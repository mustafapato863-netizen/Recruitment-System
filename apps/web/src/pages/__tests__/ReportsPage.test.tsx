import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from '../ReportsPage';
import { getApi } from '../../api/client';

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  downloadApi: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      displayName: 'System Admin',
      email: 'admin@hospital.sa',
      roles: [{ id: 'r1', name: 'ADMIN', code: 'ADMIN' }],
      permissions: ['REPORTS_VIEW'],
    },
  }),
}));

describe('ReportsPage - Recruitment KPIs Scorecard & Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApi).mockResolvedValue({
      range: { from: '2026-08-01', to: '2026-08-31' },
      comparisonRange: { from: '2026-07-01', to: '2026-07-31' },
      kpis: {
        totalJoined: { count: 12, changePct: 5 },
        timeToFill: { value: 24, changePct: -10 },
        offerAcceptanceRate: { value: 92, changePct: 2 },
        interviewNoShowRate: { value: 15, changePct: -3 },
        topSource: { name: 'LinkedIn', count: 40, conversionRate: 18 },
      },
      trend: [],
      funnel: [],
      sources: [],
      comparison: { applications: 100, interviews: 50, offers: 20, joined: 12 },
      hiringByPosition: [],
      recruiterWorkload: [],
      filterOptions: { positions: [], recruiters: [] },
      recruitmentKpis: [
        {
          id: 'kpi-invitation',
          position: 'Recruitment',
          name: 'Invitation',
          definition: 'Measures the percentage of sourced candidate’s actual attending the interviews.',
          currentValue: 85,
          formattedValue: '85%',
          targetValue: 80,
          formattedTarget: '80%',
          unit: '%',
          achievementRate: 100,
          status: 'On Target',
          notes: '17 attended of 20 scheduled',
        },
        {
          id: 'kpi-accepted-final',
          position: 'Recruitment',
          name: 'Accepted Final',
          definition: 'Measures the percentage of candidates who accepted the final offer Vs target',
          currentValue: 92,
          formattedValue: '92%',
          targetValue: 100,
          formattedTarget: '100%',
          unit: '%',
          achievementRate: 92,
          status: 'On Target',
          notes: '11 accepted offers vs 12 target positions',
        },
        {
          id: 'kpi-offers',
          position: 'Recruitment',
          name: 'Offers',
          definition: 'Measures the percentage of offers Vs. target.',
          currentValue: 96,
          formattedValue: '96%',
          targetValue: 100,
          formattedTarget: '100%',
          unit: '%',
          achievementRate: 96,
          status: 'On Target',
          notes: '12 extended offers vs 12 target positions',
        },
        {
          id: 'kpi-hires',
          position: 'Recruitment',
          name: 'Hires',
          definition: 'Measures the percentage of hires vs the target',
          currentValue: 88,
          formattedValue: '88%',
          targetValue: 100,
          formattedTarget: '100%',
          unit: '%',
          achievementRate: 88,
          status: 'On Target',
          notes: '10 confirmed hires vs 12 target positions',
        },
        {
          id: 'kpi-time-to-fill',
          position: 'Recruitment',
          name: 'Time to Fill',
          definition: 'The total number of calendar days from when a job requisition is approved to when a candidate accepts the Hire.',
          currentValue: 24,
          formattedValue: '24 Days',
          targetValue: 30,
          formattedTarget: '≤ 30 Days',
          unit: 'Days',
          achievementRate: 100,
          status: 'On Target',
          notes: 'Requisition opening to hire acceptance',
        },
        {
          id: 'kpi-quality-of-hire',
          position: 'Recruitment',
          name: 'Quality of Hire (Probation Success Rate)',
          definition: 'The percentage of new hires who successfully complete their probation period and meet performance expectations.',
          currentValue: 94,
          formattedValue: '94%',
          targetValue: 90,
          formattedTarget: '≥ 90%',
          unit: '%',
          achievementRate: 100,
          status: 'On Target',
          notes: '90-day post-joining retention & performance success',
        },
      ],
    });
  });

  it('renders overview initially and toggles to Recruitment KPIs scorecard view', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Recruitment Reports')).toBeInTheDocument();
    expect(screen.getByText('Executive Overview')).toBeInTheDocument();
    expect(screen.getByText('Recruitment KPIs Scorecard')).toBeInTheDocument();

    // Click Recruitment KPIs Scorecard
    const kpiTab = screen.getByRole('button', { name: /Recruitment KPIs Scorecard/i });
    await user.click(kpiTab);

    // Verify all 6 KPIs are displayed
    expect(await screen.findByText('Recruitment Key Performance Indicators (KPIs)')).toBeInTheDocument();
    expect(screen.getAllByText('Invitation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Accepted Final').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Offers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hires').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Time to Fill').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quality of Hire (Probation Success Rate)').length).toBeGreaterThan(0);

    // Verify extraction action buttons exist
    expect(screen.getByRole('button', { name: /Extract KPIs \(\.csv\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extract Recruitment KPIs \(\.csv\)/i })).toBeInTheDocument();

    // Verify weights are NOT displayed anywhere (e.g. "KPI Weight", "10%", "20%", "30%")
    expect(screen.queryByText(/KPI Weight/i)).not.toBeInTheDocument();
  });

  it('triggers CSV extraction for the 6 Recruitment KPIs', async () => {
    const user = userEvent.setup();
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    const kpiTab = await screen.findByRole('button', { name: /Recruitment KPIs Scorecard/i });
    await user.click(kpiTab);

    const extractBtn = screen.getByRole('button', { name: /Extract KPIs \(\.csv\)/i });
    await user.click(extractBtn);

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });
});
