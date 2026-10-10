/**
 * E3 adapters: Open jobs (E08), Job pipeline (E09) and job status (E12).
 *
 * Contracts mirrored:
 * - B3 (`feat/b3-req-job-lifecycle` @2e2fc7d): job statuses Open | On Hold | Partially Filled | Filled | Closed,
 *   POST /vacancies/:id/hold {reason, note?, holdUntil?} | reopen {reason} | close {reason, note?}; hold/close reasons are
 *   ACTIVE values of master data 'hold-reasons' / 'close-reasons' ("Other" needs a note); GET /vacancies/:id/status-history.
 * - B3/B4: JobWorkQueueItem (GET /vacancies/work-queue[?mine=true]) with dueDate, department, holdUntil.
 * - B5 (#11 @e2f1296): applications list items carry gates[] and the card interview.
 * - B1 (#4): another owner's job comes back redacted: {id, redacted: true, title, site{id,name}, seats{filled,target}}.
 * - Applications: GET /applications?vacancyId= (Application with allowedTransitions), PATCH /applications/:id/stage.
 *
 * Error codes: the registry is the normalizer allowlist now, so B3/B5/B6 codes arrive as `code`. No message matching.
 * Nothing here carries pay; every response goes through stripPay() anyway.
 */
import { getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { domainError, type DomainError, type GateCode } from './gates';
import { isClosedStage, type FileStage } from './applicationFile';

const enc = encodeURIComponent;

/** = B3 JOB_STATUSES. */
export const JOB_STATUSES = ['Open', 'On Hold', 'Partially Filled', 'Filled', 'Closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
/** = B3 JOB_TRANSITIONS (server-side table; mirrored for pre-checks only). */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  Open: ['On Hold', 'Partially Filled', 'Filled', 'Closed'],
  'On Hold': ['Open', 'Partially Filled', 'Filled', 'Closed'],
  'Partially Filled': ['On Hold', 'Filled', 'Closed'],
  Filled: ['Closed'],
  Closed: [],
};
/** = B3 ACCEPTING_JOB_STATUSES: a held/filled/closed job takes no new applications. */
export const ACCEPTING_JOB_STATUSES: readonly JobStatus[] = ['Open', 'Partially Filled'];

/** = B1 redactVacancy(). */
export interface RedactedJob { id: string; redacted: true; title: string; site: { id: string; name: string } | null; seats: { filled: number; target: number } }
export const isRedactedJob = (v: unknown): v is RedactedJob => Boolean(v && typeof v === 'object' && (v as { redacted?: unknown }).redacted === true);

/** = TargetChip (#9). */
export interface TargetChip { title: string; filled: number; target: number; label: string; dueDate: string | null }

/** = JobWorkQueueItem (#9 @829983a). */
export interface JobWorkQueueItem {
  id: string;
  code: string;
  title: string;
  branch: { id: string; name: string; code?: string } | null;
  status: JobStatus;
  owner: { id: string; displayName: string } | null;
  headcount: { approved: number; joined: number; remaining: number };
  pipelineCounts: Record<string, number>;
  needsActionCount: number;
  health: { state: string; reason?: string; dueAt?: string } | null;
  lastActivity: { at: string; label: string } | null;
  nextAction: { code: string; label: string; enabled: boolean } | null;
  /** B3/E3: requisition due date (YYYY-MM-DD) and department. */
  dueDate?: string | null;
  department?: string | null;
  /** B3: optional hold-until date (data only; nothing auto-reopens). */
  holdUntil?: string | null;
}

/** The subset of Vacancy (contracts + B3/B4 additions) the v2 screens read. */
export interface JobDetail {
  id: string;
  vacancyCode: string;
  status: JobStatus;
  title?: string | null;
  position?: { id: string; title: string } | null;
  branch?: { id: string; name: string } | null;
  department?: string | null;
  approvedHeadcount: number;
  joinedHeadcount: number;
  targetStartDate: string | null;
  vacancyRequestId?: string;
  assignments?: Array<{ userId: string; assignmentKind?: 'PRIMARY' | 'SUPPORT'; isActive: boolean; user?: { id: string; displayName: string } }>;
  targetChip?: TargetChip;
  holdUntil?: string | null;
}

/** = vacancyStatusHistory select in getVacancyStatusHistory (B3). */
export interface JobStatusHistoryItem { id: string; fromStatus: string | null; toStatus: string; reason: string | null; holdUntil?: string | null; changedById: string | null; createdAt: string }

/** = GateState (B5 application-gates.ts) on each applications list item. */
export type GateKey = 'screen-note' | 'scorecard' | 'offer-accepted' | 'joining-checks' | 'reject-reason';
export interface FileGate { gate: GateKey; code: GateCode; met: boolean; missing: string[] }
/** = the card interview on the applications list: next upcoming, else the last one. */
export interface CardInterview { when: 'next' | 'last'; startAt: string; endAt: string; room: { name: string | null; url: string | null } }

/** The subset of Application (contracts) a board card reads. No pay, no contact details. */
export interface BoardApplication {
  id: string;
  applicationCode: string;
  vacancyId: string;
  candidateId: string;
  stage: FileStage;
  allowedTransitions: FileStage[];
  version: number;
  source?: string | null;
  appliedAt: string;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  nextFollowUpAt?: string | null;
  followUpDate?: string | null;
  candidate?: { id: string; firstName?: string; lastName?: string; currentTitle?: string | null } | null;
  gates?: FileGate[];
  interview?: CardInterview | null;
}

/**
 * The gate blocking this file's next forward move (B5 gates[]), shown as the card badge and counted as "Gate blocked".
 * Not counted: Applied (not worked yet) and Interview before the interview took place (nothing to submit yet).
 * Gate 5 (reject reason) never blocks a forward move.
 */
const NEXT_GATE: Partial<Record<FileStage, GateKey>> = { Screening: 'screen-note', Interview: 'scorecard', Offer: 'offer-accepted', 'Pre-Hire': 'joining-checks' };
export function blockingGate(app: Pick<BoardApplication, 'stage' | 'gates' | 'interview'>): FileGate | null {
  const key = NEXT_GATE[app.stage];
  if (!key) return null;
  if (key === 'scorecard' && app.interview?.when !== 'last') return null;
  const g = app.gates?.find((x) => x.gate === key);
  return g && !g.met ? g : null;
}

// ── Open jobs (E08) ──────────────────────────────────────────────────────────
export interface MyJobRow {
  id: string; code: string; title: string; status: JobStatus;
  site: string | null; siteId: string | null; department: string | null; ownerName: string | null;
  seats: { filled: number; target: number }; dueDate: string | null; holdUntil: string | null;
  pipelineCounts: Record<string, number>; active: number;
}
export interface OtherJobRow { id: string; title: string; site: string | null; seats: { filled: number; target: number } }
export interface OpenJobs { mine: MyJobRow[]; others: OtherJobRow[] }

const ACTIVE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];

/**
 * Mine = GET /vacancies/work-queue?mine=true (B3: jobs I own as active PRIMARY; ANDed with scope).
 * Others = the scoped queue minus mine, shown as title/site/seats only (redacted by #4 or not).
 */
export async function fetchOpenJobs(): Promise<OpenJobs> {
  const [mineRes, allRes] = await Promise.all([
    getApi<{ data: Array<JobWorkQueueItem | RedactedJob> }>('/vacancies/work-queue?mine=true&pageSize=100'),
    getApi<{ data: Array<JobWorkQueueItem | RedactedJob> }>('/vacancies/work-queue?pageSize=100').catch(() => ({ data: [] as Array<JobWorkQueueItem | RedactedJob> })),
  ]);
  const mine: MyJobRow[] = [];
  for (const raw of stripPay(mineRes?.data ?? [])) {
    if (isRedactedJob(raw)) continue;
    const counts = raw.pipelineCounts ?? {};
    mine.push({
      id: raw.id, code: raw.code, title: raw.title, status: raw.status,
      site: raw.branch?.name ?? null, siteId: raw.branch?.id ?? null, department: raw.department ?? null, ownerName: raw.owner?.displayName ?? null,
      seats: { filled: raw.headcount.joined, target: raw.headcount.approved }, dueDate: raw.dueDate ?? null, holdUntil: raw.holdUntil ?? null,
      pipelineCounts: counts, active: ACTIVE_STAGES.reduce((n, s) => n + (counts[s] ?? 0), 0),
    });
  }
  const mineIds = new Set(mine.map((m) => m.id));
  const others: OtherJobRow[] = stripPay(allRes?.data ?? []).filter((raw) => !mineIds.has(raw.id)).map((raw) => (isRedactedJob(raw)
    ? { id: raw.id, title: raw.title, site: raw.site?.name ?? null, seats: raw.seats }
    : { id: raw.id, title: raw.title, site: raw.branch?.name ?? null, seats: { filled: raw.headcount.joined, target: raw.headcount.approved } }));
  mine.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
  return { mine, others };
}

// ── Job pipeline (E09) ───────────────────────────────────────────────────────
export const BOARD_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];
export const BOARD_LABEL: Record<BoardStage, string> = { Applied: 'Applied', Screening: 'Screening', Interview: 'Interview', Offer: 'Offer', 'Pre-Hire': 'Pre-hire' };

export interface JobBoard {
  job: JobDetail | RedactedJob;
  apps: BoardApplication[];
  closed: { rejected: number; joined: number; withdrawn: number };
}

export async function loadJobBoard(id: string): Promise<JobBoard> {
  const job = stripPay(await getApi<JobDetail | RedactedJob>(`/vacancies/${enc(id)}`));
  if (!job || typeof job !== 'object' || Array.isArray(job) || !job.id) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (isRedactedJob(job)) return { job, apps: [], closed: { rejected: 0, joined: 0, withdrawn: 0 } };
  const res = await getApi<{ data: BoardApplication[] } | BoardApplication[]>(`/applications?vacancyId=${enc(id)}&pageSize=100`);
  const all = stripPay(Array.isArray(res) ? res : res?.data ?? []);
  return {
    job,
    apps: all.filter((a) => (BOARD_STAGES as readonly string[]).includes(a.stage)),
    closed: {
      rejected: all.filter((a) => a.stage === 'Rejected').length,
      joined: all.filter((a) => a.stage === 'Joined').length,
      withdrawn: all.filter((a) => a.stage === 'Withdrawn').length,
    },
  };
}

export const loadClosedFiles = async (id: string) => {
  const res = await getApi<{ data: BoardApplication[] } | BoardApplication[]>(`/applications?vacancyId=${enc(id)}&pageSize=100`);
  return stripPay(Array.isArray(res) ? res : res?.data ?? []).filter((a) => ['Joined', 'Rejected', 'Withdrawn'].includes(a.stage));
};

export function jobTitle(job: JobDetail | RedactedJob): string {
  return isRedactedJob(job) ? job.title : job.position?.title ?? job.title ?? job.vacancyCode;
}
export function jobOwner(job: JobDetail): { id: string; name: string } | null {
  const a = job.assignments?.find((x) => x.isActive && (x.assignmentKind ?? 'PRIMARY') === 'PRIMARY');
  return a ? { id: a.userId, name: a.user?.displayName ?? '' } : null;
}

/**
 * Board pre-check for a move. The server is the judge (gates answer 409); the UI only offers what can work:
 * the target must be in the application's allowedTransitions, on the board, and the next or previous column.
 * Skipping stages is not offered because each gate needs its own drawer.
 */
export function moveCheck(app: BoardApplication, target: BoardStage, job: JobDetail | RedactedJob): { ok: boolean; reason?: string } {
  if (isRedactedJob(job)) return { ok: false, reason: 'Only the job owner can move files.' };
  if (isClosedStage(app.stage)) return { ok: false, reason: `${app.stage} files are closed and do not move.` };
  if (job.status === 'Closed') return { ok: false, reason: 'This job is closed.' };
  if (target === app.stage) return { ok: false, reason: 'Already here.' };
  const from = BOARD_STAGES.indexOf(app.stage as BoardStage);
  const to = BOARD_STAGES.indexOf(target);
  if (from < 0) return { ok: false, reason: `${app.stage} files are not on the board.` };
  if (Math.abs(to - from) !== 1) return { ok: false, reason: `Move one stage at a time; ${BOARD_LABEL[BOARD_STAGES[from + Math.sign(to - from)]]} comes first.` };
  if (!app.allowedTransitions?.includes(target)) return { ok: false, reason: `${BOARD_LABEL[app.stage as BoardStage]} cannot move to ${BOARD_LABEL[target]}.` };
  return { ok: true };
}

/** The gate each forward move needs (#11), for the hint under "Move to…". */
export const MOVE_GATE_HINT: Partial<Record<BoardStage, string>> = {
  Interview: 'Needs a saved screen note',
  Offer: 'Needs a submitted scorecard',
  'Pre-Hire': 'Needs an accepted offer',
};

// ── Who may change the job status (#23 NEW-3) ─────────────────────────────────
/** A person from GET /users/assignable (the caller's reporting tree; managerId = their line manager). */
export interface AssignablePerson { id: string; displayName: string; managerId?: string | null; status?: string }
/** GET /users/assignable: any signed-in user (#21 B2-16), only the caller's own reports. */
export async function fetchAssignable(): Promise<AssignablePerson[]> {
  const res = await getApi<AssignablePerson[] | { data: AssignablePerson[] }>('/users/assignable');
  return Array.isArray(res) ? res : res?.data ?? [];
}
/**
 * = assertJobOwnerOrManager (#23 @5aef66c): hold, reopen, close and delete are for the job's owner (active PRIMARY
 * assignee) or that owner's line manager only; anyone else gets 403 JOB_NOT_OWNED, so the actions are hidden.
 * Administrators never change a job status (ADMIN_CANNOT_CHANGE_JOB_STATUS).
 */
export function canChangeJobStatus(job: JobDetail, me: { id: string; isAdmin?: boolean } | null | undefined, reports: readonly AssignablePerson[] | null): boolean {
  if (!me || me.isAdmin) return false;
  const owner = jobOwner(job);
  if (!owner) return false;
  if (owner.id === me.id) return true;
  return (reports ?? []).some((p) => p.id === owner.id && p.managerId === me.id);
}
export const JOB_NOT_OWNED_TEXT = 'Only the job owner or their manager can hold, reopen, close or delete this job.';

// ── Job status (E12, B3) ─────────────────────────────────────────────────────
export type JobAction = 'hold' | 'reopen' | 'close';
/** = JobStatusReasonDto: reason (list value for hold/close, free text for reopen), note (required for "Other"), holdUntil (hold only, YYYY-MM-DD, future Cairo day). */
export interface JobStatusBody { reason: string; note?: string; holdUntil?: string }
export const changeJobStatus = (id: string, action: JobAction, body: JobStatusBody) => {
  const out: JobStatusBody = { reason: body.reason.trim() };
  if (action !== 'reopen' && body.note?.trim()) out.note = body.note.trim();
  if (action === 'hold' && body.holdUntil) out.holdUntil = body.holdUntil;
  return postApi<JobDetail>(`/vacancies/${enc(id)}/${action}`, out).then((v) => stripPay(v));
};
export const jobStatusHistory = (id: string) => getApi<JobStatusHistoryItem[]>(`/vacancies/${enc(id)}/status-history`);

/** Which E12 actions B3 allows from a status. Reopen is only from On Hold (reopenVacancy). Closed is terminal. */
export function jobActions(status: JobStatus): JobAction[] {
  const out: JobAction[] = [];
  const next = JOB_TRANSITIONS[status] ?? [];
  if (next.includes('On Hold') && status !== 'On Hold') out.push('hold');
  if (status === 'On Hold') out.push('reopen');
  if (next.includes('Closed')) out.push('close');
  return out;
}

/** Today in Cairo as YYYY-MM-DD (holdUntil must be after it). */
export const cairoToday = (now: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// ── Error codes ──────────────────────────────────────────────────────────────
/** Domain code from the API (B3/B5/B6 codes reach the client). No message matching. */
export const jobErrorFromError = (error: unknown): DomainError | null => domainError(error);
/** The applications stage CAS conflict is `code: CONFLICT` + details.currentVersion (not a registry code). */
export function isStaleStage(error: unknown): boolean {
  const e = error as { code?: unknown; details?: { details?: { currentVersion?: unknown } } } | null;
  return e?.code === 'CONFLICT' && typeof e?.details?.details?.currentVersion === 'number';
}

export const errorMessage = (error: unknown, fallback: string) => {
  const d = jobErrorFromError(error);
  // The client replaces every 403 message with a generic one; the code says what happened.
  if (d?.code === 'JOB_NOT_OWNED') return JOB_NOT_OWNED_TEXT;
  if (d?.code === 'FILE_CLOSED') return d.message || 'This file is closed and does not move.';
  if (d?.message) return d.message;
  const m = (error as { message?: unknown })?.message;
  return typeof m === 'string' && m ? m : fallback;
};

// ── Reason lists (B3 master data, deactivate-only) ─────────────────────────────
/** = B3 JOB_REASON_CATEGORIES. Reopen has no list (free text). */
export const REASON_CATEGORY: Record<'hold' | 'close', 'hold-reasons' | 'close-reasons'> = { hold: 'hold-reasons', close: 'close-reasons' };
export const OTHER_REASON = 'Other';

/** GET /master-data/catalog/hold-reasons | close-reasons → active names only (inactive/archived = deleted). "Other" last. */
export async function jobReasons(action: 'hold' | 'close'): Promise<string[]> {
  const rows = await getApi<Array<{ name?: string; status?: string }> | { data: Array<{ name?: string; status?: string }> }>(`/master-data/catalog/${REASON_CATEGORY[action]}`);
  const arr = Array.isArray(rows) ? rows : rows?.data ?? [];
  const names = arr.filter((r) => r.name?.trim() && (r.status ?? 'Active') === 'Active').map((r) => r.name!.trim());
  return [...names.filter((n) => n.toLowerCase() !== 'other'), ...names.filter((n) => n.toLowerCase() === 'other')];
}
