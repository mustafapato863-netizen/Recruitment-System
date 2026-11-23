/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCREEN_ROUTE_GROUPS, SCREEN_ROUTES } from '../screenRegistry';
import { v2Redirect } from '../destinations';
import { ADMIN_GROUP_ROUTES, SEAT_NAV, permittedNavItems } from '../../components/v2/shell/navConfig';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
const shell = readFileSync(resolve(__dirname, '../../layout/V2Shell.tsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/tokens-v2.css'), 'utf8');
const ux = readFileSync(resolve(__dirname, '../../styles/v2-unified-ux.css'), 'utf8');
const declared = Array.from(app.matchAll(/<Route\s+path="([^"]+)"/g), (match) => match[1]);

function registered(path: string): boolean {
  const raw = path.split(/[?#]/)[0];
  return SCREEN_ROUTES.some((screen) => screen.path === raw);
}

describe('all public and signed-in screen paths are inventoried', () => {
  it('inventories 65 routes after /change-password (public 13, core 17, recruiter 11, manager 4, admin 7, legacy 13)', () => {
    // Recounted from the registry 2026-11-23: core is 17, not 16, so the
    // pre-change total was 64 — never assert 63 or 65-before-change.
    expect(SCREEN_ROUTES).toHaveLength(65);
    const byArea = new Map(SCREEN_ROUTE_GROUPS.map((group) => [group.area, group.paths.length]));
    expect(byArea.get('Public, authentication and candidate entry')).toBe(13);
    expect(byArea.get('Core recruitment workflows')).toBe(17);
    expect(byArea.get('Recruiter desk')).toBe(11);
    expect(byArea.get('Manager desk')).toBe(4);
    expect(byArea.get('Administration')).toBe(7);
    expect(byArea.get('Legacy aliases and catch-all')).toBe(13);
    expect(SCREEN_ROUTES.find((screen) => screen.path === '/change-password')?.surface).toBe('public');
  });

  it('covers the entire App.tsx route tree without duplicate or ghost routes', () => {
    expect(new Set(declared).size).toBe(declared.length);
    const catalog = SCREEN_ROUTES.map((screen) => screen.path);
    expect(new Set(catalog).size).toBe(catalog.length);
    expect(catalog.toSorted()).toEqual(declared.toSorted());
  });

  it('does not advertise WhatsApp templates to a user rejected by their route gate', () => {
    const links = permittedNavItems('admin', ['APPLICATION_VIEW'], false);
    expect(links.some((item) => item.to === '/whatsapp-templates')).toBe(false);
    expect(permittedNavItems('admin', ['MASTER_DATA_VIEW'], false).some(
      (item) => item.to === '/whatsapp-templates',
    )).toBe(true);
  });

  it('classifies every registered route with zero remaining legacy retained screens', () => {
    expect(SCREEN_ROUTES.every((screen) =>
      ['public', 'v2', 'retained', 'redirect'].includes(screen.surface))).toBe(true);
    expect(SCREEN_ROUTES.filter((screen) => screen.surface === 'retained')).toHaveLength(0);
    for (const path of ['/classic/candidates', '/classic/vacancies', '/access-control', '/settings', '/settings/targets', '/classic/master-data', '/classic/pipeline-settings']) {
      expect(SCREEN_ROUTES.find((screen) => screen.path === path)?.surface).toBe('redirect');
    }
    expect(app).toContain('<Navigate to="/candidates" replace />');
    expect(app).toContain('<Navigate to="/vacancies" replace />');
    for (const path of ['/team-work', '/offers', '/hires', '/hires/:id', '/hires/approvals/inbox', '/joinings', '/candidates/:id', '/candidates/:id/documents', '/cv-bank', '/sourcing-match', '/import', '/import/:dataset/:jobId', '/my-interviews', '/vacancies/:id/analytics', '/profile', '/notifications']) {
      expect(SCREEN_ROUTES.find((screen) => screen.path === path)?.surface).toBe('v2');
    }
  });

  it('has actual App routes for every seat-nav link and supported admin destination', () => {
    for (const config of Object.values(SEAT_NAV)) {
      for (const item of config.items) {
        expect(registered(item.to), `Missing nav screen ${item.label}: ${item.to}`).toBe(true);
      }
    }
    for (const item of ADMIN_GROUP_ROUTES.filter((entry) => entry.status === 'supported')) {
      expect(registered(item.to), `Missing admin screen ${item.label}: ${item.to}`).toBe(true);
    }
  });
});

describe('business-critical V2 screens remain navigable for the authorized seat', () => {
  const permissions = [
    'APPLICATION_VIEW', 'CANDIDATE_VIEW', 'VACANCY_VIEW', 'VACANCY_REQUEST_VIEW',
    'USERS_VIEW', 'ROLES_VIEW', 'MASTER_DATA_VIEW', 'AUDIT_VIEW',
  ];
  it.each([
    ['employee', [
      '/my-work', '/my-result', '/vacancies', '/vacancies/v1', '/candidates',
      '/candidates/compare', '/cv-bank', '/sourcing-match', '/interviews',
      '/interviews/calendar', '/offers', '/offers/o1', '/hires', '/hires/h1',
      '/joinings', '/applications/a1', '/reports',
    ]],
    ['manager', [
      '/my-work', '/vacancy-requests', '/approvals', '/team-interviews',
      '/reports', '/offers', '/hires', '/hires/h1', '/joinings',
    ]],
    ['admin', [
      '/users', '/roles', '/master-data', '/audit-log', '/pipeline-settings',
      '/whatsapp-templates', '/integrations', '/reports',
    ]],
  ] as const)('%s can reach real screen routes instead of silently returning home', (seat, paths) => {
    for (const path of paths) {
      expect(v2Redirect(seat, path, { permissions, requisitions: true, interviews: true, isAdministrator: seat === 'admin' }), `Blocked real ${seat} screen: ${path}`).toBeNull();
    }
  });
});

describe('native V2 routes are actually reachable after seat routing', () => {
  const fullPermissions = [
    'APPLICATION_VIEW', 'CANDIDATE_VIEW', 'VACANCY_VIEW',
    'VACANCY_REQUEST_VIEW', 'FINAL_HIRING_APPROVAL', 'LICENSE_CHECK',
    'USERS_VIEW', 'ROLES_VIEW', 'MASTER_DATA_VIEW', 'AUDIT_VIEW',
  ];
  it('opens every native V2 route for at least one authorized seat instead of redirecting silently', () => {
    const native = SCREEN_ROUTES.filter((route) => route.surface === 'v2');
    expect(native.length).toBeGreaterThan(20);
    for (const route of native) {
      const actualPath = route.path
        .replace(':id', 'test-record-id')
        .replace(':dataset', 'candidates')
        .replace(':jobId', 'test-job-id');
      const reachable = (['employee', 'manager', 'admin'] as const).some((seat) =>
        v2Redirect(seat, actualPath, {
          permissions: fullPermissions,
          requisitions: true,
          interviews: true,
          isAdministrator: seat === 'admin',
        }) === null);
      expect(reachable, `Native screen ${route.path} is unreachable by all authorized seats`).toBe(true);
    }
  });
});

describe('signed-in UX baseline shared by every screen', () => {
  it('loads design refinements only in the authenticated V2 shell', () => {
    expect(shell).toContain("import '../styles/v2-unified-ux.css'");
    expect(app).not.toContain("import './styles/v2-unified-ux.css'");
  });

  it('restores perceptible keyboard focus and visible panel borders', () => {
    expect(tokens).toMatch(/--rf2-focus-width:\s*2px/);
    expect(tokens).toMatch(/--rf2-glass-line:\s*var\(--color-border\)/);
    expect(ux).toMatch(/:focus-visible/);
    expect(ux).toMatch(/outline:\s*2px solid var\(--rf2-focus-color\)/);
    expect(ux).toMatch(/\.rf2-jtable/);
    expect(ux).toMatch(/@media \(max-width:\s*640px\)/);
  });
});
