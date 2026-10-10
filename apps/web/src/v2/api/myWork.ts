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

export type WorkItemType = 'job' | 'requisition' | 'task' | 'interview' | 'scorecard' | 'offer';
export type WaitingOn = 'approver' | 'interviewer' | 'candidate';

/** nextAction.code values #9 emits today (string on the wire). */
export type KnownNextActionCode =
  | 'review-applicants' | 'view-requisition' | 'activate-requisition' | 'submit-requisition' | 'set-due-date'
  | 'complete-task' | 'open-interview' | 'submit-scorecard' | 'open-offer';

export interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  /** Date-only (YYYY-MM-DD) for jobs/requisitions, ISO instant for tasks/interviews/scorecards; null for offers. */
  dueAt: string | null;
  reason: string;
  nextAction: { code: string; label: string };
  /** 'Vacancy' | 'VacancyRequest' | 'Interview' | 'Application' | a task's entityType | 'Task'. */
  entity: { type: string; id: string };
  waitingOn?: WaitingOn;
}

export type MyWorkTarget = TargetChip & { vacancyId: string; vacancyCode: string };

export interface MyWorkResponse {
  /** Always "Africa/Cairo" in #9. */
  timezone: string;
  /** Cairo calendar date, YYYY-MM-DD. */
  today: string;
  generatedAt: string;
  counts: { overdue: number; today: number; waitingOnOthers: number };
  overdue: WorkItem[];
  dueToday: WorkItem[];
  waitingOnOthers: WorkItem[];
  targets: MyWorkTarget[];
  /** True only when all buckets AND targets are empty. */
  empty: boolean;
  emptyMessage: string | null;
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

/** Defensive normalisation so a partial payload can't crash the page. Invents nothing. */
export function normalizeMyWork(raw: Partial<MyWorkResponse> | null | undefined): MyWorkResponse {
  const overdue = arr<WorkItem>(raw?.overdue);
  const dueToday = arr<WorkItem>(raw?.dueToday);
  const waitingOnOthers = arr<WorkItem>(raw?.waitingOnOthers);
  const targets = arr<MyWorkTarget>(raw?.targets);
  const empty = typeof raw?.empty === 'boolean' ? raw.empty : overdue.length + dueToday.length + waitingOnOthers.length + targets.length === 0;
  return {
    timezone: raw?.timezone || 'Africa/Cairo',
    today: raw?.today ?? '',
    generatedAt: raw?.generatedAt ?? '',
    counts: raw?.counts ?? { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waitingOnOthers.length },
    overdue, dueToday, waitingOnOthers, targets, empty,
    emptyMessage: raw?.emptyMessage ?? null,
  };
}

export async function fetchMyWorkApi(): Promise<MyWorkResponse> {
  return normalizeMyWork(await getApi<Partial<MyWorkResponse>>('/me/work'));
}

export async function getMyWork(
  deps: { env?: MyWorkEnv; api?: () => Promise<MyWorkResponse>; fixture?: () => Promise<MyWorkResponse> } = {},
): Promise<MyWorkResult> {
  const env = deps.env ?? browserEnv();
  const api = deps.api ?? fetchMyWorkApi;
  // DEV-guarded so production builds drop the fixture chunk entirely.
  const fixture = deps.fixture ?? (import.meta.env.DEV
    ? async () => (await import('./myWork.fixtures')).myWorkFixture()
    : async (): Promise<MyWorkResponse> => { throw new Error('My Work fixtures are development-only'); });
  const mode = resolveSourceMode(env);
  if (mode === 'fixture') return { data: normalizeMyWork(await fixture()), source: 'fixture' };
  if (mode === 'api') return { data: await api(), source: 'api' };
  try {
    return { data: await api(), source: 'api' };
  } catch (error) {
    if (!isEndpointMissing(error)) throw error;
    return { data: normalizeMyWork(await fixture()), source: 'fixture' };
  }
}

/** v1 route for a work item's entity; null when there is no page for it. */
export function entityHref(entity: WorkItem['entity']): string | null {
  const id = encodeURIComponent(entity.id);
  switch (entity.type) {
    case 'Application': return `/applications/${id}`;
    case 'Vacancy': return `/vacancies/${id}`;
    case 'VacancyRequest': return `/vacancy-requests/${id}`;
    case 'Interview': return `/interviews/${id}`;
    case 'Candidate': return `/candidates/${id}`;
    case 'Offer': return `/offers/${id}`;
    case 'Hire': return `/hires/${id}`;
    default: return null;
  }
}
