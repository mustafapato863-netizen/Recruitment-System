import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock('../../components/v2/shell/AppShellV2', () => ({ AppShellV2: ({ seat }: { seat: string }) => <p>v2 shell: {seat}</p> }));
import { V2Shell } from '../V2Shell';
import { initUiVersion } from '../../theme/uiVersion';

const role = (code: string) => ({ id: code, code, name: code });
const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><Routes><Route element={<V2Shell />}><Route path="*" element={<p>page</p>} /></Route></Routes></MemoryRouter>);

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-ui'); });

describe('v2 default', () => {
  it.each([
    ['employee', [role('RECRUITER')], ['VACANCY_VIEW']],
    ['manager', [role('HIRING_MANAGER')], ['APPROVE_OFFERS']],
    ['admin', [role('ADMINISTRATOR')], ['USERS_VIEW']],
    ['employee', [role('INTERVIEWER')], ['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE']], // interviewer-only
  ] as const)('%s gets the v2 shell with no switch, even with v2Enabled=false, v2Seats=[] and ?ui=v1 / localStorage v1', (seat, roles, permissions) => {
    localStorage.setItem('recruitflow.ui', 'v1');
    localStorage.setItem('recruitflow.ui.v2seats', 'none');
    auth.user = { id: 'u', roles, permissions, v2Enabled: false, v2Seats: [], flags: { v2Seats: [] } };
    at('/my-work?ui=v1&v2seats=none');
    expect(screen.getByText(`v2 shell: ${seat}`)).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-ui')).toBe('v2');
  });

  it('initUiVersion always applies v2 (no ?ui=, localStorage or VITE_UI_V2 switch)', () => {
    localStorage.setItem('recruitflow.ui', 'v1');
    expect(initUiVersion()).toBe('v2');
    expect(document.documentElement.getAttribute('data-ui')).toBe('v2');
  });
});
