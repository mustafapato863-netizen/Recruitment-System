import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApplicationsPage } from '../ApplicationsPage';
import { getApi } from '../../api/client';

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
      displayName: 'Sara Recruiter',
      email: 'sara@saudigerman.com',
      roles: [{ id: 'r-recruiter', name: 'RECRUITER', code: 'RECRUITER' }],
      permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW'],
    },
  }),
}));

vi.mock('../../api/client', () => ({
  getApi: vi.fn(),
  patchApi: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

describe('ApplicationsPage Loop Prevention & Vacancy Resolution', () => {
  const mockGetApi = vi.mocked(getApi);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stabilizes and stops loading without an infinite loop when a vacancy has 0 applications', async () => {
    const vacancyUuid = '0cc4659c-5f9d-44bc-b7eb-64388d35e625';

    mockGetApi.mockImplementation((url: string) => {
      if (url === '/vacancies') {
        return Promise.resolve([
          {
            id: vacancyUuid,
            vacancyCode: 'VAC-SGH-CSR-LEAD',
            title: 'CSR & PATIENT RELATIONS TEAM LEADER',
            department: 'Patient Experience',
            status: 'Open',
            approvedHeadcount: 1,
            joinedHeadcount: 0,
            _count: { applications: 0 },
          },
        ]);
      }
      if (url.startsWith('/vacancies/')) {
        return Promise.resolve({
          id: vacancyUuid,
          vacancyCode: 'VAC-SGH-CSR-LEAD',
          title: 'CSR & PATIENT RELATIONS TEAM LEADER',
          department: 'Patient Experience',
          status: 'Open',
          approvedHeadcount: 1,
          joinedHeadcount: 0,
          position: { title: 'CSR & PATIENT RELATIONS TEAM LEADER' },
          branch: { name: 'Riyadh Hospital' },
        });
      }
      if (url.startsWith('/applications')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0, page: 1, pageSize: 100, totalPages: 0 },
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={[`/applications?vacancyId=${vacancyUuid}`]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Loading applications/i)).toBeInTheDocument();

    // Context banner must render with 0 active candidates and position title
    await waitFor(() => {
      expect(screen.getByText('CSR & PATIENT RELATIONS TEAM LEADER')).toBeInTheDocument();
      expect(screen.getByText(/0 active candidates/i)).toBeInTheDocument();
    });

    // Verify loading state finishes and loading spinner is gone
    await waitFor(() => {
      expect(screen.queryByText(/Loading applications/i)).not.toBeInTheDocument();
    });

    // Verify Kanban stage columns render (streamlined 4-step pipeline)
    expect(screen.getByRole('heading', { name: 'Review & Screening' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interview & Assessment' })).toBeInTheDocument();

    // Verify calls count is bounded (exactly 1 for /vacancies/:id, 1 for /applications)
    const vacancyDetailCalls = mockGetApi.mock.calls.filter(([url]) =>
      url.startsWith(`/vacancies/${vacancyUuid}`)
    );
    const applicationsCalls = mockGetApi.mock.calls.filter(([url]) =>
      url.startsWith('/applications')
    );
    expect(vacancyDetailCalls.length).toBe(1);
    expect(applicationsCalls.length).toBe(1);
  });

  it('resolves vacancyCode gracefully to UUID when query param uses code instead of UUID', async () => {
    const vacancyUuid = '0cc4659c-5f9d-44bc-b7eb-64388d35e625';
    const vacancyCode = 'VAC-SGH-CSR-LEAD';

    mockGetApi.mockImplementation((url: string) => {
      if (url === '/vacancies') {
        return Promise.resolve([
          {
            id: vacancyUuid,
            vacancyCode: vacancyCode,
            title: 'CSR & PATIENT RELATIONS TEAM LEADER',
            department: 'Patient Experience',
            status: 'Open',
            approvedHeadcount: 1,
            joinedHeadcount: 0,
            _count: { applications: 0 },
          },
        ]);
      }
      if (url.startsWith(`/vacancies/${vacancyUuid}`)) {
        return Promise.resolve({
          id: vacancyUuid,
          vacancyCode: vacancyCode,
          title: 'CSR & PATIENT RELATIONS TEAM LEADER',
          department: 'Patient Experience',
          status: 'Open',
          approvedHeadcount: 1,
          joinedHeadcount: 0,
          position: { title: 'CSR & PATIENT RELATIONS TEAM LEADER' },
          branch: { name: 'Riyadh Hospital' },
        });
      }
      if (url.startsWith('/applications')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0, page: 1, pageSize: 100, totalPages: 0 },
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(
      <MemoryRouter initialEntries={[`/applications?vacancyId=${vacancyCode}`]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Resolves code and renders banner
    await waitFor(() => {
      expect(screen.getByText('CSR & PATIENT RELATIONS TEAM LEADER')).toBeInTheDocument();
      expect(screen.getByText(/0 active candidates/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading applications/i)).not.toBeInTheDocument();
  });

  it('handles non-existent vacancy gracefully without infinite loop or crash', async () => {
    mockGetApi.mockImplementation((url: string) => {
      if (url === '/vacancies') {
        return Promise.resolve([]);
      }
      if (url.startsWith('/vacancies/')) {
        return Promise.reject(new Error('Vacancy not found'));
      }
      if (url.startsWith('/applications')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0, page: 1, pageSize: 100, totalPages: 0 },
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(
      <MemoryRouter initialEntries={['/applications?vacancyId=non-existent-uuid-999']}>
        <Routes>
          <Route path="/applications" element={<ApplicationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Loading should complete without looping
    await waitFor(() => {
      expect(screen.queryByText(/Loading applications/i)).not.toBeInTheDocument();
    });

    // Context banner is omitted since vacancy could not be resolved
    expect(screen.queryByText(/Position Pipeline/i)).not.toBeInTheDocument();
  });
});
