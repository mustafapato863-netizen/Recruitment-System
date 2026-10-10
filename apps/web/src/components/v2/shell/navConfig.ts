import type { Seat } from '../../../v2/seat';

export type NavIconName =
  | 'my-work' | 'jobs' | 'candidates'
  | 'team' | 'requisitions' | 'result'
  | 'users' | 'roles' | 'pipeline' | 'master-data' | 'templates' | 'reports' | 'audit' | 'integrations';

export interface SeatNavItem {
  key: string;
  label: string;
  to: string;
  icon: NavIconName;
  /** Shown only when the user holds ALL of these (mirrors the route's PermissionGate). */
  requires?: string[];
  /** …or ANY of these. */
  requiresAny?: string[];
}

/**
 * Seat nav from Figma E01 / M01 / A01 (Roadmap v2 §6). Routes point at the
 * existing v1 pages until each seat's pages are rebuilt. Permission rules copy
 * the PermissionGate on each route in App.tsx, so an item never leads to a
 * page the user cannot open. No locked rows: an item the user can't use is absent.
 */
export const SEAT_NAV: Record<Seat, { heading: string; searchPlaceholder: string; items: SeatNavItem[] }> = {
  employee: {
    heading: 'Employee workspace',
    searchPlaceholder: 'Search candidates and jobs',
    items: [
      { key: 'my-work', label: 'My Work', to: '/my-work', icon: 'my-work' },
      { key: 'open-jobs', label: 'Open jobs', to: '/vacancies', icon: 'jobs', requires: ['VACANCY_VIEW'] },
      { key: 'candidates', label: 'Candidates', to: '/candidates', icon: 'candidates', requires: ['CANDIDATE_VIEW'] },
    ],
  },
  manager: {
    heading: 'Manager workspace',
    searchPlaceholder: 'Search candidates and jobs',
    items: [
      { key: 'team-work', label: 'Team work', to: '/my-work', icon: 'team' },
      { key: 'requisitions', label: 'Requisitions', to: '/vacancy-requests', icon: 'requisitions', requires: ['VACANCY_REQUEST_VIEW'] },
      // Approvals dropped (v2 §6: not a destination; the offer decision opens from Team work).
      { key: 'team-result', label: 'Team result', to: '/reports', icon: 'result', requires: ['APPLICATION_VIEW'] },
    ],
  },
  admin: {
    heading: 'Admin workspace',
    searchPlaceholder: 'Search users and settings',
    items: [
      { key: 'users', label: 'Users', to: '/users', icon: 'users', requires: ['USERS_VIEW'] },
      { key: 'roles', label: 'Roles', to: '/roles', icon: 'roles', requires: ['USERS_VIEW'] },
      { key: 'pipeline', label: 'Pipeline template', to: '/pipeline-settings', icon: 'pipeline', requires: ['OVERRIDE_WORKFLOW'] },
      { key: 'master-data', label: 'Master data', to: '/master-data', icon: 'master-data', requires: ['MASTER_DATA_VIEW'] },
      { key: 'templates', label: 'Templates', to: '/email-templates', icon: 'templates', requiresAny: ['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW', 'APPLICATION_VIEW', 'VACANCY_VIEW'] },
      { key: 'reports', label: 'Reports', to: '/reports', icon: 'reports', requires: ['APPLICATION_VIEW'] },
      { key: 'audit', label: 'Audit', to: '/audit-log', icon: 'audit', requires: ['AUDIT_VIEW'] },
      { key: 'integrations', label: 'Integrations', to: '/integrations', icon: 'integrations', requires: ['MASTER_DATA_VIEW'] },
    ],
  },
};

export function permittedNavItems(seat: Seat, permissions: readonly string[] | undefined, isAdministrator = false): SeatNavItem[] {
  const held = new Set(permissions ?? []);
  return SEAT_NAV[seat].items.filter((item) => {
    if (isAdministrator) return true; // PermissionGate lets ADMINISTRATOR through
    if (item.requires && !item.requires.every((p) => held.has(p))) return false;
    if (item.requiresAny && !item.requiresAny.some((p) => held.has(p))) return false;
    return true;
  });
}

/** Active item for a location: the longest matching path (hash-aware for /users#roles). */
export function activeNavKey(items: SeatNavItem[], pathname: string, hash = ''): string | undefined {
  let best: SeatNavItem | undefined;
  for (const item of items) {
    const [path, frag] = item.to.split('#');
    const matches = pathname === path || pathname.startsWith(`${path}/`);
    if (!matches) continue;
    if (frag ? hash !== `#${frag}` : hash && items.some((i) => i.to === `${path}${hash}`)) continue;
    if (!best || path.length > best.to.split('#')[0].length) best = item;
  }
  return best?.key;
}
