import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import { LicenseManagementV2 } from '../LicenseManagementV2';

vi.mock('../../../api/client', () => ({
  getApi: vi.fn(),
}));

const mockUsers = [
  {
    id: 'u-1', displayName: 'Sarah Ahmed', email: 'sarah.ahmed@sgh.com',
    roles: ['RECRUITER'], status: 'Active', directReportCount: 0,
  },
  {
    id: 'u-2', displayName: 'Dr. Hassan Ali', email: 'hassan.ali@sgh.com',
    roles: ['HIRING_MANAGER'], status: 'Active', directReportCount: 4,
  },
  {
    id: 'u-3', displayName: 'Omar Khalil', email: 'omar.khalil@sgh.com',
    roles: ['ADMINISTRATOR'], status: 'Active', directReportCount: 0,
  },
];

function show() {
  return render(<MemoryRouter initialEntries={['/licenses']}><LicenseManagementV2 /></MemoryRouter>);
}

describe('LicenseManagementV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getApi).mockResolvedValue(mockUsers);
  });

  it('shows real active user counts and assignments, not fabricated quota limits', async () => {
    show();
    expect(await screen.findByText('User seats & access')).toBeInTheDocument();
    expect(screen.getByText('Employee workspace')).toBeInTheDocument();
    expect(screen.getByText('Manager workspace')).toBeInTheDocument();
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
    expect(screen.getAllByText('1 active user')).toHaveLength(3);
    expect(screen.getByText('Sarah Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Dr. Hassan Ali')).toBeInTheDocument();
    expect(screen.getByText('Omar Khalil')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('not purchased seats');
    expect(screen.queryByText(/50 Seats|15 Seats|5 Seats/)).not.toBeInTheDocument();
    expect(client.getApi).toHaveBeenCalledExactlyOnceWith('/users');
  });

  it('never offers a broken rollout toggle or requests the removed /auth/rollout API', async () => {
    show();
    await screen.findByText('Sarah Ahmed');
    expect(screen.queryByRole('button', { name: /Switch to V1|Graduate to V2/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/V1 Classic|V2 Target/)).not.toBeInTheDocument();
    expect(vi.mocked(client.getApi).mock.calls.map((call) => call[0])).toEqual(['/users']);
  });

  it('filters the real user directory by seat without losing the underlying user record', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table', { name: 'User seat allocations' });
    await user.click(screen.getByRole('tab', { name: /Managers/ }));
    const table = screen.getByRole('table', { name: 'User seat allocations' });
    expect(within(table).getByText('Dr. Hassan Ali')).toBeInTheDocument();
    expect(within(table).queryByText('Sarah Ahmed')).not.toBeInTheDocument();
    expect(within(table).queryByText('Omar Khalil')).not.toBeInTheDocument();
  });

  it('shows API errors and retries instead of turning unavailable records into false zero seats', async () => {
    const user = userEvent.setup();
    vi.mocked(client.getApi)
      .mockRejectedValueOnce(new Error('Directory unavailable'))
      .mockResolvedValueOnce(mockUsers);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Directory unavailable');
    expect(screen.queryByText('No active users in organization.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Sarah Ahmed')).toBeInTheDocument());
  });

  it('maps TALENT_MANAGER to Manager workspace consistently and handles paged { data } payloads', async () => {
    vi.mocked(client.getApi).mockResolvedValueOnce({
      data: [
        { id: 'u-tm', displayName: 'Mona El-Sayed', email: 'mona@sgh.com', roles: [{ code: 'TALENT_MANAGER', name: 'Talent Manager' }], status: 'Active' },
      ],
    });
    show();
    const table = await screen.findByRole('table', { name: 'User seat allocations' });
    const row = within(table).getByRole('row', { name: /Mona El-Sayed/ });
    expect(within(row).getByText('Manager')).toBeInTheDocument();
  });
});
