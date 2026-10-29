/**
 * E1 My Work adapter for backend PR #9 (B4, branch feat/b4-my-work).
 * Types mirror apps/api/src/my-work/my-work.buckets.ts and `TargetChip` in
 * packages/contracts on that branch EXACTLY. Once #9 merges, `TargetChip`
 * can be imported from @recruitflow/contracts instead of redeclared here.
 *
 * Contract (#9): `GET /me/work`, no query parameters (no `day=`); the server
 * computes Africa/Cairo calendar days. Buckets: overdue (due before today),
 * dueToday, waitingOnOthers. Signed-in user only.
 *
 * Source selection (never silent in production):
 * - production build: always the real endpoint; errors surface as error/forbidden states.
 * - dev: VITE_MY_WORK_SOURCE = 'api' | 'fixture' | 'auto' (default 'auto'), or ?mywork=api|fixture.
 *   'auto' falls back to fixtures only when the endpoint is missing (404/405/501 or network
 *   failure); the page then shows a "Sample data" notice.
 */
import { getApi, ApiError } from '../../api/client';
import { withReturnTo } from '../returnTarget';

/** = TargetChip in packages/contracts (#9). */
export interface TargetChip {
  title: string;
  filled: number;
  target: number;
  /** "X of Y" */
  label: string;
  dueDate: string | null;
}

/** = myWorkEntityTypes (#9 @829983a). Interview/offer items point at the interview/offer itself. */
export const MY_WORK_ENTITY_TYPES = ['application', 'interview', 'offer', 'requisition', 'job', 'task'] as const;
export type MyWorkEntityType = (typeof MY_WORK_ENTITY_TYPES)[number];
export type MyWorkDay = 'today' | 'tomorrow';
export type WorkItemType = 'job' | 'requisition' | 'task' | 'interview' | 'scorecard' | 'offer';
export type WaitingOn = 'approver' | 'interviewer' | 'candidate';

/** nextAction.code / actions[].key values #9 emits today (string on the wire). */
export type KnownActionKey =
  | 'review-applicants' | 'hold-job' | 'view-requisition' | 'activate-requisition' | 'submit-requisition' | 'set-due-date'
  | 'cancel-requisition' | 'complete-task' | 'open-interview' | 'submit-scorecard' | 'move-to-offer' | 'open-offer'
  | 'send-offer' | 'record-response';

/** = MyWorkAction. */
export interface MyWorkAction { key: string; label: string; disabled: boolean; reason?: string }
/** = MyWorkPerson. */
export interface MyWorkPerson { id: string | null; name: string }

/** = MyWorkItem. */
export interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  /** Date-only (YYYY-MM-DD) for jobs/requisitions, ISO instant otherwise; null for offers. */
  dueAt: string | null;
  reason: string;
  nextAction: { code: string; label: string };
  entity: { type: MyWorkEntityType; id: string };
  actions: MyWorkAction[];
  waitingOn?: WaitingOn;
  startAt?: string;
  endAt?: string;
  /** v2: room URL only (no Meet, no self-schedule). */
  room?: { name: string | null; url: string | null };
  interviewer?: MyWorkPerson | null;
  interviewers?: MyWorkPerson[];
  /** B4 C6: offers waiting on approval name the approver (approver{id,name} / approvers[]). */
  approver?: MyWorkPerson | null;
  approvers?: MyWorkPerson[];
  applicationId?: string;
  candidate?: { id: string; name: string };
  stage?: string;
}

/** File = caller owns the recruiting file. Evaluation = assigned interviewer only. */
export type InterviewAccess = 'file' | 'evaluation';
export type InterviewScheduleStatus = 'scheduled' | 'scorecard_overdue' | 'assigned';

export interface UpcomingInterview {
  id: string;
  title: string;
  candidateName: string | null;
  jobTitle: string | null;
  startAt: string;
  endAt: string | null;
  room: { name: string | null; url: string | null };
  interviewers: MyWorkPerson[];
  access: InterviewAccess;
  /** Set only for file access. Never present for a narrow assigned interviewer. */
  applicationId?: string;
  held: boolean;
  status: InterviewScheduleStatus;
  action: MyWorkAction;
}

export type JoiningReadiness = 'approval_pending' | 'licence_pending' | 'checks_pending' | 'ready' | 'postponed' | 'blocked' | 'review';

export interface JoiningSoon {
  id: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  intendedDate: string | null;
  checksComplete: number;
  checksRequired: number;
  readiness: JoiningReadiness;
  detail: string;
  /** Always false. A scheduled start or an approval is not a completed hire. */
  joined: false;
  held: boolean;
}

/** = MyWorkTarget. */
export interface MyWorkTarget extends TargetChip {
  vacancyId: string;
  vacancyCode: string;
  department: string | null;
  site: string | null;
  owner: { id: string; name: string } | null;
}

/** = MyWorkResponse (#9 @829983a). */
export interface MyWorkResponse {
  timezone: string;
  today: string;
  day: MyWorkDay;
  /** The Cairo date `dueToday` lists (today, or tomorrow with ?day=tomorrow). */
  date: string;
  generatedAt: string;
  counts: { overdue: number; today: number; waitingOnOthers: number };
  overdue: WorkItem[];
  dueToday: WorkItem[];
  waitingOnOthers: WorkItem[];
  targets: MyWorkTarget[];
  /** Absent when the payload omits the array. Empty means the caller has none. */
  upcomingInterviews?: UpcomingInterview[];
  /** Absent when the payload omits the array. Empty means the caller has none. */
  joiningSoon?: JoiningSoon[];
  /** True when there are no work items; targets alone do not count. */
  empty: boolean;
  emptyMessage: string | null;
  /** Reminder worker swept within 2x its interval; SLA shown only when true. */
  reminderWorkerHealthy: boolean;
}

export type MyWorkSource = 'api' | 'fixture';
export interface MyWorkResult { data: MyWorkResponse; source: MyWorkSource }
export interface MyWorkEnv { prod: boolean; mode?: string | null; query?: string | null }

export function resolveSourceMode(env: MyWorkEnv): 'api' | 'fixture' | 'auto' {
  if (env.prod) return 'api';
  const pick = (v: string | null | undefined) => (v === 'api' || v === 'fixture' || v === 'auto' ? v : null);
  return pick(env.query) ?? pick(env.mode) ?? 'auto';
}

function browserEnv(): MyWorkEnv {
  let query: string | null = null;
  try { query = new URLSearchParams(window.location.search).get('mywork'); } catch { /* no window */ }
  return { prod: Boolean(import.meta.env.PROD), mode: import.meta.env.VITE_MY_WORK_SOURCE, query };
}

/** Missing endpoint (B4 not deployed) vs a real failure. */
export function isEndpointMissing(error: unknown): boolean {
  if (error instanceof ApiError) return [404, 405, 501].includes(error.statusCode);
  return error instanceof TypeError;
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function normItem(raw: WorkItem): WorkItem {
  return { ...raw, actions: arr<MyWorkAction>(raw.actions), entity: { type: String(raw.entity?.type ?? '').toLowerCase() as MyWorkEntityType, id: raw.entity?.id ?? '' } };
}

function hasOwn(raw: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

const UPCOMING_ACTIONS = new Set(['open-interview', 'submit-scorecard']);
const UPCOMING_STATUSES = new Set<InterviewScheduleStatus>(['scheduled', 'scorecard_overdue', 'assigned']);

/** Unknown relationship or action data is dropped. An enabled action is never invented. */
function normUpcoming(raw: UpcomingInterview): UpcomingInterview | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.access !== 'file' && raw.access !== 'evaluation') return null;
  const action = raw.action;
  if (!action || typeof action.key !== 'string' || typeof action.label !== 'string' || action.label.trim() === '') return null;
  if (typeof action.disabled !== 'boolean' || !UPCOMING_ACTIONS.has(action.key)) return null;
  if (!UPCOMING_STATUSES.has(raw.status)) return null;
  const row: UpcomingInterview = {
    id: raw.id,
    title: raw.title,
    candidateName: raw.candidateName ?? null,
    jobTitle: raw.jobTitle ?? null,
    startAt: raw.startAt,
    endAt: raw.endAt ?? null,
    room: { name: raw.room?.name ?? null, url: raw.room?.url ?? null },
    interviewers: arr<MyWorkPerson>(raw.interviewers),
    access: raw.access,
    held: raw.held === true,
    status: raw.status,
    action,
  };
  if (raw.access === 'file' && raw.applicationId) row.applicationId = raw.applicationId;
  return row;
}

const JOINING_READINESS = new Set<JoiningReadiness>(['approval_pending', 'licence_pending', 'checks_pending', 'ready', 'postponed', 'blocked', 'review']);

function normJoining(raw: JoiningSoon): JoiningSoon {
  const known = JOINING_READINESS.has(raw?.readiness);
  return {
    id: raw.id,
    applicationId: raw.applicationId,
    candidateName: raw.candidateName,
    jobTitle: raw.jobTitle,
    intendedDate: raw.intendedDate ?? null,
    checksComplete: raw.checksComplete ?? 0,
    checksRequired: raw.checksRequired ?? 0,
    readiness: known ? raw.readiness : 'review',
    detail: known ? raw.detail : 'Review readiness',
    joined: false,
    held: raw.held === true,
  };
}

/** Defensive normalisation so a partial payload can't crash the page. Invents nothing. */
export function normalizeMyWork(raw: Partial<MyWorkResponse> | null | undefined, asked: MyWorkDay = 'today'): MyWorkResponse {
  const overdue = arr<WorkItem>(raw?.overdue).map(normItem);
  const dueToday = arr<WorkItem>(raw?.dueToday).map(normItem);
  const waitingOnOthers = arr<WorkItem>(raw?.waitingOnOthers).map(normItem);
  const targets = arr<MyWorkTarget>(raw?.targets).map((t) => ({ ...t, department: t.department ?? null, site: t.site ?? null, owner: t.owner ?? null }));
  const empty = typeof raw?.empty === 'boolean' ? raw.empty : overdue.length + dueToday.length + waitingOnOthers.length === 0;
  const day: MyWorkDay = raw?.day === 'tomorrow' || raw?.day === 'today' ? raw.day : asked;
  const source = raw ?? {};
  const upcomingInterviews = hasOwn(source, 'upcomingInterviews')
    ? arr<UpcomingInterview>(raw?.upcomingInterviews).map(normUpcoming).filter((row): row is UpcomingInterview => row !== null)
    : undefined;
  const joiningSoon = hasOwn(source, 'joiningSoon') ? arr<JoiningSoon>(raw?.joiningSoon).map(normJoining) : undefined;
  return {
    timezone: raw?.timezone || 'Africa/Cairo',
    today: raw?.today ?? '',
    day,
    date: raw?.date ?? raw?.today ?? '',
    generatedAt: raw?.generatedAt ?? '',
    counts: raw?.counts ?? { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waitingOnOthers.length },
    overdue, dueToday, waitingOnOthers, targets, empty,
    ...(upcomingInterviews !== undefined ? { upcomingInterviews } : {}),
    ...(joiningSoon !== undefined ? { joiningSoon } : {}),
    emptyMessage: raw?.emptyMessage ?? null,
    // Missing flag = unknown health: treat as not healthy (hide SLA) rather than invent it.
    reminderWorkerHealthy: raw?.reminderWorkerHealthy === true,
  };
}

export async function fetchMyWorkApi(day: MyWorkDay = 'today'): Promise<MyWorkResponse> {
  return normalizeMyWork(await getApi<Partial<MyWorkResponse>>(`/me/work?day=${day}`), day);
}

export async function getMyWork(
  day: MyWorkDay = 'today',
  deps: { env?: MyWorkEnv; api?: (day: MyWorkDay) => Promise<MyWorkResponse>; fixture?: (day: MyWorkDay) => Promise<MyWorkResponse> } = {},
): Promise<MyWorkResult> {
  const env = deps.env ?? browserEnv();
  const api = deps.api ?? fetchMyWorkApi;
  // DEV-guarded so production builds drop the fixture chunk entirely.
  const fixture = deps.fixture ?? (import.meta.env.DEV
    ? async (d: MyWorkDay) => (await import('./myWork.fixtures')).myWorkFixture({ day: d })
    : async (): Promise<MyWorkResponse> => { throw new Error('My Work fixtures are development-only'); });
  const mode = resolveSourceMode(env);
  if (mode === 'fixture') return { data: normalizeMyWork(await fixture(day), day), source: 'fixture' };
  if (mode === 'api') return { data: await api(day), source: 'api' };
  try {
    return { data: await api(day), source: 'api' };
  } catch (error) {
    if (!isEndpointMissing(error)) throw error;
    return { data: normalizeMyWork(await fixture(day), day), source: 'fixture' };
  }
}

/** v1 route for a work item's entity; null when there is no page for it (tasks live on My Work). */
export function entityHref(entity: WorkItem['entity']): string | null {
  const id = encodeURIComponent(entity.id);
  switch (entity.type) {
    case 'application': return `/applications/${id}`;
    case 'job': return `/vacancies/${id}`;
    case 'requisition': return `/vacancy-requests?req=${id}`;
    case 'interview': return `/my-interviews?interview=${id}`;
    case 'offer': return `/offers/${id}`;
    default: return null;
  }
}

/** Where an enabled action goes. Most open the entity; move-to-offer opens the application. */
export function actionHref(item: WorkItem, action: MyWorkAction): string | null {
  if (action.key === 'move-to-offer' && item.applicationId) return `/applications/${encodeURIComponent(item.applicationId)}`;
  if (action.key === 'review-applicants' && item.entity.type === 'job') return `/vacancies/${encodeURIComponent(item.entity.id)}`;
  return entityHref(item.entity);
}

/**
 * E2: in the v2 Employee seat, application-linked actions open the v2 file (E13)
 * or its drawer instead of v1 pages. Others fall back to actionHref().
 */
export interface HrefContext { meId?: string; canOpenFile?: boolean; interviewer?: boolean; returnTo?: string | null }
const carried = (href: string | null, returnTo: string | null | undefined) => (href == null ? null : withReturnTo(href, returnTo));
export function fileActionHref(item: WorkItem, action: MyWorkAction, ctx: HrefContext = {}): string | null {
  // B2F-3: an interviewer's interview opens their v2 interview view (CV + own scorecard), never the file
  // (which needs APPLICATION_VIEW / ownership and showed v1 "Access Restricted").
  if (item.entity.type === 'interview' && ctx.interviewer && (action.key === 'open-interview' || action.key === 'submit-scorecard')) {
    const attendee = !!ctx.meId && [item.interviewer, ...(item.interviewers ?? [])].some((p) => p?.id === ctx.meId);
    if (attendee || ctx.canOpenFile === false) {
      return `/my-interviews?interview=${encodeURIComponent(item.entity.id)}${action.key === 'submit-scorecard' ? '&scorecard=1' : ''}`;
    }
  }
  const appId = item.applicationId ?? (item.entity.type === 'application' ? item.entity.id : undefined);
  if (!appId) return carried(actionHref(item, action), ctx.returnTo);
  const base = `/applications/${encodeURIComponent(appId)}`;
  const iv = item.entity.type === 'interview' ? `&interview=${encodeURIComponent(item.entity.id)}` : '';
  if (action.key === 'open-interview') return carried(base, ctx.returnTo);
  const drawer = FILE_DRAWER[action.key];
  if (!drawer) return carried(base, ctx.returnTo);
  return carried(drawer === 'scorecard' ? `${base}?drawer=scorecard${iv}` : `${base}?drawer=${drawer}`, ctx.returnTo);
}

/** Drawer keys the application file already opens. open-interview stays on the file without a drawer. */
const FILE_DRAWER: Record<string, string> = {
  screen: 'screen', 'log-screen': 'screen',
  schedule: 'schedule', 'schedule-interview': 'schedule',
  scorecard: 'scorecard', 'submit-scorecard': 'scorecard',
  offer: 'offer', 'move-to-offer': 'offer', 'draft-offer': 'offer', 'open-offer': 'offer',
  send: 'send', 'send-offer': 'send',
  answer: 'answer', 'record-response': 'answer',
  prehire: 'prehire', 'pre-hire': 'prehire', 'record-joining': 'prehire',
};

/** A role code (OFFER_APPROVER) is not a person; only real names are shown (B2-13). */
const isRoleCode = (name: string) => /^[A-Z][A-Z0-9_]+$/.test(name.trim());
function personNames(people: Array<MyWorkPerson | null | undefined>): string | null {
  const real = people.filter((person): person is MyWorkPerson => Boolean(person?.name && !isRoleCode(person.name)));
  const names = Array.from(new Set(real.map((person) => person.name)));
  return names.length ? names.join(', ') : null;
}
/**
 * The person a waiting item actually waits on.
 * Approver names are used only when waitingOn is approver (or unset, for older rows).
 * A sent offer (candidate) does not borrow an approver name.
 */
export function waitingOnName(item: WorkItem): string | null {
  if (item.waitingOn === 'candidate') return personNames(item.candidate ? [{ id: item.candidate.id, name: item.candidate.name }] : []);
  if (item.waitingOn === 'interviewer') return personNames([item.interviewer, ...(item.interviewers ?? [])]);
  if (item.waitingOn === 'approver' || item.waitingOn == null) return personNames([item.approver, ...(item.approvers ?? [])]);
  return null;
}

/** Sentence for the real blocker. Does not call every waiting offer an approval. */
export function waitingBlockerPhrase(item: WorkItem): string {
  const name = waitingOnName(item);
  if (item.waitingOn === 'candidate') return name ? `Waiting on ${name}` : 'Waiting on the candidate';
  if (item.waitingOn === 'interviewer') return name ? `Waiting on ${name}` : 'Waiting on the interviewer';
  if (item.waitingOn === 'approver') return name ? `Waiting on ${name}'s approval` : 'Waiting on approval';
  return name ? `Waiting on ${name}` : item.reason;
}

/** Waiting-offer title. The approver form stays "waiting on {name}" when a person is known. */
export function waitingOfferTitle(item: WorkItem): string {
  if (item.type !== 'offer' || !item.candidate) return item.title;
  const who = item.candidate.name;
  if (item.waitingOn === 'candidate') return `${who} — offer waiting on the candidate`;
  if (item.waitingOn === 'interviewer') {
    const on = waitingOnName(item);
    return `${who} — offer waiting on ${on ?? 'the interviewer'}`;
  }
  if (item.waitingOn === 'approver') {
    const on = waitingOnName(item);
    return `${who} — offer waiting ${on ? `on ${on}` : 'on approval'}`;
  }
  return item.title;
}

/** Schedule or scorecard drawer for a file the caller can open. Assigned rows stay on the interview page and never carry an application id. */
export function upcomingInterviewHref(row: UpcomingInterview, ctx: HrefContext = {}): string | null {
  if (!row.action || row.action.disabled) return null;
  const interviewId = encodeURIComponent(row.id);
  const scorecard = row.action.key === 'submit-scorecard' || row.action.label === 'View scorecard';
  if (row.access === 'evaluation') {
    return `/my-interviews?interview=${interviewId}${scorecard ? '&scorecard=1' : ''}`;
  }
  if (row.access !== 'file' || !row.applicationId || ctx.canOpenFile !== true) return null;
  const applicationId = encodeURIComponent(row.applicationId);
  if (scorecard) return carried(`/applications/${applicationId}?drawer=scorecard&interview=${interviewId}`, ctx.returnTo);
  if (row.action.label === 'Manage interview') return carried(`/applications/${applicationId}?drawer=schedule&interview=${interviewId}`, ctx.returnTo);
  return null;
}

const PREHIRE_READINESS: ReadonlySet<JoiningSoon['readiness']> = new Set(['licence_pending', 'ready', 'blocked', 'review']);

/** Checklist stays on the file. Those four readiness values open the pre-hire drawer; other rows without file access stay on the hiring case. */
export function joiningCaseHref(row: JoiningSoon, canOpenFile: boolean, returnTo?: string | null): { href: string; label: string } {
  const caseHref = `/hires/${encodeURIComponent(row.id)}`;
  if (PREHIRE_READINESS.has(row.readiness)) {
    return { href: withReturnTo(`/applications/${encodeURIComponent(row.applicationId)}?drawer=prehire`, returnTo), label: 'View readiness' };
  }
  if (canOpenFile) return { href: withReturnTo(`/applications/${encodeURIComponent(row.applicationId)}?drawer=prehire`, returnTo), label: 'Open checklist' };
  return { href: withReturnTo(caseHref, returnTo), label: 'Open checklist' };
}
