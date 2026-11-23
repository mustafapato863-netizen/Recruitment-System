import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import * as fx from '../__fixtures__';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'admin' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@sgh.com',
      roles: [{ id: 'r1', name: 'Administrator', code: 'ADMINISTRATOR' }],
      permissions: ['USERS_VIEW', 'USERS_MANAGE'],
    },
  }),
}));
import { UsersRoute } from '../AdminRoutes';

const branches = [{ id: 'b-cairo', name: 'Cairo', status: 'Active' }];
let paths: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  paths = {
    '/users?directory=1&page=1&pageSize=100': fx.users,
    '/roles': fx.roles,
    '/roles/permissions': fx.perms,
    '/master-data/catalog/branches': branches,
    ...extra,
  };
  api.getApi.mockImplementation(async (p: string) => {
    const v = paths[p];
    if (v instanceof Error) throw v;
    if (v === undefined) throw new ApiError(404, `no ${p}`);
    return v;
  });
};
const Loc = () => <div data-testid="loc">{useLocation().search}</div>;
const renderAt = (path = '/users') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback="…">
        <Routes>
          <Route path="/users" element={<><UsersRoute /><Loc /></>} />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  shell.value = { seat: 'admin' };
  serve();
  api.postApi.mockResolvedValue({ id: 'u-new' });
  api.patchApi.mockResolvedValue({ id: 'u-omar' });
});

const openDirectory = async () => {
  renderAt();
  return screen.findByRole('table', { name: 'Users' });
};

describe('UsersV2 password management', () => {
  it('shows multi-role counts and a Must change password badge in the directory', async () => {
    const flagged = [
      { ...fx.users[0], mustChangePassword: true, roles: [fx.users[0].roles[0], fx.users[1].roles[0]] },
      ...fx.users.slice(1),
    ];
    serve({ '/users?directory=1&page=1&pageSize=100': flagged });
    const table = await openDirectory();
    const row = within(table).getByRole('row', { name: /Omar Khalil/ });
    expect(row).toHaveTextContent(/Admin · 2 roles/);
    expect(row).toHaveTextContent('Must change password');
  });

  it('opens the create drawer, validates, and creates a user with a generated strong password', async () => {
    const u = userEvent.setup();
    await openDirectory();
    await u.click(screen.getByRole('button', { name: 'Create user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create user' });
    expect(within(dialog).getByRole('checkbox', { name: 'Require password change on first sign-in' })).toBeChecked();

    await u.click(within(dialog).getByRole('button', { name: 'Create user' }));
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid email.')).toBeInTheDocument();
    expect(within(dialog).getByText('Pick at least one role.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();

    await u.type(within(dialog).getByLabelText(/^Name/), 'Test User');
    await u.type(within(dialog).getByLabelText(/^Email/), 'test.user@recruitflow.local');
    await u.type(within(dialog).getByLabelText('Job title'), 'Recruiter');
    await u.click(await within(dialog).findByRole('checkbox', { name: /Employee · Recruiter/ }));
    await u.selectOptions(within(dialog).getByLabelText('Reports to'), 'u-hala');
    await u.selectOptions(within(dialog).getByLabelText('Branch'), 'b-cairo');
    await u.click(within(dialog).getByRole('button', { name: 'Generate strong password' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent(/Password strength: Strong/);
    await u.click(within(dialog).getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/users', expect.objectContaining({
      email: 'test.user@recruitflow.local',
      displayName: 'Test User',
      jobTitle: 'Recruiter',
      roleIds: ['r-rec'],
      managerId: 'u-hala',
      branchId: 'b-cairo',
      mustChangePassword: true,
    })));
    const body = api.postApi.mock.calls[0][1] as { password: string };
    expect(body.password.length).toBeGreaterThanOrEqual(16);
    expect(await screen.findByText(/Created Test User\./)).toBeInTheDocument();
  });

  it('upgrades the edit drawer with display name, job title and multi-role checkboxes', async () => {
    const u = userEvent.setup();
    await openDirectory();
    await u.click(screen.getByRole('button', { name: 'Edit Omar Khalil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Omar Khalil' });
    expect(within(dialog).getByLabelText(/^Display name/)).toHaveValue('Omar Khalil');
    expect(within(dialog).getByLabelText('Job title')).toHaveValue('HR Systems');
    expect(await within(dialog).findByRole('checkbox', { name: /Admin · Administrator/ })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Change password' })).toBeInTheDocument();

    await u.clear(within(dialog).getByLabelText(/^Display name/));
    await u.type(within(dialog).getByLabelText(/^Display name/), 'Omar K.');
    await u.click(within(dialog).getByRole('checkbox', { name: /Manager · Hiring Manager/ }));
    await u.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith(
      '/users/u-omar',
      expect.objectContaining({ displayName: 'Omar K.', roleIds: expect.arrayContaining(['r-admin', 'r-hm']) }),
    ));
  });

  it('opens the change-password drawer, blocks weak passwords, and calls adminChangePassword', async () => {
    const u = userEvent.setup();
    await openDirectory();
    await u.click(screen.getByRole('button', { name: 'Change password for Omar Khalil' }));
    const dialog = await screen.findByRole('dialog', { name: /Change password for Omar Khalil/ });
    expect(within(dialog).getByRole('checkbox', { name: 'Require password change on next sign-in' })).toBeChecked();

    await u.type(within(dialog).getByLabelText(/^New password/), 'weak');
    await u.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(within(dialog).getByText(/must meet every requirement/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();

    await u.click(within(dialog).getByRole('button', { name: 'Generate strong password' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent(/Password strength: Strong/);
    await u.click(within(dialog).getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith(
      '/users/u-omar/password',
      expect.objectContaining({ requireChangeOnNextLogin: true }),
    ));
    const body = api.postApi.mock.calls[0][1] as { password: string };
    expect(body.password.length).toBeGreaterThanOrEqual(16);
    expect(await screen.findByText(/Omar Khalil's password was changed\./)).toBeInTheDocument();
  });
});
