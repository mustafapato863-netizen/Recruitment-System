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
    ['manager', '/vacancy-requests'], ['manager', '/reports'], ['manager', '/applications/a1'], ['manager', '/my-interviews'],
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

describe('v2 default: every v1 URL redirects to its v2 equivalent', () => {
  it.each([
    // Employee
    ['employee', '/', '/my-work'], ['employee', '/dashboard', '/my-work'], ['employee', '/tasks', '/my-work'],
    ['employee', '/interviews/i1', '/my-interviews?interview=i1&scorecard=1'], ['employee', '/interviews/calendar', '/my-work'],
    ['employee', '/vacancies/v1/analytics', '/vacancies/v1'], ['employee', '/applications/a1/transition', '/applications/a1'],
    ['employee', '/candidates/c1', '/candidates?tab=bank'], ['employee', '/candidates/c1/documents', '/candidates?tab=bank'],
    ['employee', '/cv-intake/j1', '/candidates'], ['employee', '/import', '/candidates'], ['employee', '/sourcing-match', '/candidates'],
    ['employee', '/offers/create', '/my-work'], ['employee', '/licenses', '/my-work'], ['employee', '/joinings', '/my-work'],
    ['employee', '/portal', '/my-work'], ['employee', '/reports', '/my-work'], ['employee', '/settings/targets', '/my-work'],
    // Manager
    ['manager', '/interviews/i 1', '/my-interviews?interview=i%201&scorecard=1'],
    ['manager', '/vacancy-requests/create', '/vacancy-requests?req=new'], ['manager', '/vacancy-requests/r1', '/vacancy-requests?req=r1'],
    ['manager', '/applications/a1/transition', '/applications/a1'], ['manager', '/offers/approvals/inbox', '/my-work'],
    ['manager', '/hires/approvals/inbox', '/my-work'], ['manager', '/team-result', '/reports'], ['manager', '/vacancies/v1', '/my-work'],
    ['manager', '/candidates/c1', '/my-work'], ['manager', '/users', '/my-work'],
    // Admin
    ['admin', '/', '/users'], ['admin', '/reporting-tree', '/users'], ['admin', '/settings/targets', '/master-data'], ['admin', '/access-control', '/roles'],
    ['admin', '/interviews/i1', '/users'], ['admin', '/vacancy-requests/r1', '/users'], ['admin', '/candidates', '/users'],
  ] as const)('%s %s → %s', (seat, path, to) => expect(v2Redirect(seat, path, { requisitions: true, interviews: true })).toBe(to));

  it('the manager may open /my-interviews (own scorecards) even without the interviewer permission; employees may not', () => {
    expect(v2Redirect('manager', '/my-interviews', { interviews: false })).toBeNull();
    expect(v2Redirect('employee', '/my-interviews', { interviews: false })).toBe('/my-work');
  });
  it('requisition detail/create without requisitions rights go home', () => {
    expect(v2Redirect('manager', '/vacancy-requests/create', { requisitions: false })).toBe('/my-work');
  });
  it('interviewer-only: /interviews/:id keeps the id; other v1 URLs → /my-interviews', () => {
    const o = { interviews: true, interviewerOnly: true };
    expect(v2Redirect('employee', '/interviews/i1', o)).toBe('/my-interviews?interview=i1&scorecard=1');
    expect(v2Redirect('employee', '/offers/o1', o)).toBe('/my-interviews');
  });
});
