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
  employee: ['/my-work', '/my-result', '/vacancies', '/vacancies/:id', '/candidates', '/candidates/compare', '/applications/:id'],
  // '/interviews/:id' stays for the Manager's own scorecard (Team work → Waiting on you → Submit scorecard).
  // v2 default: '/vacancy-requests' is the list only (the drawers carry ?req= / ?req=new); detail and create URLs redirect.
  manager: ['/my-work', '/vacancy-requests', '/reports', '/applications/:id'],
  admin: ['/users', '/roles', '/pipeline-settings', '/master-data', '/email-templates', '/whatsapp-templates', '/reports', '/audit-log', '/integrations'],
};

/**
 * v2 default (no v1 UI): v1 URLs that carry an id keep it on the v2 page. Checked before the seat's destinations,
 * so e.g. /vacancies/:id/analytics never reaches a v1 page. `$1` is the id.
 */
const PARAM_EQUIVALENT: Array<{ from: RegExp; to: Partial<Record<Seat, string>> }> = [
  // The v1 interview page → the v2 My interviews card + scorecard (Team work "Submit scorecard", My Work links).
  { from: /^\/interviews\/(?!calendar\/?$)([^/]+)\/?$/, to: { employee: '/my-interviews?interview=$1&scorecard=1', manager: '/my-interviews?interview=$1&scorecard=1' } },
  { from: /^\/vacancy-requests\/create\/?$/, to: { manager: '/vacancy-requests?req=new' } },
  { from: /^\/vacancy-requests\/([^/]+)\/?$/, to: { manager: '/vacancy-requests?req=$1' } },
  { from: /^\/vacancies\/([^/]+)\/.+$/, to: { employee: '/vacancies/$1' } },
  { from: /^\/applications\/([^/]+)\/.+$/, to: { employee: '/applications/$1', manager: '/applications/$1' } },
  { from: /^\/candidates\/(?!compare\/?$)[^/]+(\/.*)?$/, to: { employee: '/candidates?tab=bank' } },
];

/** v1 page → v2 equivalent, per seat; anything else unknown goes home. */
const EQUIVALENT: Array<{ from: RegExp; to: Partial<Record<Seat, string>> }> = [
  { from: /^\/tasks\/?$/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(interviews|offers|hires|approval-inbox|inbox|joinings?|licenses|applications\/?$)/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(cv-bank|sourcing-match|talent-pools?|cv-intake|import)/, to: { employee: '/candidates' } },
  { from: /^\/(team-result|performance)/, to: { manager: '/reports' } },
  { from: /^\/(access-control|role)/, to: { admin: '/roles' } },
  { from: /^\/settings\/?/, to: { admin: '/master-data' } },
  { from: /^\/reporting-tree\/?$/, to: { admin: '/users' } },
  { from: /^\/(vacancies|candidates)(\/|$)/, to: { manager: '/my-work' } },
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

/**
 * Backend #21 (B2-3, migration b3e): the RECRUITER role no longer holds VACANCY_REQUEST_VIEW/CREATE,
 * so requisitions answer 403. A user whose only role is Recruiter never sees them (nav or route),
 * even with a stale permission list; otherwise VACANCY_REQUEST_VIEW decides, like the API.
 */
export function isRecruiterOnly(roles: ReadonlyArray<{ code: string }> | undefined): boolean {
  const codes = (roles ?? []).map((r) => r.code);
  return codes.length > 0 && codes.every((c) => c === 'RECRUITER');
}
export function canUseRequisitions(user: { roles?: ReadonlyArray<{ code: string }>; permissions?: readonly string[] } | null | undefined): boolean {
  if (!user || isRecruiterOnly(user.roles)) return false;
  return (user.roles ?? []).some((r) => r.code === 'ADMINISTRATOR') || (user.permissions ?? []).includes('VACANCY_REQUEST_VIEW');
}
const REQUISITIONS = /^\/vacancy-requests([/?]|$)/;
const MY_INTERVIEWS = /^\/my-interviews\/?$/;

/** null = stay; otherwise where to go instead. `opts.requisitions === false` drops /vacancy-requests (Recruiter role). */
/**
 * B2V-2: an interviewer-only user (interviewer, no APPLICATION_VIEW) can use My Work, My interviews and the shell's
 * own pages; every other URL (e.g. /candidates, /applications/:id) would be a v1 "Access Restricted" page, so it
 * goes to /my-interviews instead.
 */
const INTERVIEWER_ONLY_OK = ['/my-work', '/my-interviews', ...COMMON];
export function isInterviewerOnly(user: { permissions?: readonly string[] } | null | undefined, interviewer: boolean): boolean {
  return interviewer && !(user?.permissions ?? []).includes('APPLICATION_VIEW');
}
export function v2Redirect(seat: Seat, pathname: string, opts: { requisitions?: boolean; interviews?: boolean; interviewerOnly?: boolean } = {}): string | null {
  if (pathname === '/' || pathname === '') return SEAT_HOME[seat];
  for (const rule of PARAM_EQUIVALENT) {
    const m = rule.from.exec(pathname);
    const to = m ? rule.to[seat] : undefined;
    if (to) {
      if (opts.requisitions === false && REQUISITIONS.test(to)) return SEAT_HOME[seat];
      return to.replace('$1', encodeURIComponent(decodeURIComponent(m![1] ?? '')));
    }
  }
  if (opts.interviewerOnly && seat !== 'admin') return INTERVIEWER_ONLY_OK.some((p) => matches(p, pathname)) ? null : '/my-interviews';
  // B2F-3: an interviewer (any non-admin seat) reads the CV and submits their scorecard on /my-interviews, inside the v2 shell.
  // The Manager seat always may: its own scorecards (Team work → Waiting on you) open there.
  if (MY_INTERVIEWS.test(pathname) && seat !== 'admin') return opts.interviews === false && seat !== 'manager' ? SEAT_HOME[seat] : null;
  if (opts.requisitions === false && REQUISITIONS.test(pathname)) return SEAT_HOME[seat];
  if (isV2Destination(seat, pathname)) return null;
  for (const rule of EQUIVALENT) if (rule.from.test(pathname) && rule.to[seat]) return rule.to[seat]!;
  return SEAT_HOME[seat];
}
