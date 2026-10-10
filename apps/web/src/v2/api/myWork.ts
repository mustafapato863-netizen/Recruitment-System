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
  applicationId?: string;
  candidate?: { id: string; name: string };
  stage?: string;
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

/** Defensive normalisation so a partial payload can't crash the page. Invents nothing. */
export function normalizeMyWork(raw: Partial<MyWorkResponse> | null | undefined, asked: MyWorkDay = 'today'): MyWorkResponse {
  const overdue = arr<WorkItem>(raw?.overdue).map(normItem);
  const dueToday = arr<WorkItem>(raw?.dueToday).map(normItem);
  const waitingOnOthers = arr<WorkItem>(raw?.waitingOnOthers).map(normItem);
  const targets = arr<MyWorkTarget>(raw?.targets).map((t) => ({ ...t, department: t.department ?? null, site: t.site ?? null, owner: t.owner ?? null }));
  const empty = typeof raw?.empty === 'boolean' ? raw.empty : overdue.length + dueToday.length + waitingOnOthers.length === 0;
  const day: MyWorkDay = raw?.day === 'tomorrow' || raw?.day === 'today' ? raw.day : asked;
  return {
    timezone: raw?.timezone || 'Africa/Cairo',
    today: raw?.today ?? '',
    day,
    date: raw?.date ?? raw?.today ?? '',
    generatedAt: raw?.generatedAt ?? '',
    counts: raw?.counts ?? { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waitingOnOthers.length },
    overdue, dueToday, waitingOnOthers, targets, empty,
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
    case 'requisition': return `/vacancy-requests/${id}`;
    case 'interview': return `/interviews/${id}`;
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
