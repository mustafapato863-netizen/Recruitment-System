/**
 * E1 My Work adapter. Types mirror the B4 contract as written in
 * BACKEND_GAP.md §5 B4 ("GET /me/work → Overdue / Today / Waiting on others,
 * each with the next legal action; chip = requisition title, filled of seats,
 * due date; API hides SLA chips if the heartbeat is stale") and the shape
 * proposed in FRONTEND_GAP.md chunk E1. B4 has not landed; field names below
 * are the frontend proposal and are listed as contract gaps in e1/REPORT.md.
 *
 * Source selection (never silent in production):
 * - production build: always the real endpoint; errors surface as error/forbidden states.
 * - dev: VITE_MY_WORK_SOURCE = 'api' | 'fixture' | 'auto' (default 'auto'), or ?mywork=api|fixture.
 *   'auto' calls the real endpoint and only falls back to fixtures when it is
 *   missing (404/405/501 or network failure); the page then shows a "Sample data" notice.
 */
import { getApi, ApiError } from '../../api/client';

export type WorkDay = 'today' | 'tomorrow';
export type WorkSection = 'overdue' | 'today' | 'waiting';

export interface MyWorkJob {
  id: string;
  /** Requisition title (B3/B4: the chip comes from the requisition). */
  title: string;
  requisitionId: string | null;
  department: string | null;
  site: { id: string; name: string } | null;
  ownerName: string | null;
  seats: { filled: number; target: number };
  /** Requisition due date (B3 dueDate), ISO date. */
  dueDate: string | null;
}

/** The ONE next legal action for a task (Roadmap §7 "One button"). */
export type NextActionKind = 'open_file' | 'log_screening' | 'chase_scorecard' | 'schedule_interview' | 'send_offer' | 'view_file';
export interface NextAction {
  kind: NextActionKind;
  label: string;
  /** When false, the row shows the label as text ("No action for you"). */
  enabled: boolean;
}

export interface MyWorkTask {
  id: string;
  section: WorkSection;
  applicationId: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Pre-Hire' | 'Joined';
  /** Short title, e.g. "Scorecard missing". */
  title: string;
  /** One line of context, e.g. "interview held 6 Oct with Karim Hassan · gate blocks Offer". */
  context: string;
  /** Follow-up date (B2/B4 follow-up column). Overdue = past this. */
  followUpAt: string | null;
  /** SLA state. Null when the reminder worker is stale (or the API hides it). */
  sla: 'on_track' | 'due_today' | 'overdue' | null;
  /** Gate/blocker label shown as a chip, e.g. "Scorecard missing". */
  blocker: string | null;
  waitingOn: { id: string; name: string } | null;
  nextAction: NextAction;
}

export interface MyWorkScheduledItem {
  id: string;
  kind: 'interview';
  applicationId: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  title: string;
  context: string;
  startsAt: string;
  endsAt: string | null;
  /** v2: a room and optional room URL only (no self-schedule link, no Google Meet). */
  room: { name: string; url: string | null } | null;
  interviewer: { id: string; name: string } | null;
}

export interface MyWorkResponse {
  day: WorkDay;
  /** The calendar date the view is for (ISO date, org timezone). */
  date: string;
  job: MyWorkJob | null;
  counts: { total: number; overdue: number; today: number; waiting: number };
  sections: Record<WorkSection, MyWorkTask[]>;
  /** Tomorrow view: booked items (E05). Empty for today. */
  scheduled: MyWorkScheduledItem[];
  /** Reminder worker heartbeat. False → SLA chips hidden. */
  reminderWorkerHealthy: boolean;
  generatedAt: string;
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
  return error instanceof TypeError; // fetch network failure (no API in dev)
}

/** Defensive normalisation so a partial API payload can't crash the page. */
export function normalizeMyWork(raw: Partial<MyWorkResponse> | null | undefined, day: WorkDay): MyWorkResponse {
  const sections = raw?.sections ?? ({} as Partial<Record<WorkSection, MyWorkTask[]>>);
  const list = (s: WorkSection) => (Array.isArray(sections[s]) ? (sections[s] as MyWorkTask[]) : []);
  const overdue = list('overdue'); const today = list('today'); const waiting = list('waiting');
  const healthy = raw?.reminderWorkerHealthy !== false;
  const strip = (t: MyWorkTask): MyWorkTask => (healthy ? t : { ...t, sla: null });
  return {
    day: raw?.day === 'tomorrow' || raw?.day === 'today' ? raw.day : day,
    date: raw?.date ?? new Date().toISOString().slice(0, 10),
    job: raw?.job ?? null,
    counts: raw?.counts ?? { total: overdue.length + today.length + waiting.length, overdue: overdue.length, today: today.length, waiting: waiting.length },
    sections: { overdue: overdue.map(strip), today: today.map(strip), waiting: waiting.map(strip) },
    scheduled: Array.isArray(raw?.scheduled) ? raw.scheduled : [],
    reminderWorkerHealthy: healthy,
    generatedAt: raw?.generatedAt ?? new Date().toISOString(),
  };
}

export async function fetchMyWorkApi(day: WorkDay): Promise<MyWorkResponse> {
  const raw = await getApi<Partial<MyWorkResponse>>(`/me/work?day=${day}`);
  return normalizeMyWork(raw, day);
}

export async function getMyWork(
  day: WorkDay,
  deps: { env?: MyWorkEnv; api?: (day: WorkDay) => Promise<MyWorkResponse>; fixture?: (day: WorkDay) => Promise<MyWorkResponse> } = {},
): Promise<MyWorkResult> {
  const env = deps.env ?? browserEnv();
  const api = deps.api ?? fetchMyWorkApi;
  // DEV-guarded so production builds drop the fixture chunk entirely.
  const fixture = deps.fixture ?? (import.meta.env.DEV
    ? async (d: WorkDay) => (await import('./myWork.fixtures')).myWorkFixture(d)
    : async (): Promise<MyWorkResponse> => { throw new Error('My Work fixtures are development-only'); });
  const mode = resolveSourceMode(env);
  if (mode === 'fixture') return { data: normalizeMyWork(await fixture(day), day), source: 'fixture' };
  if (mode === 'api') return { data: await api(day), source: 'api' };
  try {
    return { data: await api(day), source: 'api' };
  } catch (error) {
    if (!isEndpointMissing(error)) throw error; // 401/403/500 are real; never masked
    return { data: normalizeMyWork(await fixture(day), day), source: 'fixture' };
  }
}
