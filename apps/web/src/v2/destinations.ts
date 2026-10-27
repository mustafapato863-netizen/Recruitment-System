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
  employee: ['/offers/:id', '/my-work', '/my-result', '/vacancies', '/vacancies/:id', '/candidates', '/candidates/compare', '/applications/:id', '/talent-pools'],
  // '/interviews/:id' stays for the Manager's own scorecard (Team work → Waiting on you → Submit scorecard).
  // v2 default: '/vacancy-requests' is the list only (the drawers carry ?req= / ?req=new); detail and create URLs redirect.
  manager: ['/offers/:id', '/my-work', '/vacancy-requests', '/reports', '/applications/:id'],
  admin: ['/users', '/roles', '/pipeline-settings', '/master-data', '/email-templates', '/whatsapp-templates', '/reports', '/audit-log', '/integrations'],
};

/**
 * v2 default (no v1 UI): v1 URLs that carry an id keep it on the v2 page. Checked before the seat's destinations,
 * so e.g. /vacancies/:id/analytics never reaches a v1 page. `$1` is the id.
 */
const PARAM_EQUIVALENT: Array<{ from: RegExp; to: Partial<Record<Seat, string>> }> = [
  // The v1 interview page → the v2 My interviews card + scorecard (Team work "Submit scorecard", My Work links).
  { from: /^\/interviews\/(?!calendar\/?$)([^/]+)\/?$/, to: { employee: '/my-interviews?interview=$1&scorecard=1', manager: '/my-interviews?interview=$1&scorecard=1' } },
  { from: /^\/offers\/create\/?$/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/vacancy-requests\/create\/?$/, to: { manager: '/vacancy-requests?req=new' } },
  { from: /^\/vacancy-requests\/([^/]+)\/?$/, to: { manager: '/vacancy-requests?req=$1' } },
  { from: /^\/vacancies\/([^/]+)\/.+$/, to: { employee: '/vacancies/$1' } },
  { from: /^\/applications\/([^/]+)\/.+$/, to: { employee: '/applications/$1', manager: '/applications/$1' } },
  { from: /^\/candidates\/(?!compare\/?$)[^/]+(\/.*)?$/, to: { employee: '/candidates?tab=bank' } },
];

/**
 * Classic staff URLs. A signed-in visit redirects to the closest v2 surface (classicStaffLanding).
 * Keep in step with App.tsx. The sidebar no longer lists them.
 */
export const CLASSIC_PATHS: RegExp[] = [
  /^\/hires(\/approvals\/inbox|\/[^/]+)?\/?$/, /^\/licenses\/?$/, /^\/joinings?\/?$/,
  /^\/interviews(\/calendar)?\/?$/, /^\/offers\/?$/, /^\/vacancies\/[^/]+\/analytics\/?$/,
  /^\/candidates\/(?!compare\/?$)[^/]+(\/documents)?\/?$/, /^\/cv-bank\/?$/, /^\/sourcing-match\/?$/, /^\/talent-pool\/?$/,
  /^\/import(\/[^/]+\/[^/]+)?\/?$/, /^\/classic\/(candidates|vacancies|master-data|pipeline-settings)\/?$/,
  /^\/settings(\/targets)?\/?$/, /^\/access-control\/?$/,
];
export const isClassicPath = (pathname: string) => CLASSIC_PATHS.some((r) => r.test(pathname));

/**
 * Final hiring approvers and licence specialists keep the queue that already lists their work.
 * My Work only loads files the caller owns, so it is not that queue.
 */
export function specialHome(user: { roles?: ReadonlyArray<{ code: string }>; permissions?: readonly string[] } | null | undefined): string | null {
  const codes = new Set((user?.roles ?? []).map((r) => r.code.trim().toUpperCase()));
  const perms = new Set(user?.permissions ?? []);
  if (codes.has('FINAL_HIRING_APPROVER') && perms.has('FINAL_HIRING_APPROVAL')) return '/hires/approvals/inbox';
  // #34: GET /hiring accepts APPLICATION_VIEW or LICENSE_CHECK.
  if (codes.has('LICENSE_SPECIALIST') && (perms.has('LICENSE_CHECK') || perms.has('APPLICATION_VIEW'))) return '/licenses';
  return null;
}

/**
 * PR33-3: each signed-in route's PermissionGate (App.tsx, v1 gates for classic pages). The shell sends a URL the
 * user can't open to their home instead of showing the v1 "Access Restricted" page. ADMINISTRATOR passes, as in v1.
 * Most specific first.
 */
type Gate = { all?: string[]; any?: string[] };
const ROUTE_GATES: Array<[RegExp, Gate]> = [
  [/^\/hires\/approvals\/inbox\/?$/, { all: ['FINAL_HIRING_APPROVAL'] }],
  // GET /hiring/:id allows any of these (the final approver opens the case she approves).
  [/^\/hires\/[^/]+\/?$/, { any: ['APPLICATION_VIEW', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'LICENSE_CHECK'] }],
  [/^\/licenses\/?$/, { any: ['APPLICATION_VIEW', 'LICENSE_CHECK'] }],
  [/^\/(hires|joinings|offers|reports)\/?$/, { all: ['APPLICATION_VIEW'] }],
  // #34: final-hire approvers read the file. LICENSE_CHECK opens the same file on the pre-hire drawer.
  [/^\/applications\/[^/]+\/?$/, { any: ['APPLICATION_VIEW', 'FINAL_HIRING_APPROVAL', 'LICENSE_CHECK'] }],
  [/^\/(candidates|cv-bank|sourcing-match|talent-pools|classic\/candidates)(\/|$)/, { all: ['CANDIDATE_VIEW'] }],
  [/^\/import\/[^/]+\/[^/]+\/?$/, { any: ['CANDIDATE_VIEW', 'VACANCY_REQUEST_VIEW', 'MASTER_DATA_VIEW'] }],
  [/^\/import\/?$/, { any: ['CANDIDATE_CREATE', 'VACANCY_REQUEST_CREATE', 'MASTER_DATA_MANAGE'] }],
  [/^\/(my-interviews|vacancies|interviews|classic\/vacancies)(\/|$)/, { all: ['VACANCY_VIEW'] }],
  [/^\/notifications\/?$/, { all: ['NOTIFICATION_VIEW'] }],
  [/^\/vacancy-requests(\/|$)/, { all: ['VACANCY_REQUEST_VIEW'] }],
  [/^\/(users|roles|access-control)\/?$/, { all: ['USERS_VIEW'] }],
  [/^\/(master-data|integrations|classic\/master-data)\/?$/, { all: ['MASTER_DATA_VIEW'] }],
  [/^\/audit-log\/?$/, { all: ['AUDIT_VIEW'] }],
  [/^\/(pipeline-settings|classic\/pipeline-settings)\/?$/, { all: ['OVERRIDE_WORKFLOW'] }],
  [/^\/(email|whatsapp)-templates\/?$/, { any: ['MASTER_DATA_MANAGE', 'MASTER_DATA_VIEW'] }],
  [/^\/settings\/targets\/?$/, { any: ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'VACANCY_ASSIGN', 'VACANCY_REASSIGN', 'MASTER_DATA_VIEW'] }],
  [/^\/settings\/?$/, { any: ['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW'] }],
];
export function canOpenRoute(pathname: string, permissions: readonly string[] | undefined, isAdministrator = false): boolean {
  if (isAdministrator) return true;
  const gate = ROUTE_GATES.find(([re]) => re.test(pathname))?.[1];
  if (!gate) return true;
  const held = new Set(permissions ?? []);
  return (!gate.all || gate.all.every((p) => held.has(p))) && (!gate.any || gate.any.some((p) => held.has(p)));
}

/** v1 page → v2 equivalent, per seat; anything else unknown goes home. */
const EQUIVALENT: Array<{ from: RegExp; to: Partial<Record<Seat, string>> }> = [
  { from: /^\/tasks\/?$/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(interviews|offers|hires|approval-inbox|inbox|joinings?|licenses|applications\/?$)/, to: { employee: '/my-work', manager: '/my-work' } },
  { from: /^\/(cv-bank|sourcing-match|cv-intake|import)/, to: { employee: '/candidates' } },
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
export function v2Redirect(seat: Seat, pathname: string, opts: { requisitions?: boolean; interviews?: boolean; interviewerOnly?: boolean; home?: string | null; permissions?: readonly string[]; isAdministrator?: boolean } = {}): string | null {
  // Stay on /applications/:id. A redirect that only adds ?drawer= keeps the same pathname, and the
  // shell would render Navigate instead of the file on every pass. The licence file opens that drawer.
  const to = v2RedirectByPath(seat, pathname, opts);
  // A URL, or a redirect target, the route gate refuses goes home instead of the v1 Access Restricted page.
  if (!opts.permissions) return samePath(pathname, to) ? null : to;
  const home = opts.home ?? SEAT_HOME[seat];
  const target = (to ?? pathname).split('?')[0];
  if (target !== home && !canOpenRoute(target, opts.permissions, opts.isAdministrator)) return home;
  // A same-path result only adds a query. The shell would replace the page with Navigate and the file would never mount.
  return samePath(pathname, to) ? null : to;
}

function samePath(pathname: string, to: string | null): boolean {
  return Boolean(to) && to!.split('?')[0] === pathname.split('?')[0];
}

/** Closest existing v2 page for a classic staff URL. Null when the path is not classic, or when it is the caller's own queue. */
function classicStaffLanding(seat: Seat, pathname: string, opts: { interviews?: boolean; home?: string | null }): string | null {
  if (!isClassicPath(pathname)) return null;
  const seatHome = SEAT_HOME[seat];
  const focused = opts.home && opts.home !== seatHome ? opts.home : null;
  const here = pathname.replace(/\/$/, '') || '/';
  // The approval inbox and the licence desk are the queues. A hiring case the gate already allows stays so its file link can open.
  if (focused && here === focused.replace(/\/$/, '')) return null;
  if (focused && /^\/hires\/(?!approvals\/)[^/]+$/.test(here)) return null;
  const home = focused ?? seatHome;
  if (/^\/interviews(\/calendar)?\/?$/.test(pathname)) {
    if (seat === 'admin' || (seat === 'employee' && opts.interviews === false)) return home;
    return '/my-interviews';
  }
  if (/^\/(sourcing-match|talent-pool)\/?$/.test(pathname)) return seat === 'employee' ? '/talent-pools' : home;
  if (/^\/(cv-bank|classic\/candidates)\/?$/.test(pathname) || /^\/import(\/[^/]+\/[^/]+)?\/?$/.test(pathname)) return seat === 'employee' ? '/candidates' : home;
  if (/^\/classic\/vacancies\/?$/.test(pathname)) return seat === 'employee' ? '/vacancies' : home;
  if (/^\/access-control\/?$/.test(pathname)) return seat === 'admin' ? '/roles' : home;
  if (/^\/(settings(\/targets)?|classic\/master-data)\/?$/.test(pathname)) return seat === 'admin' ? '/master-data' : home;
  if (/^\/classic\/pipeline-settings\/?$/.test(pathname)) return seat === 'admin' ? '/pipeline-settings' : home;
  return home;
}
/** Candidate entry paths. They are public routes, never the staff seat home. */
const CANDIDATE_ENTRY = /^\/(?:portal(?:\/.*)?|my-applications)\/?$/;

function v2RedirectByPath(seat: Seat, pathname: string, opts: { requisitions?: boolean; interviews?: boolean; interviewerOnly?: boolean; home?: string | null } = {}): string | null {
  if (pathname === '/' || pathname === '') return opts.home ?? SEAT_HOME[seat];
  if (CANDIDATE_ENTRY.test(pathname)) return null;
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
  // Null here means stay. A classic path must not fall through to EQUIVALENT, which would send /hires/:id home.
  if (isClassicPath(pathname)) return classicStaffLanding(seat, pathname, opts);
  for (const rule of EQUIVALENT) if (rule.from.test(pathname) && rule.to[seat]) return rule.to[seat]!;
  return SEAT_HOME[seat];
}
