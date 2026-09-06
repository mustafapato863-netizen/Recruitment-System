import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecruitmentCommandCenter } from '../RecruitmentCommandCenter';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'recruiter-1',
      displayName: 'Ahmad Recruiter',
      email: 'ahmad@saudigerman.com',
      roles: [{ id: 'r-recruiter', name: 'RECRUITER', code: 'RECRUITER' }],
      permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW', 'VACANCY_REQUEST_APPROVE'],
    },
  }),
}));

vi.mock('../../api/client', () => ({
  getApi: vi.fn((url: string) => {
    if (url === '/vacancies') {
      return Promise.resolve([
        {
          id: 'vac-1',
          vacancyCode: 'VAC-101',
          title: 'Senior ICU Specialist',
          department: 'Intensive Care Unit',
          location: 'Riyadh Hospital',
          workType: 'Full-time',
          status: 'Open',
          approvedHeadcount: 3,
          joinedHeadcount: 1,
          applicationsCount: 8,
          needActionCount: 2,
          slaPercent: 95,
          isOverdue: false,
          recruiter: {
            id: 'recruiter-1',
            displayName: 'Ahmad Recruiter',
          },
        },
        {
          id: 'vac-2',
          vacancyCode: 'VAC-102',
          title: 'Emergency Medicine Consultant',
          department: 'Emergency Room',
          location: 'Jeddah Hospital',
          workType: 'Shift-based',
          status: 'On Hold',
          approvedHeadcount: 2,
          joinedHeadcount: 0,
          applicationsCount: 4,
          needActionCount: 0,
          slaPercent: 70,
          isOverdue: true,
          recruiter: {
            id: 'recruiter-2',
            displayName: 'Fatima HR',
          },
        },
      ]);
    }
    if (url.includes('/inbox') || url.includes('/final-approvals')) {
      return Promise.resolve([{ id: 'inbox-1' }, { id: 'inbox-2' }]);
    }
    return Promise.resolve([]);
  }),
}));

describe('RecruitmentCommandCenter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders command center with KPIs and position cards', async () => {
    render(
      <MemoryRouter>
        <RecruitmentCommandCenter />
      </MemoryRouter>
    );

    expect(screen.getByText('Recruitment Command Center')).toBeInTheDocument();
    expect(screen.getByText('Live Operations')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();
      expect(screen.getByText('Emergency Medicine Consultant')).toBeInTheDocument();
    });

    expect(screen.getByText('VAC-101')).toBeInTheDocument();
    expect(screen.getByText('VAC-102')).toBeInTheDocument();

    // Check KPI strip
    expect(screen.getByText('Open Requisitions')).toBeInTheDocument();
    expect(screen.getByText('Active Candidates')).toBeInTheDocument();
    expect(screen.getByText('Approval Inbox')).toBeInTheDocument();
  });

  it('filters requisitions by status tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RecruitmentCommandCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();
    });

    // Switch to Open positions tab
    const openTab = screen.getByRole('button', { name: 'Open' });
    await user.click(openTab);

    expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();
    expect(screen.queryByText('Emergency Medicine Consultant')).not.toBeInTheDocument();
  });

  it('navigates directly to the vacancy-scoped pipeline when clicking application button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RecruitmentCommandCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('8 Applications')).toBeInTheDocument();
    });

    const appBtn = screen.getByRole('button', { name: /8 Applications/i });
    await user.click(appBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/applications?vacancyId=vac-1');
  });
});
