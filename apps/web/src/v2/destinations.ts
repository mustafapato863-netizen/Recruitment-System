import type { Seat } from './seat';

/**
 * B2-17 / B2-18 (Roadmap v2 §1 "A page the seat cannot use is absent", §5, §6, §7):
 * where each v2 seat may go. "/" and the v1 Command Center are never a v2 home; any other
 * path a seat can't use redirects to its v2 equivalent (or the seat's home). The API still
 * guards the data; this is routing only.
 */
export const SEAT_HOME: Record<Seat, string> = { employee: '/my-work', manager: '/my-work', admin: '/users' };

/** Everyone: the shell's own menus (profile, notifications page, search). */
const COMMON = ['/profile', '/notifications', '/search'];

/** Path prefixes per seat ("/x" allows "/x" and "/x/…"). Keep in step with navConfig + the v2 pages. */
export const SEAT_DESTINATIONS: Record<Seat, string[]> = {
  employee: ['/my-work', '/my-result', '/vacancies', '/candidates', '/applications/:id'],
  // '/interviews/:id' stays for the Manager's own scorecard (Team work → Waiting on you → Submit scorecard).
  manager: ['/my-work', '/vacancy-requests', '/reports', '/applications/:id', '/interviews/:id'],
  admin: ['/users', '/roles', '/pipeline-settings', '/master-data', '/email-templates', '/whatsapp-templates', '/reports', '/audit-log', '/integrations'],
};

/** v1 page → v2 equivalent, per seat; anything else unknown goes home. */
const EQUIVALENT: Array<{ from: RegExp; to: Partial<Record<Seat, string>> }> = [
  { from: /^\/tasks\/?$/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(interviews|offers|hires|approval-inbox|inbox|joinings?|licenses|applications\/?$)/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(cv-bank|sourcing-match|talent-pools?|cv-intake|import)/, to: { employee: '/candidates' } },
  { from: /^\/(team-result|performance)/, to: { manager: '/reports' } },
  { from: /^\/(access-control|role)/, to: { admin: '/roles' } },
  { from: /^\/settings\/?/, to: { admin: '/master-data' } },
];

function matches(pattern: string, pathname: string): boolean {
  if (pattern.endsWith('/:id')) {
    const base = pattern.slice(0, -4);
    return new RegExp(`^${base}/[^/]+/?$`).test(pathname);
  }
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

export function isV2Destination(seat: Seat, pathname: string): boolean {
  return [...COMMON, ...SEAT_DESTINATIONS[seat]].some((p) => matches(p, pathname));
}

/** null = stay; otherwise where to go instead. */
export function v2Redirect(seat: Seat, pathname: string): string | null {
  if (pathname === '/' || pathname === '') return SEAT_HOME[seat];
  if (isV2Destination(seat, pathname)) return null;
  for (const rule of EQUIVALENT) if (rule.from.test(pathname) && rule.to[seat]) return rule.to[seat]!;
  return SEAT_HOME[seat];
}
