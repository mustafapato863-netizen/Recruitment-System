import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerDashboard } from '../ManagerDashboard';
import { getApi } from '../../api/client';

let mockUser: {
  id: string;
  displayName: string;
  email: string;
  roles: Array<{ id: string; name: string; code: string }>;
  permissions: string[];
} = {
  id: 'user-1',
  displayName: 'Sarah Recruiter',
  email: 'sarah@sgh.com',
  roles: [{ id: 'r1', name: 'Recruiter', code: 'RECRUITER' }],
  permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW'],
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock('../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
}));

const mockVacancies = [
  {
    id: 'vac-assigned',
    title: 'Senior ICU Nurse',
    position: { title: 'Senior ICU Nurse' },
    department: 'Critical Care',
    location: 'Riyadh',
    status: 'Open',
    assignments: [{ user: { id: 'rec-1', displayName: 'Ganna Farid' } }],
    applicationsCount: 3,
    approvedHeadcount: 2,
    joinedHeadcount: 0,
    funnelCounts: { applied: 3, screening: 1, interviews: 0, offer: 0, preHire: 0, joined: 0 },
  },
  {
    id: 'vac-unassigned',
    title: 'Clinical Pharmacist',
    position: { title: 'Clinical Pharmacist' },
    department: 'Pharmacy',
    location: 'Jeddah',
    status: 'Open',
    assignments: [],
    applicationsCount: 1,
    approvedHeadcount: 1,
    joinedHeadcount: 0,
    funnelCounts: { applied: 1, screening: 0, interviews: 0, offer: 0, preHire: 0, joined: 0 },
  },
];

describe('ManagerDashboard Permission Gating for Reassign and Targets', () => {
  const mockGetApi = vi.mocked(getApi);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApi.mockImplementation(
      ((url: string) => {
        if (url.startsWith('/vacancies')) {
          return Promise.resolve(mockVacancies);
        }
        if (url.startsWith('/applications')) {
          return Promise.resolve({ data: [] });
        }
        if (url.startsWith('/reports/overview')) {
          return Promise.resolve({ kpis: {} });
        }
        if (url.startsWith('/interviews')) {
          return Promise.resolve([]);
        }
        if (url.startsWith('/users/interviewers')) {
          return Promise.resolve([{ id: 'rec-1', displayName: 'Ganna Farid', roleCode: 'RECRUITER' }]);
        }
        if (url.startsWith('/recruiter-targets/my')) {
          return Promise.resolve([]);
        }
        if (url.startsWith('/recruiter-targets')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }) as unknown as typeof getApi,
    );
  });

  it('hides all reassignment and target buttons for standard recruiters', async () => {
    mockUser = {
      id: 'rec-1',
      displayName: 'Sarah Ahmed',
      email: 'sarah@sgh.com',
      roles: [{ id: 'r1', name: 'Recruiter', code: 'RECRUITER' }],
      permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW'],
    };

    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>
    );

    // Wait for vacancies to load
    await waitFor(() => {
      expect(screen.getByText('Senior ICU Nurse')).toBeInTheDocument();
    });

    // 1. Top header "Assign Vacancy & Target" button must NOT be present
    expect(screen.queryByRole('button', { name: /assign vacancy & target/i })).toBeNull();

    // 2. Performance widget "+ Set Vacancy Target" button must NOT be present
    expect(screen.queryByRole('button', { name: /set vacancy target/i })).toBeNull();

    // 3. Recruiter targets "+ Set Target" button must NOT be present (MyTargetsWidget is shown instead)
    expect(screen.queryByRole('button', { name: /^set target$/i })).toBeNull();

    // 4. Open Jobs "Reassign" and "Assign & Target" buttons must NOT be present
    expect(screen.queryByRole('button', { name: /reassign/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /assign & target/i })).toBeNull();
  });

  it('shows assign and target buttons but hides reassign when Team Leader has VACANCY_ASSIGN but lacks VACANCY_REASSIGN', async () => {
    mockUser = {
      id: 'tl-1',
      displayName: 'Mona TeamLeader',
      email: 'mona@sgh.com',
      roles: [{ id: 'r2', name: 'Recruitment Team Leader', code: 'TEAM_LEADER' }],
      permissions: ['VACANCY_VIEW', 'VACANCY_ASSIGN'], // Has assign, lacks reassign
    };

    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Nurse')).toBeInTheDocument();
    });

    // 1. Header button is visible because user can assign
    expect(screen.getByRole('button', { name: /assign vacancy & target/i })).toBeInTheDocument();

    // 2. Set Vacancy Target is visible
    expect(screen.getByRole('button', { name: /set vacancy target/i })).toBeInTheDocument();

    // 3. Set Target in RecruiterTargetsSection is visible
    expect(screen.getByRole('button', { name: /set target/i })).toBeInTheDocument();

    // 4. Unassigned vacancy has "Assign & Target" button
    expect(screen.getByRole('button', { name: /assign & target/i })).toBeInTheDocument();

    // 5. Assigned vacancy must NOT have "Reassign" button because user lacks VACANCY_REASSIGN
    expect(screen.queryByRole('button', { name: /reassign/i })).toBeNull();
  });

  it('shows reassign button when Team Leader has VACANCY_REASSIGN', async () => {
    mockUser = {
      id: 'tl-1',
      displayName: 'Mona TeamLeader',
      email: 'mona@sgh.com',
      roles: [{ id: 'r2', name: 'Recruitment Team Leader', code: 'TEAM_LEADER' }],
      permissions: ['VACANCY_VIEW', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN'],
    };

    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Nurse')).toBeInTheDocument();
    });

    // Assigned vacancy now has "Reassign" button
    expect(screen.getByRole('button', { name: /reassign/i })).toBeInTheDocument();
  });

  it('shows all buttons for Administrator', async () => {
    mockUser = {
      id: 'admin-1',
      displayName: 'System Administrator',
      email: 'admin@sgh.com',
      roles: [{ id: 'r-admin', name: 'Administrator', code: 'ADMINISTRATOR' }],
      permissions: ['VACANCY_VIEW', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN'],
    };

    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Nurse')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /assign vacancy & target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set vacancy target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reassign/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign & target/i })).toBeInTheDocument();
  });
});
