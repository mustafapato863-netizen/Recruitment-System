import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VacancyOverviewPage } from '../VacancyOverviewPage';
import { VacantListPage } from '../VacantListPage';
import { fetchApi, getApi, postApi } from '../../api/client';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockPermissions: string[] = ['VACANCY_VIEW', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN'];

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'manager-1',
      displayName: 'Lead Manager',
      email: 'manager@hospital.sa',
      roles: [{ id: 'r1', name: 'MANAGER', code: 'MANAGER' }],
      permissions: mockPermissions,
    },
  }),
}));

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  downloadApi: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

describe('Vacancy Assignment and Activation Flow', () => {
  const mockGetApi = vi.mocked(getApi);
  const mockFetchApi = vi.mocked(fetchApi);
  const mockPostApi = vi.mocked(postApi);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = ['VACANCY_VIEW', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN'];
  });

  const mockVacancyUnassigned = {
    id: 'vac-1',
    title: 'Senior Frontend Engineer',
    position: { id: 'pos-1', title: 'Senior Frontend Engineer', code: 'ENG-FE' },
    department: 'Engineering',
    location: 'Riyadh Central Hospital',
    status: 'Open',
    approvedHeadcount: 2,
    joinedHeadcount: 0,
    jobSummary: 'Exciting frontend engineer role building healthcare UI.',
    assignments: [],
    funnelCounts: { applied: 3, screening: 1, interviews: 0, offer: 0, preHire: 0, joined: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockVacancyAssigned = {
    ...mockVacancyUnassigned,
    id: 'vac-2',
    assignments: [
      {
        id: 'asg-1',
        userId: 'rec-1',
        roleCode: 'RECRUITER',
        assignmentKind: 'PRIMARY',
        isActive: true,
        user: { id: 'rec-1', displayName: 'Sarah Ahmed' },
      },
    ],
  };

  const mockVacancyPendingActivation = {
    ...mockVacancyUnassigned,
    id: 'vac-pending',
    status: 'Pending Activation',
    jobSummary: null, // missing job summary
    requiredSkills: [], // missing skills
    assignments: [], // missing recruiter
  };

  const mockInterviewers = [
    { id: 'rec-1', displayName: 'Sarah Ahmed', roleCode: 'RECRUITER' },
    { id: 'rec-2', displayName: 'Ahmed Mostafa', roleCode: 'RECRUITER' },
  ];

  describe('VacancyOverviewPage - Inline Assign and Activation', () => {
    it('renders "Assign Recruiter & Start" when vacancy has no primary recruiter', async () => {
      mockFetchApi.mockResolvedValueOnce(mockVacancyUnassigned as any);
      mockGetApi.mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        if (url.includes('/users/interviewers')) return Promise.resolve(mockInterviewers as any);
        return Promise.resolve([] as any);
      });

      render(
        <MemoryRouter initialEntries={['/vacancies/vac-1']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const assignBtn = await screen.findByRole('button', { name: /assign recruiter & start/i });
      expect(assignBtn).toBeInTheDocument();
    });

    it('renders "Change Recruiter" when recruiter is already assigned', async () => {
      mockFetchApi.mockResolvedValueOnce(mockVacancyAssigned as any);
      mockGetApi.mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        if (url.includes('/users/interviewers')) return Promise.resolve(mockInterviewers as any);
        return Promise.resolve([] as any);
      });

      render(
        <MemoryRouter initialEntries={['/vacancies/vac-2']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const changeBtn = await screen.findByRole('button', { name: /change recruiter/i });
      expect(changeBtn).toBeInTheDocument();
    });

    it('displays blocking reasons banner when vacancy is Pending Activation', async () => {
      mockFetchApi.mockResolvedValueOnce(mockVacancyPendingActivation as any);
      mockGetApi.mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        if (url.includes('/users/interviewers')) return Promise.resolve(mockInterviewers as any);
        return Promise.resolve([] as any);
      });

      render(
        <MemoryRouter initialEntries={['/vacancies/vac-pending']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText(/Pending Activation •/i)).toBeInTheDocument();
      expect(screen.getByText(/Job Summary missing/i)).toBeInTheDocument();
      expect(screen.getByText(/No Primary Recruiter assigned/i)).toBeInTheDocument();
      expect(screen.getByText(/Required skills not defined/i)).toBeInTheDocument();
    });

    it('auto-opens modal when ?assignRecruiter=true is passed, assigns recruiter, and navigates to applications', async () => {
      const user = userEvent.setup();
      mockFetchApi.mockResolvedValueOnce(mockVacancyUnassigned as any);
      mockGetApi.mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        if (url.includes('/users/interviewers')) return Promise.resolve(mockInterviewers as any);
        return Promise.resolve([] as any);
      });
      mockPostApi.mockResolvedValueOnce({ id: 'asg-new', status: 'Open' } as any);

      render(
        <MemoryRouter initialEntries={['/vacancies/vac-1?assignRecruiter=true']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      // Modal should be open automatically
      expect(await screen.findByText(/assign recruiter & start evaluation/i)).toBeInTheDocument();
      expect(screen.getByText('Current:')).toBeInTheDocument();

      // Select a recruiter from the dropdown
      const recruiterSelect = screen.getByRole('combobox', { name: /select recruiter/i });
      await user.selectOptions(recruiterSelect, 'rec-2');

      // Click "Assign & Open Applications"
      const submitBtn = screen.getByRole('button', { name: /assign & open applications/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockPostApi).toHaveBeenCalledWith('/vacancies/vac-1/assignments', {
          userId: 'rec-2',
          roleCode: 'RECRUITER',
          assignmentKind: 'PRIMARY',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/applications?vacancyId=vac-1');
      });
    });
  });

  describe('VacantListPage - Card Blocking Reasons & Direct Assignment', () => {
    it('shows Pending Activation badge and blocking reasons on cards with direct action buttons', async () => {
      mockGetApi.mockImplementation((url: string) => {
        if (url === '/vacancies') {
          return Promise.resolve([
            {
              id: 'vac-p1',
              vacancyCode: 'VAC-001',
              title: 'Senior Clinical Pharmacist',
              department: 'Pharmacy',
              location: 'Riyadh',
              status: 'Pending Activation',
              approvedHeadcount: 1,
              joinedHeadcount: 0,
              jobSummary: '',
              requiredSkills: [],
              recruiter: { displayName: null },
              assignments: [],
            },
          ] as any);
        }
        if (url.includes('/users/interviewers')) {
          return Promise.resolve(mockInterviewers as any);
        }
        return Promise.resolve([] as any);
      });

      render(
        <MemoryRouter initialEntries={['/vacancies?tab=requisitions']}>
          <Routes>
            <Route path="/vacancies" element={<VacantListPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Senior Clinical Pharmacist')).toBeInTheDocument();
      // Blocking reasons box rendered on card
      expect(await screen.findByText(/Pending Activation \(/i)).toBeInTheDocument();
      expect(screen.getByText(/Job Summary missing/i)).toBeInTheDocument();
      expect(screen.getByText(/No Primary Recruiter assigned/i)).toBeInTheDocument();
    });

    it('assigns recruiter directly from card modal and displays activation confirmation toast', async () => {
      const user = userEvent.setup();
      mockGetApi.mockImplementation((url: string) => {
        if (url === '/vacancies') {
          return Promise.resolve([
            {
              id: 'vac-p1',
              vacancyCode: 'VAC-001',
              title: 'Senior Clinical Pharmacist',
              department: 'Pharmacy',
              location: 'Riyadh',
              status: 'Pending Activation',
              approvedHeadcount: 1,
              joinedHeadcount: 0,
              jobSummary: 'Lead hospital pharmacy dispensing and inpatient safety.',
              requiredSkills: ['Pharmacology'],
              recruiter: { displayName: null },
              assignments: [],
            },
          ] as any);
        }
        if (url.includes('/users/interviewers')) {
          return Promise.resolve(mockInterviewers as any);
        }
        return Promise.resolve([] as any);
      });
      mockPostApi.mockResolvedValueOnce({ id: 'asg-1', status: 'Open' } as any);

      render(
        <MemoryRouter initialEntries={['/vacancies?tab=requisitions']}>
          <Routes>
            <Route path="/vacancies" element={<VacantListPage />} />
          </Routes>
        </MemoryRouter>,
      );

      // Card footer has "Assign recruiter" button
      const assignBtns = await screen.findAllByRole('button', { name: /assign recruiter/i });
      expect(assignBtns.length).toBeGreaterThan(0);

      // Click "Assign recruiter" on the card
      await user.click(assignBtns[0]);

      // Direct assignment modal opens on VacantListPage
      expect(await screen.findByText(/Assign Recruiter & Activate Vacancy/i)).toBeInTheDocument();
      const recruiterSelect = screen.getByRole('combobox', { name: /select recruiter/i });
      await user.selectOptions(recruiterSelect, 'rec-2');

      // Click "Assign & Open"
      const submitBtn = screen.getByRole('button', { name: /assign & open/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockPostApi).toHaveBeenCalledWith('/vacancies/vac-p1/assignments', {
          userId: 'rec-2',
          roleCode: 'RECRUITER',
          assignmentKind: 'PRIMARY',
        });
      });

      // Confirmation toast is displayed
      expect(
        await screen.findByText(/Position "Senior Clinical Pharmacist" is now open and ready for candidates/i),
      ).toBeInTheDocument();
    });

    it('supports reassign flow with transfer notice from current recruiter to newly selected recruiter', async () => {
      const user = userEvent.setup();
      mockGetApi.mockImplementation((url: string) => {
        if (url === '/vacancies') {
          return Promise.resolve([
            {
              id: 'vac-assigned-1',
              vacancyCode: 'VAC-099',
              title: 'ICU Charge Nurse',
              department: 'Nursing',
              location: 'Riyadh Hospital',
              status: 'Open',
              approvedHeadcount: 2,
              joinedHeadcount: 0,
              jobSummary: 'Lead intensive care unit nursing operations.',
              requiredSkills: ['ICU', 'Critical Care'],
              primaryRecruiterId: 'rec-1',
              recruiter: { displayName: 'Sarah Ahmed', name: 'Sarah Ahmed' },
              assignments: [
                {
                  id: 'asg-1',
                  userId: 'rec-1',
                  roleCode: 'RECRUITER',
                  assignmentKind: 'PRIMARY',
                  isActive: true,
                  user: { id: 'rec-1', displayName: 'Sarah Ahmed' },
                },
              ],
            },
          ] as any);
        }
        if (url.includes('/users/interviewers')) {
          return Promise.resolve(mockInterviewers as any);
        }
        return Promise.resolve([] as any);
      });
      mockPostApi.mockResolvedValueOnce({ id: 'asg-2', status: 'Open' } as any);

      render(
        <MemoryRouter initialEntries={['/vacancies?tab=requisitions']}>
          <Routes>
            <Route path="/vacancies" element={<VacantListPage />} />
          </Routes>
        </MemoryRouter>,
      );

      // Card footer has "Reassign" button because recruiter is already assigned
      const reassignBtns = await screen.findAllByRole('button', { name: /^reassign$/i });
      expect(reassignBtns.length).toBeGreaterThan(0);

      // Click "Reassign"
      await user.click(reassignBtns[0]);

      // Direct assignment modal opens with "Reassign Recruiter" title
      expect(await screen.findByText(/Reassign Recruiter/i)).toBeInTheDocument();

      // Current recruiter is shown
      expect(screen.getAllByText('Sarah Ahmed').length).toBeGreaterThan(0);

      // Change selection to Ahmed Mostafa ('rec-2')
      const recruiterSelect = screen.getByRole('combobox', { name: /select recruiter/i });
      await user.selectOptions(recruiterSelect, 'rec-2');

      // Transfer notice is displayed
      expect(await screen.findByText(/Reassigning Position/i)).toBeInTheDocument();
      expect(screen.getByText(/transfer from/i)).toBeInTheDocument();

      // Click "Reassign Position"
      const submitBtn = screen.getByRole('button', { name: /reassign position/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockPostApi).toHaveBeenCalledWith('/vacancies/vac-assigned-1/assignments', {
          userId: 'rec-2',
          roleCode: 'RECRUITER',
          assignmentKind: 'PRIMARY',
        });
      });

      // Confirmation toast for reassignment is displayed
      expect(await screen.findByText(/Recruiter Ahmed Mostafa assigned to "ICU Charge Nurse"/i)).toBeInTheDocument();
    });

    it('hides assign/reassign actions on both pages when user lacks assignment permission', async () => {
      mockPermissions = ['VACANCY_VIEW']; // No assignment permissions
      mockGetApi.mockImplementation((url: string) => {
        if (url === '/vacancies') {
          return Promise.resolve([
            {
              id: 'vac-1',
              vacancyCode: 'VAC-001',
              title: 'Senior Frontend Engineer',
              department: 'Engineering',
              location: 'Riyadh',
              status: 'Open',
              approvedHeadcount: 1,
              joinedHeadcount: 0,
              recruiter: { displayName: null },
              assignments: [],
            },
          ] as any);
        }
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        return Promise.resolve([] as any);
      });
      mockFetchApi.mockResolvedValueOnce(mockVacancyUnassigned as any);

      // 1. VacantListPage check
      const { unmount } = render(
        <MemoryRouter initialEntries={['/vacancies?tab=requisitions']}>
          <Routes>
            <Route path="/vacancies" element={<VacantListPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByText('Senior Frontend Engineer');
      expect(screen.queryByRole('button', { name: /assign recruiter/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^reassign$/i })).toBeNull();
      unmount();

      // 2. VacancyOverviewPage check
      render(
        <MemoryRouter initialEntries={['/vacancies/vac-1']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByText('Senior Frontend Engineer');
      expect(screen.queryByRole('button', { name: /assign recruiter & start/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /change recruiter/i })).toBeNull();
    });

    it('allows initial assignment but hides Change Recruiter / Reassign when user has VACANCY_ASSIGN but lacks VACANCY_REASSIGN', async () => {
      mockPermissions = ['VACANCY_VIEW', 'VACANCY_ASSIGN']; // Has assign, but lacks reassign
      mockGetApi.mockImplementation((url: string) => {
        if (url === '/vacancies') {
          return Promise.resolve([
            {
              id: 'vac-1',
              vacancyCode: 'VAC-001',
              title: 'Senior Frontend Engineer',
              department: 'Engineering',
              location: 'Riyadh',
              status: 'Open',
              approvedHeadcount: 1,
              joinedHeadcount: 0,
              recruiter: { displayName: null, name: 'Unassigned' },
              assignments: [],
            },
            {
              id: 'vac-2',
              vacancyCode: 'VAC-002',
              title: 'ICU Charge Nurse',
              department: 'Nursing',
              location: 'Riyadh',
              status: 'Open',
              approvedHeadcount: 1,
              joinedHeadcount: 0,
              recruiter: { displayName: 'Sarah Ahmed', name: 'Sarah Ahmed' },
              assignments: [
                {
                  id: 'asg-1',
                  userId: 'rec-1',
                  roleCode: 'RECRUITER',
                  assignmentKind: 'PRIMARY',
                  isActive: true,
                  user: { id: 'rec-1', displayName: 'Sarah Ahmed' },
                },
              ],
            },
          ] as any);
        }
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        return Promise.resolve([] as any);
      });

      // 1. VacantListPage: Should show "Assign recruiter" for unassigned, but NOT "Reassign" for assigned
      const { unmount } = render(
        <MemoryRouter initialEntries={['/vacancies?tab=requisitions']}>
          <Routes>
            <Route path="/vacancies" element={<VacantListPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByText('Senior Frontend Engineer');
      expect(screen.getByRole('button', { name: /assign recruiter/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^reassign$/i })).toBeNull();
      unmount();

      // 2. VacancyOverviewPage for assigned vacancy: "Change Recruiter" must NOT be rendered
      mockFetchApi.mockResolvedValueOnce(mockVacancyAssigned as any);
      render(
        <MemoryRouter initialEntries={['/vacancies/vac-2']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByText('Senior Frontend Engineer');
      expect(screen.queryByRole('button', { name: /change recruiter/i })).toBeNull();
    });

    it('shows Change Recruiter when user has VACANCY_REASSIGN', async () => {
      mockPermissions = ['VACANCY_VIEW', 'VACANCY_REASSIGN'];
      mockFetchApi.mockResolvedValueOnce(mockVacancyAssigned as any);
      mockGetApi.mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.resolve({ data: [] } as any);
        if (url.includes('/interviews')) return Promise.resolve([] as any);
        if (url.includes('/offers')) return Promise.resolve([] as any);
        if (url.includes('/users/interviewers')) return Promise.resolve(mockInterviewers as any);
        return Promise.resolve([] as any);
      });

      render(
        <MemoryRouter initialEntries={['/vacancies/vac-2']}>
          <Routes>
            <Route path="/vacancies/:id" element={<VacancyOverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const changeBtn = await screen.findByRole('button', { name: /change recruiter/i });
      expect(changeBtn).toBeInTheDocument();
    });
  });
});

