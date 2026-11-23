import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { ThemeProvider } from '../../theme/ThemeContext';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; displayName: string; mustChangePassword?: boolean },
  isLoading: false,
  refreshUser: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ ...auth, login: vi.fn() }),
  useOptionalAuth: () => ({ ...auth, login: vi.fn() }),
}));
const api = vi.hoisted(() => ({ postApi: vi.fn() }));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));

import { ChangePasswordRequiredPage } from '../ChangePasswordRequiredPage';

const Loc = () => {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname}</div>;
};

const renderPage = (initialEntries: string[] = ['/change-password']) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/change-password" element={<ChangePasswordRequiredPage />} />
          <Route path="/" element={<div>Workspace home</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
        <Loc />
      </MemoryRouter>
    </ThemeProvider>,
  );

const fillValid = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.type(screen.getByLabelText(/Current password/), 'OldPass123!');
  await u.type(screen.getByLabelText(/^New password/), 'NewStrong1!');
  await u.type(screen.getByLabelText(/Confirm new password/), 'NewStrong1!');
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', email: 'new.employee@recruitflow.local', displayName: 'New Employee', mustChangePassword: true };
  auth.isLoading = false;
  auth.refreshUser.mockResolvedValue(undefined);
  auth.logout.mockResolvedValue(undefined);
});

describe('ChangePasswordRequiredPage', () => {
  it('shows the meter and redirects to the workspace on success', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ message: 'Password updated successfully' });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Change your password' })).toBeInTheDocument();
    expect(screen.getByText(/Password strength:/)).toBeInTheDocument();
    await fillValid(u);
    await u.click(screen.getByRole('button', { name: 'Change password and continue' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/me/password', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewStrong1!',
    }));
    expect(auth.refreshUser).toHaveBeenCalled();
    expect(screen.getByTestId('loc')).toHaveTextContent('/');
    expect(screen.getByText('Workspace home')).toBeInTheDocument();
  });

  it('blocks a weak password before calling the API and shows a WEAK_PASSWORD server error inline', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.type(screen.getByLabelText(/Current password/), 'OldPass123!');
    await u.type(screen.getByLabelText(/^New password/), 'weak');
    await u.type(screen.getByLabelText(/Confirm new password/), 'weak');
    await u.click(screen.getByRole('button', { name: 'Change password and continue' }));
    expect(api.postApi).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/must meet every requirement/);

    api.postApi.mockRejectedValue(new ApiError(400, 'Password is too weak.', {}, { code: 'WEAK_PASSWORD' }));
    await u.clear(screen.getByLabelText(/^New password/));
    await u.clear(screen.getByLabelText(/Confirm new password/));
    await u.type(screen.getByLabelText(/^New password/), 'ServerSays1!');
    await u.type(screen.getByLabelText(/Confirm new password/), 'ServerSays1!');
    await u.click(screen.getByRole('button', { name: 'Change password and continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/does not meet the strength requirements/));
  });

  it('shows a wrong-current-password error and offers sign out', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    renderPage();
    await fillValid(u);
    await u.click(screen.getByRole('button', { name: 'Change password and continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/current password is incorrect/));
    const signOut = screen.getByRole('button', { name: 'Sign out' });
    await u.click(signOut);
    await waitFor(() => expect(auth.logout).toHaveBeenCalled());
    expect(screen.getByTestId('loc')).toHaveTextContent('/login');
  });

  it('sends a signed-in user without the flag straight to the workspace', () => {
    auth.user = { id: 'u1', email: 'a@b.test', displayName: 'A', mustChangePassword: false };
    renderPage();
    expect(screen.getByText('Workspace home')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to login', () => {
    auth.user = null;
    renderPage();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
