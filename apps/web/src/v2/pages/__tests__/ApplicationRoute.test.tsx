import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
const auth = vi.hoisted(() => ({ user: { permissions: ['APPLICATION_VIEW'], roles: [] as Array<{ code: string }> } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../ApplicationFileV2', () => ({ ApplicationFileV2: ({ mode = 'owner' }: { mode?: string }) => <p>v2 file {mode}</p> }));
import { ApplicationRoute } from '../ApplicationRoute';

const r = () => render(<MemoryRouter><Suspense fallback="…"><ApplicationRoute /></Suspense></MemoryRouter>);

describe('/applications/:id route', () => {
  it('v2 default: the v2 file without a shell context too (no v1 detail any more)', () => { shell.value = null; r(); expect(screen.getByText(/v2 file/)).toBeInTheDocument(); });
  it('v2 file (manager mode) for the Manager seat (B2-18/B2-23)', () => { shell.value = { seat: 'manager' }; r(); expect(screen.getByText(/v2 file/)).toBeInTheDocument(); });
  it('v2 file (E13) for the Employee seat', () => { shell.value = { seat: 'employee' }; r(); expect(screen.getByText(/v2 file/)).toBeInTheDocument(); });
  it('a licence specialist without file access opens the pre-hire file', () => {
    auth.user = { permissions: ['LICENSE_CHECK', 'VACANCY_VIEW'], roles: [{ code: 'LICENSE_SPECIALIST' }] };
    shell.value = { seat: 'employee' }; r();
    expect(screen.getByText('v2 file licence')).toBeInTheDocument();
    auth.user = { permissions: ['APPLICATION_VIEW'], roles: [] };
  });
  it('#34: a final-hire approver without APPLICATION_VIEW gets the read-only approver view', () => {
    auth.user = { permissions: ['FINAL_HIRING_APPROVAL', 'VACANCY_VIEW'], roles: [{ code: 'FINAL_HIRING_APPROVER' }] };
    shell.value = { seat: 'employee' }; r();
    expect(screen.getByText('v2 file approver')).toBeInTheDocument();
    auth.user = { permissions: ['APPLICATION_VIEW', 'FINAL_HIRING_APPROVAL'], roles: [] };
    r();
    expect(screen.getAllByText(/v2 file/).at(-1)).toHaveTextContent('v2 file owner');
  });
});
