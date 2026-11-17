import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import { LicenseManagementV2 } from '../LicenseManagementV2';

vi.mock('../../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', permissions: ['USERS_VIEW', 'USERS_MANAGE', 'ADMIN'] },
  }),
}));

const mockUsers = [
  {
    id: 'u-1',
    displayName: 'Sarah Ahmed',
    email: 'sarah.ahmed@sgh.com',
    roles: ['RECRUITER'],
    status: 'Active',
    directReportCount: 0,
  },
  {
    id: 'u-2',
    displayName: 'Dr. Hassan Ali',
    email: 'hassan.ali@sgh.com',
    roles: ['HIRING_MANAGER'],
    status: 'Active',
    directReportCount: 4,
  },
  {
    id: 'u-3',
    displayName: 'Omar Khalil',
    email: 'omar.khalil@sgh.com',
    roles: ['ADMINISTRATOR'],
    status: 'Active',
    directReportCount: 0,
  },
];

describe('LicenseManagementV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getApi).mockImplementation(async (path: string) => {
      if (path === '/users') return mockUsers;
      if (path === '/auth/rollout') return { v2Seats: ['employee'], source: 'default' };
      return [];
    });
  });

  it('renders quota cards and seat breakdown accurately', async () => {
    render(
      <MemoryRouter initialEntries={['/licenses']}>
        <LicenseManagementV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('License & Seat Administration')).toBeInTheDocument();
    expect(screen.getByText('Employee Workspace')).toBeInTheDocument();
    expect(screen.getByText('Manager Workspace')).toBeInTheDocument();
    expect(screen.getByText('Admin Workspace')).toBeInTheDocument();

    expect(screen.getByText('Sarah Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Dr. Hassan Ali')).toBeInTheDocument();
    expect(screen.getByText('Omar Khalil')).toBeInTheDocument();
  });

  it('toggles a seat to graduate to V2 and updates rollout config', async () => {
    const user = userEvent.setup();
    vi.mocked(client.postApi).mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={['/licenses']}>
        <LicenseManagementV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Manager Workspace')).toBeInTheDocument();

    // Manager is initially V1 Classic with a "Graduate to V2" button
    const graduateBtns = screen.getAllByRole('button', { name: 'Graduate to V2' });
    expect(graduateBtns.length).toBeGreaterThan(0);

    await user.click(graduateBtns[0]!);

    await waitFor(() => {
      expect(client.postApi).toHaveBeenCalledWith(
        '/integrations/config',
        expect.objectContaining({
          name: 'ROLLOUT_SEATS',
          configJson: expect.objectContaining({
            v2Seats: expect.arrayContaining(['employee', 'manager']),
          }),
        }),
      );
    });
  });
});
