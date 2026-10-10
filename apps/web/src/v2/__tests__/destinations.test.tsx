import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { v2Redirect, SEAT_HOME } from '../destinations';

vi.mock('../../api/client', () => ({ getApi: vi.fn().mockResolvedValue({ unreadCount: 0 }) }));
vi.mock('../../quickguide', () => ({
  QuickGuideProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, QuickGuideModal: () => null, useQuickGuide: () => ({ openGuide: vi.fn() }),
}));
import { AppShellV2 } from '../../components/v2/shell/AppShellV2';
import type { Seat } from '../seat';

describe('B2-17: v2 home per seat', () => {
  it.each([['employee', '/my-work'], ['manager', '/my-work'], ['admin', '/users']] as const)('%s: / → %s, never the Command Center', (seat, home) => {
    expect(v2Redirect(seat, '/')).toBe(home);
    expect(SEAT_HOME[seat]).toBe(home);
  });
});

describe('B2-18: v1 pages are not destinations for v2 seats', () => {
  it.each([
    ['employee', '/offers', '/my-work'], ['employee', '/interviews', '/my-work'], ['employee', '/hires/h1', '/my-work'], ['employee', '/cv-bank', '/candidates'],
    ['employee', '/users', '/my-work'], ['employee', '/vacancy-requests', '/my-work'], ['employee', '/applications', '/my-work'],
    ['manager', '/offers/o1', '/my-work'], ['manager', '/approval-inbox', '/my-work'], ['manager', '/vacancies', '/my-work'], ['manager', '/tasks', '/my-work'],
    ['admin', '/offers', '/users'], ['admin', '/my-work', '/users'], ['admin', '/settings', '/master-data'],
  ] as const)('%s %s → %s', (seat, path, to) => expect(v2Redirect(seat, path)).toBe(to));

  it.each([
    ['employee', '/my-work'], ['employee', '/vacancies/v1'], ['employee', '/candidates/compare'], ['employee', '/applications/a1'], ['employee', '/my-result'],
    ['manager', '/vacancy-requests'], ['manager', '/reports'], ['manager', '/applications/a1'], ['manager', '/interviews/i1'],
    ['admin', '/audit-log'], ['admin', '/whatsapp-templates'], ['admin', '/roles'], ['employee', '/profile'], ['admin', '/notifications'],
  ] as const)('%s keeps %s', (seat, path) => expect(v2Redirect(seat, path)).toBeNull());
});

function Where() { return <output aria-label="where">{useLocation().pathname}</output>; }
const user = { id: 'u', email: 'e@x', displayName: 'E', organizationId: 'o', organizationName: 'O', roles: [{ id: 'r', code: 'ADMINISTRATOR', name: 'Admin' }], permissions: [], lastLoginAt: null } as UserProfile;

describe('shell redirects in place', () => {
  it.each([['employee', '/', '/my-work'], ['manager', '/offers', '/my-work'], ['admin', '/', '/users']] as const)('%s at %s lands on %s', async (seat, from, to) => {
    render(<MemoryRouter initialEntries={[from]}><Routes><Route element={<AppShellV2 user={user} seat={seat as Seat} onSignOut={() => {}} />}><Route path="*" element={<Where />} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByLabelText('where')).toHaveTextContent(to);
  });
});
