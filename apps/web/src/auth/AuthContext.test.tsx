import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { ApiError, fetchApi } from '../api/client';
import type * as ClientModule from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof ClientModule>();
  return {
    ...actual,
    fetchApi: vi.fn(),
  };
});

const fetchApiMock = vi.mocked(fetchApi);

function AuthProbe() {
  const { user, isLoading, login } = useAuth();

  return (
    <>
      <button
        type="button"
        onClick={() => void login({ email: 'new-user@example.com', password: 'password' })}
      >
        Sign in
      </button>
      <span data-testid="loading">{String(isLoading)}</span>
      <span>{user?.email ?? 'signed-out'}</span>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
  });

  it('does not call /auth/me on cold unauthenticated startup when /auth/session reports canRefresh=false', async () => {
    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/session') {
        return Promise.resolve({ authenticated: false, user: null, canRefresh: false });
      }
      return Promise.resolve({});
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(fetchApiMock).toHaveBeenCalledWith('/auth/session', undefined, false);
  });

  it('hydrates directly from /auth/session when already authenticated', async () => {
    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/session') {
        return Promise.resolve({
          authenticated: true,
          user: { id: 'user-1', email: 'active@example.com' },
          canRefresh: true,
        });
      }
      return Promise.resolve({});
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('active@example.com')).toBeInTheDocument());
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to /auth/me to refresh when /auth/session reports canRefresh=true', async () => {
    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/session') {
        return Promise.resolve({ authenticated: false, user: null, canRefresh: true });
      }
      if (path === '/auth/me') {
        return Promise.resolve({ id: 'user-2', email: 'refreshed@example.com' });
      }
      return Promise.resolve({});
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('refreshed@example.com')).toBeInTheDocument());
    expect(fetchApiMock).toHaveBeenCalledWith('/auth/session', undefined, false);
    expect(fetchApiMock).toHaveBeenCalledWith('/auth/me');
  });

  it('falls back to /auth/me when /auth/session returns 404 (older API deployment)', async () => {
    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/session') {
        return Promise.reject(new ApiError(404, 'The requested resource was not found.'));
      }
      if (path === '/auth/me') {
        return Promise.resolve({ id: 'user-3', email: 'legacy-api@example.com' });
      }
      return Promise.resolve({});
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('legacy-api@example.com')).toBeInTheDocument());
    expect(fetchApiMock).toHaveBeenCalledWith('/auth/session', undefined, false);
    expect(fetchApiMock).toHaveBeenCalledWith('/auth/me');
  });

  it('does not let a slow unauthenticated startup probe log out a completed login', async () => {
    let rejectInitialProbe: (reason?: unknown) => void = () => undefined;
    const initialProbe = new Promise<never>((_, reject) => {
      rejectInitialProbe = reject;
    });

    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/session') return initialProbe;
      if (path === '/auth/login') {
        return Promise.resolve({
          user: { id: 'user-1', email: 'new-user@example.com' },
        });
      }
      return Promise.resolve({});
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('new-user@example.com')).toBeInTheDocument());

    rejectInitialProbe(new Error('No existing session'));
    await waitFor(() => expect(screen.getByText('new-user@example.com')).toBeInTheDocument());
  });
});
