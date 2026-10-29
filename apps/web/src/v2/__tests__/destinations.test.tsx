import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@recruitflow/contracts';
import { authorizedLanding, canOpenRoute, routeActor, v2Redirect, SEAT_HOME } from '../destinations';

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
    ['employee', '/offers/o1'], ['manager', '/offers/o1'], ['admin', '/audit-log'], ['admin', '/whatsapp-templates'], ['admin', '/roles'], ['employee', '/profile'], ['admin', '/notifications'],
  ] as const)('%s keeps %s', (seat, path) => expect(v2Redirect(seat, path)).toBeNull());
});

function Where() { const loc = useLocation(); return <output aria-label="where">{loc.pathname + loc.search}</output>; }
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

describe('classic staff URLs land on a v2 surface', () => {
  const opts = { requisitions: true, interviews: true } as const;
  const employee: Record<string, string | null> = {
    '/hires/approvals/inbox': '/my-work', '/hires': '/my-work', '/hires/h1': '/my-work', '/licenses': '/my-work',
    '/joinings': '/my-work', '/joining': '/my-work', '/interviews': '/my-interviews', '/interviews/calendar': '/my-interviews', '/offers': '/my-work',
    '/vacancies/v1/analytics': '/vacancies/v1', '/candidates/c1': null, '/candidates/c1/documents': null,
    '/cv-bank': null, '/sourcing-match': '/talent-pools', '/talent-pool': '/talent-pools',
    '/classic/candidates': '/candidates', '/classic/vacancies': '/vacancies', '/settings/targets': '/my-work', '/access-control': '/my-work',
    '/classic/master-data': '/my-work', '/settings': '/my-work', '/classic/pipeline-settings': '/my-work',
  };
  const manager: Record<string, string> = {
    ...Object.fromEntries(Object.keys(employee).map((path) => [path, path.startsWith('/interviews') ? '/my-interviews' : '/my-work'])),
    '/import': '/my-work',
    '/import/candidates/j1': '/my-work',
  };
  const admin: Record<string, string> = {
    ...Object.fromEntries(Object.keys(employee).map((path) => [path, '/users'])),
    '/import': '/users',
    '/import/candidates/j1': '/users',
    '/access-control': '/roles', '/settings': '/master-data', '/settings/targets': '/master-data', '/classic/master-data': '/master-data',
    '/classic/pipeline-settings': '/pipeline-settings',
  };
  it.each(Object.entries(employee))('employee %s → %s', (path, to) => {
    expect(v2Redirect('employee', path, opts)).toBe(to);
  });
  it.each(Object.entries(manager))('manager %s → %s', (path, to) => expect(v2Redirect('manager', path, opts)).toBe(to));
  it.each(Object.entries(admin))('admin %s → %s', (path, to) => expect(v2Redirect('admin', path, opts)).toBe(to));
  it('a viewer the route gate refuses does not land on the target', () => {
    expect(v2Redirect('employee', '/cv-bank', { ...opts, permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/classic/vacancies', { ...opts, permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/applications/a1', { permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');
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
  it('only retains person, documents and CV Bank for authorized employees', () => {
    for (const path of ['/candidates/c1', '/candidates/c1/documents', '/cv-bank']) {
      expect(v2Redirect('employee', path, { permissions: ['CANDIDATE_VIEW'] })).toBeNull();
      expect(v2Redirect('employee', path, { permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
      expect(v2Redirect('employee', path, { interviewerOnly: true })).toBe('/my-interviews');
    }
    expect(v2Redirect('employee', '/candidates/%zz')).toBe('/my-work');
  });
  it('keeps authorized import landing and batch review routes at their original URLs for employees', () => {
    expect(v2Redirect('employee', '/import', { permissions: ['CANDIDATE_CREATE'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { permissions: ['MASTER_DATA_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import', { interviewerOnly: true })).toBe('/my-interviews');
    expect(v2Redirect('employee', '/import?jobId=j1', { permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import?jobId=j1', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/candidates/j1', { permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import/candidates/j1', { permissions: ['CANDIDATE_CREATE'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/candidates/j1', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/candidates/j1', { permissions: ['MASTER_DATA_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/vacancy-requests/j1', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import/vacancy-requests/j1', { permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/branches/j1', { permissions: ['MASTER_DATA_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import/positions/j1', { permissions: ['MASTER_DATA_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import/branches/j1', { permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/import/legal-entities/j1', { permissions: ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'], isAdministrator: true })).toBe('/my-work');
    expect(canOpenRoute('/import/legal-entities/j1', ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'], true)).toBe(false);
    expect(v2Redirect('employee', '/import/candidates/j1', { permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('employee', '/interviews/%zz')).toBe('/my-work');
  });

  it('aligns legacy query-based import batch access with the selected dataset and rejects unsupported datasets even for administrators', () => {
    // Default legacy batch (no dataset query) -> candidates -> requires CANDIDATE_VIEW
    expect(canOpenRoute('/import?jobId=j1', ['CANDIDATE_VIEW'])).toBe(true);
    expect(canOpenRoute('/import?jobId=j1', ['CANDIDATE_CREATE'])).toBe(false);
    expect(canOpenRoute('/import?jobId=j1', ['VACANCY_REQUEST_VIEW'])).toBe(false);
    expect(canOpenRoute('/import?jobId=j1', ['MASTER_DATA_VIEW'])).toBe(false);

    // Explicit candidate dataset query -> requires CANDIDATE_VIEW
    expect(canOpenRoute('/import?jobId=j1&dataset=candidates', ['CANDIDATE_VIEW'])).toBe(true);
    expect(canOpenRoute('/import?jobId=j1&dataset=candidates', ['CANDIDATE_CREATE'])).toBe(false);
    expect(canOpenRoute('/import?jobId=j1&dataset=candidates', ['VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'])).toBe(false);
    expect(v2Redirect('employee', '/import?jobId=j1&dataset=candidates', { permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import?jobId=j1&dataset=candidates', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBe('/my-work');

    // Vacancy-request dataset query -> requires VACANCY_REQUEST_VIEW
    expect(canOpenRoute('/import?jobId=j1&dataset=vacancy-requests', ['VACANCY_REQUEST_VIEW'])).toBe(true);
    expect(canOpenRoute('/import?jobId=j1&dataset=vacancy-requests', ['VACANCY_REQUEST_CREATE'])).toBe(false);
    expect(canOpenRoute('/import?jobId=j1&dataset=vacancy-requests', ['CANDIDATE_VIEW', 'MASTER_DATA_VIEW'])).toBe(false);
    expect(v2Redirect('employee', '/import?jobId=j1&dataset=vacancy-requests', { permissions: ['VACANCY_REQUEST_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import?jobId=j1&dataset=vacancy-requests', { permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');

    // Master-data dataset queries -> require MASTER_DATA_VIEW
    for (const ds of ['branches', 'positions', 'departments', 'skills', 'candidate-sources', 'interview-types']) {
      expect(canOpenRoute(`/import?jobId=j1&dataset=${ds}`, ['MASTER_DATA_VIEW'])).toBe(true);
      expect(canOpenRoute(`/import?jobId=j1&dataset=${ds}`, ['MASTER_DATA_MANAGE'])).toBe(false);
      expect(canOpenRoute(`/import?jobId=j1&dataset=${ds}`, ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW'])).toBe(false);
      expect(v2Redirect('employee', `/import?jobId=j1&dataset=${ds}`, { permissions: ['MASTER_DATA_VIEW'] })).toBeNull();
      expect(v2Redirect('employee', `/import?jobId=j1&dataset=${ds}`, { permissions: ['CANDIDATE_VIEW'] })).toBe('/my-work');
    }

    // Administrator handling: allowed on supported datasets, rejected on unsupported datasets or empty jobId or malformed paths
    expect(canOpenRoute('/import?jobId=j1', [], true)).toBe(true);
    expect(canOpenRoute('/import?jobId=j1&dataset=vacancy-requests', [], true)).toBe(true);
    expect(canOpenRoute('/import?jobId=j1&dataset=branches', [], true)).toBe(true);
    expect(canOpenRoute('/import?jobId=j1&dataset=legal-entities', ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'], true)).toBe(false);
    expect(canOpenRoute('/import?dataset=legal-entities', ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'], true)).toBe(false);
    expect(canOpenRoute('/import?jobId=&dataset=candidates', ['CANDIDATE_VIEW'], true)).toBe(false);
    expect(canOpenRoute('/import/%E0%A4%A', ['CANDIDATE_VIEW'], true)).toBe(false);
    expect(canOpenRoute('/import?jobId=%E0%A4%A', ['CANDIDATE_VIEW'], true)).toBe(false);
    expect(v2Redirect('employee', '/import?jobId=j1&dataset=legal-entities', { permissions: ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'], isAdministrator: true })).toBe('/my-work');
    expect(v2Redirect('employee', '/import?dataset=legal-entities', { isAdministrator: true })).toBe('/my-work');
    expect(v2Redirect('employee', '/import?jobId=', { isAdministrator: true })).toBe('/my-work');
  });
});

describe('talent pools are an employee page', () => {
  it('keeps /talent-pools and /talent-pools/:id for an employee who can view candidates', () => {
    const opts = { requisitions: true, interviews: true, permissions: ['CANDIDATE_VIEW'] };
    expect(v2Redirect('employee', '/talent-pools', opts)).toBeNull();
    expect(v2Redirect('employee', '/talent-pools/pool-1', opts)).toBeNull();
    expect(v2Redirect('employee', '/talent-pools', { permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
  });
  it('sends other seats home; sourcing-match, CV bank, and import land on a v2 page', () => {
    const opts = { requisitions: true, interviews: true } as const;
    expect(v2Redirect('manager', '/talent-pools', opts)).toBe('/my-work');
    expect(v2Redirect('admin', '/talent-pools/pool-1', opts)).toBe('/users');
    expect(v2Redirect('employee', '/sourcing-match', { ...opts, permissions: ['CANDIDATE_VIEW'] })).toBe('/talent-pools');
    expect(v2Redirect('employee', '/cv-bank', { ...opts, permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { ...opts, permissions: ['CANDIDATE_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/import', { ...opts, permissions: ['VACANCY_VIEW'] })).toBe('/my-work');
    expect(v2Redirect('manager', '/sourcing-match', opts)).toBe('/my-work');
    expect(v2Redirect('admin', '/cv-bank', opts)).toBe('/users');
  });
});

describe('PR33-3 seat homes', () => {
  it('final approvers and licence specialists resolve to their queues', async () => {
    const { specialHome } = await import('../destinations');
    const approver = { roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['FINAL_HIRING_APPROVAL'] };
    const specialist = { roles: [{ code: 'LICENSE_SPECIALIST' }], permissions: ['LICENSE_CHECK'] };
    expect(specialHome(approver)).toBe('/hires/approvals/inbox');
    expect(specialHome(specialist)).toBe('/licenses');
    expect(specialHome({ roles: [{ code: 'RECRUITER' }], permissions: ['APPLICATION_VIEW'] })).toBeNull();
    expect(v2Redirect('employee', '/', { home: specialHome(approver), permissions: approver.permissions })).toBe('/hires/approvals/inbox');
    expect(v2Redirect('employee', '/', { home: specialHome(specialist), permissions: specialist.permissions })).toBe('/licenses');
    expect(v2Redirect('employee', '/hires/approvals/inbox', { home: specialHome(approver), permissions: approver.permissions })).toBeNull();
    expect(v2Redirect('employee', '/licenses', { home: specialHome(specialist), permissions: specialist.permissions })).toBeNull();
  });
});

describe('PR33-3: seeded licence specialist (Omar) and final approver (Aya)', () => {
  const OMAR = { roles: [{ code: 'LICENSE_SPECIALIST' }], permissions: ['VACANCY_VIEW', 'LICENSE_CHECK', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'] };
  const AYA = { roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['VACANCY_VIEW', 'FINAL_HIRING_APPROVAL', 'VIEW_CANDIDATE_PII', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'] };
  const go = async (u: typeof OMAR, path: string) => {
    const { specialHome } = await import('../destinations');
    return v2Redirect('employee', path, { requisitions: false, interviews: false, home: specialHome(u), permissions: u.permissions });
  };

  it('Aya: home is the approval inbox, and a file she may open stays the application file', async () => {
    expect(await go(AYA, '/')).toBe('/hires/approvals/inbox');
    expect(await go(AYA, '/hires/approvals/inbox')).toBeNull();
    expect(await go(AYA, '/applications/a1')).toBeNull();
    expect(canOpenRoute('/applications/a1', AYA.permissions)).toBe(true);
    expect(await go(AYA, '/hires/h1')).toBeNull();
    for (const p of ['/candidates', '/cv-bank', '/candidates/c1', '/hires', '/licenses']) expect(await go(AYA, p)).toBe('/hires/approvals/inbox');
  });
  it('Omar: the licence desk stays his home, and a file the hiring gate allows stays on the application file', async () => {
    expect(await go(OMAR, '/')).toBe('/licenses');
    expect(await go(OMAR, '/licenses')).toBeNull();
    expect(await go(OMAR, '/hires/h1')).toBeNull();
    expect(canOpenRoute('/hires/h1', OMAR.permissions)).toBe(true);
    expect(canOpenRoute('/applications/a1', OMAR.permissions)).toBe(true);
    expect(await go(OMAR, '/applications/a1')).toBeNull();
    for (const p of ['/candidates', '/cv-bank', '/hires']) expect(await go(OMAR, p)).toBe('/licenses');
    const { specialHome } = await import('../destinations');
    expect(specialHome({ ...OMAR, permissions: OMAR.permissions.filter((x) => x !== 'LICENSE_CHECK') })).toBeNull();
    const { permittedClassicItems, permittedNavItems } = await import('../../components/v2/shell/navConfig');
    expect(permittedClassicItems(OMAR.permissions)).toEqual([]);
    const recruiter = ['VACANCY_VIEW', 'CANDIDATE_VIEW', 'APPLICATION_VIEW'];
    expect(permittedNavItems('employee', recruiter, false, true, false).map((item) => item.label)).toEqual(['My Work', 'Open jobs', 'Candidates']);
    expect(permittedNavItems('manager', ['VACANCY_REQUEST_VIEW', 'APPLICATION_VIEW'], false, false, false).map((item) => item.label)).toEqual(['Team work', 'Requisitions', 'Team result']);
    expect(permittedNavItems('admin', [], true, false, false).map((item) => item.label)).toEqual(['Users', 'Roles', 'Pipeline template', 'Master data', 'Templates', 'Reports', 'Audit', 'Integrations']);
  });
  it.each(['/applications/a1', '/applications/a1?drawer=prehire'])('Omar: the shell mounts the application file at %s', async (path) => {
    expect(await go(OMAR, path.split('?')[0])).toBeNull();
    const omar = { ...user, displayName: 'Omar Nasser', roles: [{ id: 'ls', code: 'LICENSE_SPECIALIST', name: 'Licence specialist' }], permissions: [...OMAR.permissions] };
    render(<ThemeProvider><MemoryRouter initialEntries={[path]}><Routes><Route element={<AppShellV2 user={omar} seat="employee" onSignOut={() => {}} />}><Route path="*" element={<Where />} /></Route></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByLabelText('where')).toHaveTextContent(path);
  });
  it('admins leave classic URLs for the matching v2 page', () => {
    expect(v2Redirect('admin', '/hires', { permissions: [], isAdministrator: true })).toBe('/users');
    expect(v2Redirect('admin', '/hires/h1', { permissions: [], isAdministrator: true })).toBe('/users');
    expect(v2Redirect('admin', '/licenses', { permissions: [], isAdministrator: true })).toBe('/users');
    expect(v2Redirect('admin', '/cv-bank', { permissions: [], isAdministrator: true })).toBe('/users');
    expect(v2Redirect('admin', '/access-control', { permissions: [], isAdministrator: true })).toBe('/roles');
    expect(v2Redirect('admin', '/settings', { permissions: [], isAdministrator: true })).toBe('/master-data');
    expect(canOpenRoute('/roles', [], true)).toBe(true);
  });
});

describe('direct offer and hire links land on an authorized page', () => {
  it('uses the seat home, the interviewer desk, or the specialist queue', () => {
    expect(authorizedLanding(routeActor('employee', { roles: [{ code: 'RECRUITER' }], permissions: ['APPLICATION_VIEW'] }))).toBe('/my-work');
    expect(authorizedLanding(routeActor('manager', { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW'] }))).toBe('/my-work');
    expect(authorizedLanding(routeActor('admin', { roles: [{ code: 'ADMINISTRATOR' }], permissions: [] }))).toBe('/users');
    expect(authorizedLanding(routeActor('employee', { roles: [{ code: 'INTERVIEWER' }], permissions: ['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'] }))).toBe('/my-interviews');
    expect(authorizedLanding(routeActor('employee', { roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['FINAL_HIRING_APPROVAL'] }))).toBe('/hires/approvals/inbox');
    expect(authorizedLanding(routeActor('employee', { roles: [{ code: 'LICENSE_SPECIALIST' }], permissions: ['LICENSE_CHECK'] }))).toBe('/licenses');
  });
});
