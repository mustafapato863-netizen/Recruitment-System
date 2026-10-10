import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { v2Redirect } from '../v2/destinations';

vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: { id: 'c', roles: [{ id: 'r', code: 'CANDIDATE', name: 'Candidate' }], permissions: [] }, isAuthenticated: true, isLoading: false, loading: false, logout: vi.fn() }),
}));
vi.mock('../auth/ProtectedRoute', async () => { const { Outlet } = await import('react-router-dom'); return { ProtectedRoute: () => <Outlet /> }; });
vi.mock('../pages/ApplicantPortalPage', () => ({ ApplicantPortalPage: () => <p>applicant portal</p> }));
vi.mock('../layout/V2Shell', () => ({ V2Shell: () => <p>v2 shell</p> }));
import App from '../App';

describe('/portal (applicant portal)', () => {
  it.each(['/portal', '/portal/applications/a1', '/my-applications'])('%s renders the portal outside the seat shell', async (url) => {
    window.history.pushState({}, '', url);
    render(<App />);
    expect(await screen.findByText('applicant portal')).toBeInTheDocument();
    expect(screen.queryByText('v2 shell')).toBeNull();
    expect(window.location.pathname).toBe(url);
  });
  it('is excluded from the v2 redirects for every seat', () => {
    for (const seat of ['employee', 'manager', 'admin'] as const) {
      expect(v2Redirect(seat, '/portal')).toBeNull();
      expect(v2Redirect(seat, '/portal/x')).toBeNull();
      expect(v2Redirect(seat, '/my-applications')).toBeNull();
    }
  });
});
