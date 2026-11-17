import type { Seat } from '../../../v2/seat';

export type NavIconName =
  | 'my-work' | 'jobs' | 'candidates' | 'interviews' | 'my-interviews'
  | 'team' | 'requisitions' | 'approvals' | 'result'
  | 'users' | 'roles' | 'pipeline' | 'master-data' | 'templates' | 'reports' | 'audit' | 'integrations' | 'classic';

export type AdminNavGroup =
  | 'Overview'
  | 'Users & Access'
  | 'Organization'
  | 'Recruitment Setup'
  | 'Reports'
  | 'Data'
  | 'Settings';

export interface SeatNavItem {
  key: string;
  label: string;
  to: string;
  icon: NavIconName;
  /** Admin information-architecture group (Plan §3). */
  group?: AdminNavGroup;
  /** Shown only when the user holds ALL of these (mirrors the route's PermissionGate). */
  requires?: string[];
  /** …or ANY of these. */
  requiresAny?: string[];
  /** Backend #21 (B2-3): absent for a Recruiter-only user (the API answers 403). */
  notForRecruiter?: boolean;
  /** B2F-3: only for interviewers (INTERVIEWER role or INTERVIEW_PARTICIPATE; see auth/interviewer). */
  interviewerOnly?: boolean;
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
      { key: 'match-skills', label: 'Match Skills', to: '/sourcing-match', icon: 'result', requires: ['CANDIDATE_VIEW', 'APPLICATION_VIEW'] },
      { key: 'interviews', label: 'Interviews', to: '/interviews', icon: 'interviews', requires: ['VACANCY_VIEW', 'APPLICATION_VIEW'] },
      { key: 'reports', label: 'Reports', to: '/reports', icon: 'reports', requires: ['APPLICATION_VIEW'] },
      { key: 'my-interviews', label: 'My interviews', to: '/my-interviews', icon: 'my-interviews', requires: ['VACANCY_VIEW'], interviewerOnly: true },
    ],
  },
  manager: {
    heading: 'Manager workspace',
    searchPlaceholder: 'Search candidates and jobs',
    items: [
      { key: 'team-work', label: 'Team work', to: '/my-work', icon: 'team' },
      { key: 'requisitions', label: 'Requisitions', to: '/vacancy-requests', icon: 'requisitions', requires: ['VACANCY_REQUEST_VIEW'], notForRecruiter: true },
      { key: 'approvals', label: 'Approvals', to: '/approvals', icon: 'approvals' },
      { key: 'interviews', label: 'Interviews', to: '/team-interviews', icon: 'interviews', requires: ['VACANCY_VIEW'] },
      { key: 'my-interviews', label: 'My interviews', to: '/my-interviews', icon: 'my-interviews', requires: ['VACANCY_VIEW'], interviewerOnly: true },
      { key: 'team-result', label: 'Team result', to: '/reports', icon: 'result', requires: ['APPLICATION_VIEW'] },
    ],
  },
  admin: {
    heading: 'Admin workspace',
    searchPlaceholder: 'Search users and settings',
    items: [
      { key: 'users', label: 'Users', to: '/users', icon: 'users', group: 'Users & Access', requires: ['USERS_VIEW'] },
      { key: 'roles', label: 'Roles', to: '/roles', icon: 'roles', group: 'Users & Access', requires: ['ROLES_VIEW'] },
      { key: 'pipeline', label: 'Pipeline template', to: '/pipeline-settings', icon: 'pipeline', group: 'Recruitment Setup', requires: ['MASTER_DATA_VIEW'] },
      { key: 'master-data', label: 'Master data', to: '/master-data', icon: 'master-data', group: 'Organization', requires: ['MASTER_DATA_VIEW'] },
      { key: 'templates', label: 'WhatsApp templates', to: '/whatsapp-templates', icon: 'templates', group: 'Recruitment Setup', requiresAny: ['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW', 'APPLICATION_VIEW', 'VACANCY_VIEW'] },
      { key: 'reports', label: 'Reports', to: '/reports', icon: 'reports', group: 'Reports', requires: ['APPLICATION_VIEW'] },
      { key: 'audit', label: 'Audit', to: '/audit-log', icon: 'audit', group: 'Settings', requires: ['AUDIT_VIEW'] },
      { key: 'integrations', label: 'Integrations', to: '/integrations', icon: 'integrations', group: 'Settings', requires: ['MASTER_DATA_VIEW'] },
    ],
  },
};

export interface AdminGroupRouteEntry {
  key: string;
  label: string;
  to: string;
  group: AdminNavGroup;
  status: 'supported' | 'planned';
  requires?: string[];
  requiresAny?: string[];
}

/**
 * Canonical 7-group Admin IA map (Plan §3, R3).
 * Only 'supported' entries are rendered in actionable navigation during Phase A1;
 * 'planned' entries remain hidden until their owning Phase A2–A7 tickets land.
 */
export const ADMIN_GROUP_ORDER: readonly AdminNavGroup[] = [
  'Overview',
  'Users & Access',
  'Organization',
  'Recruitment Setup',
  'Reports',
  'Data',
  'Settings',
] as const;

export const ADMIN_GROUP_ROUTES: readonly AdminGroupRouteEntry[] = [
  { key: 'overview', label: 'Overview', to: '/admin/overview', group: 'Overview', status: 'planned' },
  { key: 'users', label: 'Users', to: '/users', group: 'Users & Access', status: 'supported', requires: ['USERS_VIEW'] },
  { key: 'roles', label: 'Roles', to: '/roles', group: 'Users & Access', status: 'supported', requires: ['ROLES_VIEW'] },
  { key: 'licenses', label: 'Licenses & Seats', to: '/licenses', group: 'Users & Access', status: 'supported', requires: ['USERS_VIEW'] },
  { key: 'sessions', label: 'Sessions', to: '/settings/sessions', group: 'Users & Access', status: 'planned', requires: ['USERS_MANAGE'] },
  { key: 'master-data', label: 'Master data', to: '/master-data', group: 'Organization', status: 'supported', requires: ['MASTER_DATA_VIEW'] },
  { key: 'pipeline', label: 'Pipeline template', to: '/pipeline-settings', group: 'Recruitment Setup', status: 'supported', requires: ['MASTER_DATA_VIEW'] },
  { key: 'templates', label: 'WhatsApp templates', to: '/whatsapp-templates', group: 'Recruitment Setup', status: 'supported', requiresAny: ['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW'] },
  { key: 'evaluations', label: 'Evaluation forms', to: '/recruitment-setup/evaluations', group: 'Recruitment Setup', status: 'planned', requires: ['MASTER_DATA_VIEW'] },
  { key: 'reports', label: 'Reports', to: '/reports', group: 'Reports', status: 'supported', requires: ['APPLICATION_VIEW'] },
  { key: 'import', label: 'Bulk import', to: '/import', group: 'Data', status: 'planned', requiresAny: ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW', 'CANDIDATE_CREATE', 'VACANCY_REQUEST_CREATE', 'MASTER_DATA_MANAGE'] },
  { key: 'duplicates', label: 'Duplicates', to: '/data/duplicates', group: 'Data', status: 'planned', requires: ['CANDIDATE_VIEW'] },
  { key: 'quality', label: 'Data quality', to: '/data/quality', group: 'Data', status: 'planned', requires: ['MASTER_DATA_VIEW'] },
  // Audit is placed first in Settings per Plan §3 ("Place Audit as the first visible Settings item").
  { key: 'audit', label: 'Audit', to: '/audit-log', group: 'Settings', status: 'supported', requires: ['AUDIT_VIEW'] },
  { key: 'integrations', label: 'Integrations', to: '/integrations', group: 'Settings', status: 'supported', requires: ['MASTER_DATA_VIEW'] },
  { key: 'branding', label: 'Branding & notifications', to: '/settings/branding', group: 'Settings', status: 'planned', requires: ['MASTER_DATA_VIEW'] },
] as const;

export function permittedAdminGroupItems(
  group: AdminNavGroup,
  permissions: readonly string[] | undefined,
  isAdministrator = false,
): AdminGroupRouteEntry[] {
  const held = new Set(permissions ?? []);
  return ADMIN_GROUP_ROUTES.filter((entry) => {
    if (entry.group !== group || entry.status !== 'supported') return false;
    if (isAdministrator || permissions === undefined) return true;
    if (entry.requires && !entry.requires.every((p) => held.has(p))) return false;
    if (entry.requiresAny && !entry.requiresAny.some((p) => held.has(p))) return false;
    return true;
  });
}

/**
 * Classic pages kept on their own URLs. Same for every seat; each item mirrors its route's PermissionGate
 * in App.tsx, so an item the user can't open is absent. The shell lists each one as its own nav link.
 */
const C = (key: string, label: string, to: string, gate: Pick<SeatNavItem, 'requires' | 'requiresAny'>): SeatNavItem => ({ key: `classic-${key}`, label, to, icon: 'classic', ...gate });
export const CLASSIC_NAV: SeatNavItem[] = [
  C('final-approvals', 'Final approvals', '/hires/approvals/inbox', { requires: ['FINAL_HIRING_APPROVAL'] }),
  C('hires', 'Hiring cases', '/hires', { requires: ['APPLICATION_VIEW'] }),
  C('licenses', 'Licences', '/licenses', { requiresAny: ['APPLICATION_VIEW', 'LICENSE_CHECK'] }),
  C('joinings', 'Joinings', '/joinings', { requires: ['APPLICATION_VIEW'] }),
  C('interviews', 'All interviews', '/interviews', { requires: ['VACANCY_VIEW'] }),
  C('calendar', 'Interview calendar', '/interviews/calendar', { requires: ['VACANCY_VIEW'] }),
  C('offers', 'All offers', '/offers', { requires: ['APPLICATION_VIEW'] }),
  C('candidates', 'Candidate data & exports', '/classic/candidates', { requires: ['CANDIDATE_VIEW'] }),
  C('cv-bank', 'CV Bank', '/cv-bank', { requires: ['CANDIDATE_VIEW'] }),
  C('talent-pools', 'Talent pools', '/sourcing-match', { requires: ['CANDIDATE_VIEW'] }),
  C('vacancies', 'Job exports', '/classic/vacancies', { requires: ['VACANCY_VIEW'] }),
  C('import', 'Bulk import', '/import', { requiresAny: ['CANDIDATE_CREATE', 'VACANCY_REQUEST_CREATE', 'MASTER_DATA_MANAGE'] }),
  C('targets', 'Targets', '/settings/targets', { requiresAny: ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN', 'MASTER_DATA_VIEW'] }),
  C('access', 'Access permissions', '/access-control', { requires: ['USERS_VIEW'] }),
  C('master-data', 'Branches and positions', '/classic/master-data', { requires: ['MASTER_DATA_VIEW'] }),
  C('settings', 'Workflow settings', '/settings', { requiresAny: ['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW'] }),
  C('pipeline', 'Advanced pipeline templates', '/classic/pipeline-settings', { requires: ['OVERRIDE_WORKFLOW'] }),
];

/** Classic labels are retired from the sidebar. Signed-in visits redirect in v2Redirect. */
export const permittedClassicItems: (permissions?: readonly string[], isAdministrator?: boolean, interviewerOnly?: boolean) => SeatNavItem[] = () => {
  return [];
};

export function permittedNavItems(seat: Seat, permissions: readonly string[] | undefined, isAdministrator = false, recruiterOnly = false, interviewer = false): SeatNavItem[] {
  const held = new Set(permissions ?? []);
  return SEAT_NAV[seat].items.filter((item) => {
    if (item.notForRecruiter && recruiterOnly) return false;
    if (item.interviewerOnly && !interviewer) return false;
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
