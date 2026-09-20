import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportingTreePage } from '../ReportingTreePage';
import { fetchApi, patchApi } from '../../api/client';

let mockPermissions: string[] = ['USERS_VIEW'];

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@sgh.com',
      roles: [{ id: 'r1', name: 'Administrator', code: 'ADMINISTRATOR' }],
      permissions: mockPermissions,
    },
  }),
}));

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
}));

const mockUsers = [
  {
    id: 'lead-1',
    email: 'lead@sgh.com',
    displayName: 'Mona TeamLeader',
    jobTitle: 'Recruitment Team Leader',
    status: 'Active',
    organizationId: 'org-1',
    managerId: null,
    roles: [{ id: 'r2', name: 'Recruitment Team Leader', code: 'TEAM_LEADER' }],
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rec-1',
    email: 'sarah@sgh.com',
    displayName: 'Sarah Ahmed',
    jobTitle: 'Recruiter',
    status: 'Active',
    organizationId: 'org-1',
    managerId: 'lead-1',
    roles: [{ id: 'r3', name: 'Recruiter', code: 'RECRUITER' }],
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rec-2',
    email: 'ahmed@sgh.com',
    displayName: 'Ahmed Mostafa',
    jobTitle: 'Recruiter',
    status: 'Active',
    organizationId: 'org-1',
    managerId: 'lead-1',
    roles: [{ id: 'r3', name: 'Recruiter', code: 'RECRUITER' }],
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('ReportingTreePage', () => {
  const mockFetchApi = vi.mocked(fetchApi);
  const mockPatchApi = vi.mocked(patchApi);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = ['USERS_VIEW'];
    mockFetchApi.mockResolvedValue(mockUsers);
    mockPatchApi.mockResolvedValue({ ...mockUsers[1], managerId: null });
  });

  it('renders the hierarchy with managers above their reports', async () => {
    render(
      <MemoryRouter>
        <ReportingTreePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sarah Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Mostafa')).toBeInTheDocument();
    // Manager card plus one "Reports to" line per direct report.
    expect(screen.getAllByText('Mona TeamLeader')).toHaveLength(3);
    expect(screen.getByText((_, element) => element?.textContent === '2 reporting')).toBeInTheDocument();
    // Auto-drawn connectors overlay is rendered for the hierarchy.
    expect(screen.getByTestId('reporting-tree-edges')).toBeInTheDocument();
  });

  it('lets administrators re-link who reports to whom', async () => {
    mockPermissions = ['USERS_VIEW', 'USERS_MANAGE'];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreePage />
      </MemoryRouter>,
    );

    const managerSelect = await screen.findByLabelText('Select manager for Sarah Ahmed');
    await user.selectOptions(managerSelect, '');
    await waitFor(() => {
      expect(mockPatchApi).toHaveBeenCalledWith('/users/rec-1', { managerId: null });
    });
  });

  it('is view-only for users without USERS_MANAGE', async () => {
    render(
      <MemoryRouter>
        <ReportingTreePage />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    expect(screen.queryByLabelText('Select manager for Sarah Ahmed')).toBeNull();
    expect(screen.getByText(/view only/i)).toBeInTheDocument();
  });

  it('shows the manager name on report cards for viewers', async () => {
    render(
      <MemoryRouter>
        <ReportingTreePage />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    // Manager card plus one "Reports to" line per direct report.
    expect(screen.getAllByText('Mona TeamLeader')).toHaveLength(3);
  });
});
