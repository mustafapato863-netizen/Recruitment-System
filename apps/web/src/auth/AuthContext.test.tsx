import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { fetchApi } from '../api/client';

vi.mock('../api/client', () => ({
  fetchApi: vi.fn(),
}));

const fetchApiMock = vi.mocked(fetchApi);

function AuthProbe() {
  const { user, login } = useAuth();

  return (
    <>
      <button
        type="button"
        onClick={() => void login({ email: 'new-user@example.com', password: 'password' })}
      >
        Sign in
      </button>
      <span>{user?.email ?? 'signed-out'}</span>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
  });

  it('does not let a slow unauthenticated startup probe log out a completed login', async () => {
    let rejectInitialProbe: (reason?: unknown) => void = () => undefined;
    const initialProbe = new Promise<never>((_, reject) => {
      rejectInitialProbe = reject;
    });

    fetchApiMock.mockImplementation((path) => {
      if (path === '/auth/me') return initialProbe;
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
