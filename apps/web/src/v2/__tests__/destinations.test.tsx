import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { canOpenRoute, v2Redirect, SEAT_HOME } from '../destinations';

vi.mock('../../api/client', () => ({ getApi: vi.fn().mockResolvedValue({ unreadCount: 0 }) }));
vi.mock('../../quickguide', () => ({
  QuickGuideProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, QuickGuideModal: () => null, useQuickGuide: () => ({ openGuide: vi.fn() }),
}));
import { AppShellV2 } from '../../components/v2/shell/AppShellV2';
import { ThemeProvider } from '../../theme/ThemeContext';
import type { Seat } from '../seat';

describe('B2-17: v2 home per seat', () => {
  it.each([['employee', '/my-work'], ['manager', '/my-work'], ['admin', '/users']] as const)('%s: / → %s, never the Command Center', (seat, home) => {
    expect(v2Redirect(seat, '/')).toBe(home);
    expect(SEAT_HOME[seat]).toBe(home);
  });
});

describe('B2-18: v1 pages are not destinations for v2 seats', () => {
  it.each([
    
    ['employee', '/users', '/my-work'], ['employee', '/vacancy-requests', '/my-work'], ['employee', '/applications', '/my-work'],
    ['manager', '/approval-inbox', '/my-work'], ['manager', '/vacancies', '/my-work'], ['manager', '/tasks', '/my-work'],
    ['admin', '/my-work', '/users'], 
  ] as const)('%s %s → %s', (seat, path, to) => expect(v2Redirect(seat, path)).toBe(to));

  it.each([
    ['employee', '/my-work'], ['employee', '/vacancies/v1'], ['employee', '/candidates/compare'], ['employee', '/applications/a1'], ['employee', '/my-result'],
    ['manager', '/vacancy-requests'], ['manager', '/reports'], ['manager', '/applications/a1'], ['manager', '/my-interviews'],
    ['employee', '/offers/o1'], ['employee', '/hires/h1'], ['manager', '/offers/o1'], ['admin', '/audit-log'], ['admin', '/whatsapp-templates'], ['admin', '/roles'], ['employee', '/profile'], ['admin', '/notifications'],
  ] as const)('%s keeps %s', (seat, path) => expect(v2Redirect(seat, path)).toBeNull());
});

function Where() { return <output aria-label="where">{useLocation().pathname}</output>; }
const user = { id: 'u', email: 'e@x', displayName: 'E', organizationId: 'o', organizationName: 'O', roles: [{ id: 'r', code: 'ADMINISTRATOR', name: 'Admin' }], permissions: [], lastLoginAt: null } as UserProfile;

describe('shell redirects in place', () => {
  it.each([['employee', '/', '/my-work'], ['manager', '/approval-inbox', '/my-work'], ['admin', '/', '/users']] as const)('%s at %s lands on %s', async (seat, from, to) => {
    render(<ThemeProvider><MemoryRouter initialEntries={[from]}><Routes><Route element={<AppShellV2 user={user} seat={seat as Seat} onSignOut={() => {}} />}><Route path="*" element={<Where />} /></Route></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByLabelText('where')).toHaveTextContent(to);
  });
});

describe('v2 default: every v1 URL redirects to its v2 equivalent', () => {
  it.each([
    // Employee
    ['employee', '/', '/my-work'], ['employee', '/dashboard', '/my-work'], ['employee', '/tasks', '/my-work'],
    ['employee', '/interviews/i1', '/my-interviews?interview=i1&scorecard=1'], 
    ['employee', '/applications/a1/transition', '/applications/a1'],
    
    ['employee', '/cv-intake/j1', '/candidates'], 
    ['employee', '/offers/create', '/my-work'], 
    ['employee', '/reports', '/my-work'], 
    // Manager
    ['manager', '/interviews/i 1', '/my-interviews?interview=i%201&scorecard=1'],
    ['manager', '/vacancy-requests/create', '/vacancy-requests?req=new'], ['manager', '/vacancy-requests/r1', '/vacancy-requests?req=r1'],
    ['manager', '/applications/a1/transition', '/applications/a1'], ['manager', '/offers/approvals/inbox', '/my-work'],
    ['manager', '/team-result', '/reports'], ['manager', '/vacancies/v1', '/my-work'],
    ['manager', '/users', '/my-work'],
    // Admin
    ['admin', '/', '/users'], ['admin', '/reporting-tree', '/users'], 
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

describe('candidate entry paths stay out of the staff home', () => {
  it.each(['/portal', '/portal/applications/a1', '/my-applications'])('%s is a candidate route', (path) => {
    expect(v2Redirect('employee', path)).toBeNull();
    expect(v2Redirect('manager', path)).toBeNull();
    expect(v2Redirect('admin', path)).toBeNull();
    expect(v2Redirect('employee', path, { interviews: true, interviewerOnly: true })).toBeNull();
  });
  it('a staff session still opens the staff home', () => {
    expect(v2Redirect('employee', '/')).toBe('/my-work');
    expect(v2Redirect('manager', '/')).toBe('/my-work');
    expect(v2Redirect('admin', '/')).toBe('/users');
  });
});

describe('v2 default decision: classic (v1) pages stay reachable, not redirected', () => {
  const CLASSIC = ['/hires/approvals/inbox', '/hires', '/hires/h1', '/licenses', '/joinings', '/joining', '/interviews', '/interviews/calendar', '/offers',
    '/vacancies/v1/analytics', '/candidates/c1', '/candidates/c1/documents', '/cv-bank', '/sourcing-match', '/import', '/import/candidates/j1',
    '/classic/candidates', '/classic/vacancies', '/settings/targets', '/access-control', '/classic/master-data', '/settings', '/classic/pipeline-settings'];
  it.each(CLASSIC)('%s is never redirected (any seat); its v1 PermissionGate decides', (path) => {
    for (const seat of ['employee', 'manager', 'admin'] as const) expect(v2Redirect(seat, path, { requisitions: true, interviews: true })).toBeNull();
  });
  it('the other redirects stay: requisition approval inbox, offer approvals, /interviews/:id', () => {
    for (const p of ['/approval-inbox', '/inbox']) expect(v2Redirect('manager', p)).toBe('/my-work');
    expect(v2Redirect('admin', '/approval-inbox')).toBe('/users');
    expect(v2Redirect('employee', '/interviews/i1')).toBe('/my-interviews?interview=i1&scorecard=1');
    expect(v2Redirect('manager', '/offers/approvals/inbox')).toBe('/my-work');
    expect(v2Redirect('employee', '/candidates/compare')).toBeNull();
  });
  it('interviewer-only users still go to /my-interviews (B2V-2)', () => {
    expect(v2Redirect('employee', '/cv-bank', { interviews: true, interviewerOnly: true })).toBe('/my-interviews');
  });
});

describe('talent pools are an employee page', () => {
  it('keeps /talent-pools and /talent-pools/:id for an employee who can view candidates', () => {
    const opts = { requisitions: true, interviews: true, permissions: ['CANDIDATE_VIEW'] };
    expect(v2Redirect('employee', '/talent-pools', opts)).toBeNull();
    expect(v2Redirect('employee', '/talent-pools/pool-1', opts)).toBeNull();
    expect(v2Redirect('employee', '/talent-pools', { permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
  });
  it('sends other seats home; sourcing-match, CV bank, and import stay classic', () => {
    expect(v2Redirect('manager', '/talent-pools', { requisitions: true, interviews: true })).toBe('/my-work');
    expect(v2Redirect('admin', '/talent-pools/pool-1', { requisitions: true, interviews: true })).toBe('/users');
    for (const path of ['/sourcing-match', '/cv-bank', '/import', '/import/candidates/j1']) {
      for (const seat of ['employee', 'manager', 'admin'] as const) {
        expect(v2Redirect(seat, path, { requisitions: true, interviews: true })).toBeNull();
      }
    }
  });
});

describe('PR33-3 seat homes', () => {
  it('final approvers land on the final approval inbox, licence specialists on licences', async () => {
    const { specialHome } = await import('../destinations');
    const r = (code: string) => ({ roles: [{ code }], permissions: ['FINAL_HIRING_APPROVAL', 'APPLICATION_VIEW'] });
    expect(specialHome(r('FINAL_HIRING_APPROVER'))).toBe('/hires/approvals/inbox');
    expect(specialHome(r('LICENSE_SPECIALIST'))).toBe('/licenses');
    expect(specialHome(r('RECRUITER'))).toBeNull();
    expect(v2Redirect('employee', '/', { home: '/hires/approvals/inbox' })).toBe('/hires/approvals/inbox');
    expect(v2Redirect('employee', '/', { home: '/licenses' })).toBe('/licenses');
    expect(v2Redirect('employee', '/licenses', { home: '/licenses' })).toBeNull();
  });
});

describe('PR33-3: seeded licence specialist (Omar) and final approver (Aya)', () => {
  const OMAR = { roles: [{ code: 'LICENSE_SPECIALIST' }], permissions: ['VACANCY_VIEW', 'LICENSE_CHECK', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'] };
  const AYA = { roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['VACANCY_VIEW', 'FINAL_HIRING_APPROVAL', 'VIEW_CANDIDATE_PII', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'] };
  const go = async (u: typeof OMAR, path: string) => {
    const { specialHome } = await import('../destinations');
    return v2Redirect('employee', path, { requisitions: false, interviews: false, home: specialHome(u), permissions: u.permissions });
  };

  it('Aya: home is the final approval inbox; she opens the hiring case (GET /hiring/:id allows FINAL_HIRING_APPROVAL)', async () => {
    expect(await go(AYA, '/')).toBe('/hires/approvals/inbox');
    expect(await go(AYA, '/hires/approvals/inbox')).toBeNull();
    expect(await go(AYA, '/hires/h1')).toBeNull();
    expect(canOpenRoute('/hires/h1', AYA.permissions)).toBe(true);
  });
  it('Aya opens the file read-only (#34); candidates, CV Bank, the hiring list and licences stay closed → her home', async () => {
    expect(await go(AYA, '/applications/a1')).toBeNull();
    for (const p of ['/candidates', '/cv-bank', '/candidates/c1', '/hires', '/licenses']) expect(await go(AYA, p)).toBe('/hires/approvals/inbox');
  });
  it('Omar (LICENSE_CHECK, #34): home and nav item are /licenses; he opens hiring cases; the file, candidates and the hiring list stay closed', async () => {
    expect(await go(OMAR, '/')).toBe('/licenses');
    expect(await go(OMAR, '/licenses')).toBeNull();
    expect(await go(OMAR, '/hires/h1')).toBeNull();
    for (const p of ['/applications/a1', '/candidates', '/cv-bank', '/hires']) expect(await go(OMAR, p)).toBe('/licenses');
    const { specialHome } = await import('../destinations');
    expect(specialHome({ ...OMAR, permissions: OMAR.permissions.filter((x) => x !== 'LICENSE_CHECK') })).toBeNull();
    const { permittedClassicItems } = await import('../../components/v2/shell/navConfig');
    expect(permittedClassicItems(OMAR.permissions).map((i) => i.to)).toEqual(['/licenses', '/interviews', '/interviews/calendar', '/classic/vacancies']);
  });
  it('admins keep every classic page exactly as in v1', () => {
    for (const p of ['/hires', '/hires/h1', '/licenses', '/cv-bank', '/access-control', '/settings']) {
      expect(canOpenRoute(p, [], true)).toBe(true);
      expect(v2Redirect('admin', p, { permissions: [], isAdministrator: true })).toBeNull();
    }
  });
});
