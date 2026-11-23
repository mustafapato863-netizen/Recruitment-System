import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../components/ui/ToastContext';

const auth = vi.hoisted(() => ({ logout: vi.fn(), refreshUser: vi.fn() }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u-sarah', email: 'sarah.ahmed@recruitflow.local', displayName: 'Sarah Ahmed',
      organizationId: 'org', organizationName: 'Org',
      roles: [{ id: 'r-rec', code: 'RECRUITER', name: 'Recruiter' }],
      permissions: [], lastLoginAt: null,
    },
    logout: auth.logout,
    refreshUser: auth.refreshUser,
  }),
  useOptionalAuth: () => undefined,
}));
const theme = vi.hoisted(() => ({ setTheme: vi.fn(), toggleTheme: vi.fn(), setReducedMotion: vi.fn() }));
vi.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light', ...theme,
    hasPersistedThemePreference: true, hasPersistedMotionPreference: true,
  }),
}));
const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

import { ProfilePage } from '../ProfileV2';

const profile = {
  id: 'u-sarah', email: 'sarah.ahmed@recruitflow.local', displayName: 'Sarah Ahmed',
  organizationId: 'org', organizationName: 'Org',
  roles: [{ id: 'r-rec', code: 'RECRUITER', name: 'Recruiter' }],
  permissions: [], lastLoginAt: '2026-10-09T07:00:00.000Z',
};
const preferences = {
  theme: 'light', timezone: 'Africa/Cairo', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
  reducedMotion: false, inAppNotifications: true, emailNotifications: true,
  interviewReminders: true, approvalReminders: true, taskReminders: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderProfile = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/me/profile') return profile;
    if (path === '/me/preferences') return preferences;
    throw new Error(`unexpected GET ${path}`);
  });
  api.postApi.mockResolvedValue({ message: 'Password updated successfully' });
  auth.logout.mockResolvedValue(undefined);
});

describe('ProfileV2 password section', () => {
  it('shows the strength meter under the new password field', async () => {
    renderProfile();
    await screen.findByLabelText(/^New Password/);
    expect(screen.getByText(/Password strength:/)).toBeInTheDocument();
    expect(screen.getByText(/At least 10 characters with upper and lower case/)).toBeInTheDocument();
  });

  it('blocks a weak password with an inline error and never calls the API', async () => {
    const u = userEvent.setup();
    renderProfile();
    await screen.findByLabelText(/^New Password/);
    await u.type(screen.getByLabelText(/Current Password/), 'OldPass123!');
    await u.type(screen.getByLabelText(/^New Password/), 'weak');
    await u.type(screen.getByLabelText(/Confirm New Password/), 'weak');
    await u.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(await screen.findByText(/must meet every requirement/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('submits a strong password, signs out and returns to login', async () => {
    const u = userEvent.setup();
    renderProfile();
    await screen.findByLabelText(/^New Password/);
    await u.type(screen.getByLabelText(/Current Password/), 'OldPass123!');
    await u.type(screen.getByLabelText(/^New Password/), 'NewStrong1!');
    await u.type(screen.getByLabelText(/Confirm New Password/), 'NewStrong1!');
    await u.click(screen.getByRole('button', { name: /Update Password/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/me/password', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewStrong1!',
    }));
    expect(auth.logout).toHaveBeenCalled();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
