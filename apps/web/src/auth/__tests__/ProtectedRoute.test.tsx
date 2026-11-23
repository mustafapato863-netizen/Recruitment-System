import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; displayName: string; mustChangePassword?: boolean },
  isLoading: false,
}));
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ ...auth, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
  useOptionalAuth: () => ({ ...auth, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
}));

import { ProtectedRoute } from '../ProtectedRoute';

const renderAt = (initialEntries: string[], includePublicRoute = true) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        {includePublicRoute ? <Route path="/change-password" element={<div>Change password page (public)</div>} /> : null}
        <Route element={<ProtectedRoute />}>
          <Route path="/my-work" element={<div>Workspace home</div>} />
          <Route path="/change-password" element={<div>Change password page (guarded)</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.user = null;
  auth.isLoading = false;
});

describe('ProtectedRoute mustChangePassword', () => {
  it('does not redirect while auth is still loading', () => {
    auth.isLoading = true;
    auth.user = { id: 'u1', email: 'a@b.test', displayName: 'A', mustChangePassword: true };
    renderAt(['/my-work']);
    expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    expect(screen.queryByText(/Change password page/)).toBeNull();
  });

  it('sends a logged-out user to /login, not /change-password', () => {
    renderAt(['/my-work']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a must-change user to /change-password before the workspace', () => {
    auth.user = { id: 'u1', email: 'a@b.test', displayName: 'A', mustChangePassword: true };
    renderAt(['/my-work']);
    expect(screen.getByText('Change password page (public)')).toBeInTheDocument();
    expect(screen.queryByText('Workspace home')).toBeNull();
  });

  it('does not loop when the must-change user is already on /change-password', () => {
    auth.user = { id: 'u1', email: 'a@b.test', displayName: 'A', mustChangePassword: true };
    // No public route here: the guarded outlet must render, proving the
    // guard itself does not redirect when already on /change-password.
    renderAt(['/change-password'], false);
    expect(screen.getByText('Change password page (guarded)')).toBeInTheDocument();
  });

  it('lets a user without the flag into the workspace', () => {
    auth.user = { id: 'u1', email: 'a@b.test', displayName: 'A', mustChangePassword: false };
    renderAt(['/my-work']);
    expect(screen.getByText('Workspace home')).toBeInTheDocument();
  });
});
