/**
 * E3 adapters: Open jobs (E08), Job pipeline (E09) and job status (E12).
 *
 * Contracts mirrored:
 * - B3 (`feat/b3-req-job-lifecycle`, base of #9): job statuses Open | On Hold | Partially Filled | Filled | Closed,
 *   POST /vacancies/:id/hold|reopen|close {reason} (JobStatusReasonDto, min 3 chars), GET /vacancies/:id/status-history.
 * - B4 (#9): JobWorkQueueItem (GET /vacancies/work-queue) and Vacancy.targetChip (dueDate, "X of Y").
 * - B1 (#4): another owner's job comes back redacted: {id, redacted: true, title, site{id,name}, seats{filled,target}}.
 * - Applications: GET /applications?vacancyId= (Application with allowedTransitions), PATCH /applications/:id/stage.
 *
 * The API error filter collapses domain codes to VALIDATION_ERROR/FORBIDDEN/CONFLICT but keeps the message,
 * so jobErrorFromError() maps the exact B3/B1/applications messages back to their codes (flagged for Backend).
 * Nothing here carries pay; every response goes through stripPay() anyway.
 */
import { getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { gateFromError, type DomainError } from './gates';
import type { FileStage } from './applicationFile';

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
}

/** = vacancyStatusHistory select in getVacancyStatusHistory (B3). */
export interface JobStatusHistoryItem { id: string; fromStatus: string | null; toStatus: string; reason: string | null; changedById: string | null; createdAt: string }

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
  candidate?: { id: string; firstName?: string; lastName?: string; currentTitle?: string | null } | null;
}

// ── Open jobs (E08) ──────────────────────────────────────────────────────────
export interface MyJobRow {
  id: string; code: string; title: string; status: JobStatus;
  site: string | null; siteId: string | null; department: string | null; ownerName: string | null;
  seats: { filled: number; target: number }; dueDate: string | null;
  pipelineCounts: Record<string, number>; active: number;
}
export interface OtherJobRow { id: string; title: string; site: string | null; seats: { filled: number; target: number } }
export interface OpenJobs { mine: MyJobRow[]; others: OtherJobRow[] }

const ACTIVE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];
type ListItem = JobDetail | RedactedJob;

/**
 * Mine = I am the active PRIMARY owner. Everyone else's jobs render as title/site/seats only,
 * whether #4 already redacted them or not (client-side redaction until #4 lands).
 */
export async function fetchOpenJobs(meId: string): Promise<OpenJobs> {
  const [queue, list] = await Promise.all([
    getApi<{ data: Array<JobWorkQueueItem | RedactedJob> }>('/vacancies/work-queue?pageSize=100'),
    getApi<ListItem[] | { data: ListItem[] }>('/vacancies').catch(() => [] as ListItem[]),
  ]);
  const listArr = stripPay(Array.isArray(list) ? list : list?.data ?? []);
  const detailById = new Map(listArr.filter((v): v is JobDetail => !isRedactedJob(v)).map((v) => [v.id, v]));
  const mine: MyJobRow[] = [];
  const others: OtherJobRow[] = [];
  for (const raw of stripPay(queue?.data ?? [])) {
    if (isRedactedJob(raw)) { others.push({ id: raw.id, title: raw.title, site: raw.site?.name ?? null, seats: raw.seats }); continue; }
    const seats = { filled: raw.headcount.joined, target: raw.headcount.approved };
    if (raw.owner?.id !== meId) { others.push({ id: raw.id, title: raw.title, site: raw.branch?.name ?? null, seats }); continue; }
    const d = detailById.get(raw.id);
    const counts = raw.pipelineCounts ?? {};
    mine.push({
      id: raw.id, code: raw.code, title: raw.title, status: raw.status,
      site: raw.branch?.name ?? null, siteId: raw.branch?.id ?? null, department: d?.department ?? null, ownerName: raw.owner?.displayName ?? null,
      seats, dueDate: d?.targetChip?.dueDate ?? null, pipelineCounts: counts,
      active: ACTIVE_STAGES.reduce((n, s) => n + (counts[s] ?? 0), 0),
    });
  }
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

// ── Job status (E12, B3) ─────────────────────────────────────────────────────
export type JobAction = 'hold' | 'reopen' | 'close';
export const changeJobStatus = (id: string, action: JobAction, reason: string) =>
  postApi<JobDetail>(`/vacancies/${enc(id)}/${action}`, { reason: reason.trim() }).then((v) => stripPay(v));
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

// ── Error codes (B3 + B1 + applications) ─────────────────────────────────────
export type JobDomainCode =
  | 'REASON_REQUIRED' | 'ILLEGAL_JOB_TRANSITION' | 'NOT_JOB_OWNER' | 'ADMIN_CANNOT_CHANGE_JOB_STATUS'
  | 'JOB_NOT_ACCEPTING_APPLICATIONS' | 'REQUISITION_CANCELLED' | 'APPLICATION_EXISTS' | 'CANDIDATE_DUPLICATE'
  | 'CONTACT_REQUIRED' | 'STALE_STAGE' | 'JOB_NOT_OWNED';

const JOB_BY_MESSAGE: Array<[RegExp, JobDomainCode]> = [
  [/^A reason is required/, 'REASON_REQUIRED'],
  [/^(A job cannot move from|Only a held job can be reopened|Job is already )/, 'ILLEGAL_JOB_TRANSITION'],
  [/^Only the job owner or their manager can/, 'NOT_JOB_OWNER'],
  [/^An administrator cannot hold, reopen or close a job/, 'ADMIN_CANNOT_CHANGE_JOB_STATUS'],
  [/accepts no new applications\.$/, 'JOB_NOT_ACCEPTING_APPLICATIONS'],
  [/is Cancelled and cannot be activated\.$/, 'REQUISITION_CANCELLED'],
  [/has already applied to vacancy/, 'APPLICATION_EXISTS'],
  [/^A candidate with the same email or phone already exists/, 'CANDIDATE_DUPLICATE'],
  [/^Provide an email or a phone\.$/, 'CONTACT_REQUIRED'],
  [/^This application changed before the stage update could be saved\./, 'STALE_STAGE'],
];

export type AnyDomainError = DomainError | { code: JobDomainCode; message: string };

export function jobErrorFromError(error: unknown): AnyDomainError | null {
  const gate = gateFromError(error);
  if (gate) return gate;
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  const details = (e.details && typeof e.details === 'object' ? e.details : {}) as { code?: unknown; message?: unknown };
  const raw = typeof e.code === 'string' ? e.code : typeof details.code === 'string' ? details.code : undefined;
  const message = (typeof details.message === 'string' ? details.message : typeof e.message === 'string' ? e.message : '').trim();
  if (raw && JOB_BY_MESSAGE.some(([, c]) => c === raw)) return { code: raw as JobDomainCode, message };
  const hit = JOB_BY_MESSAGE.find(([re]) => re.test(message));
  return hit ? { code: hit[1], message } : null;
}

export const errorMessage = (error: unknown, fallback: string) => {
  const d = jobErrorFromError(error);
  if (d?.message) return d.message;
  const m = (error as { message?: unknown })?.message;
  return typeof m === 'string' && m ? m : fallback;
};

// ── Reason presets (client today; master data when Backend adds the categories) ──
export const CLIENT_REASON_PRESETS: Record<JobAction, string[]> = {
  hold: ['Hiring manager unavailable — interviews paused', 'Budget review', 'Role being redefined'],
  reopen: ['Hiring manager back', 'Budget confirmed', 'Role confirmed'],
  close: ['Position no longer needed', 'Filled internally', 'Budget withdrawn'],
};
/** Proposed master-data categories (not yet in Backend). */
export const REASON_CATEGORY: Record<JobAction, string> = { hold: 'job-hold-reasons', reopen: 'job-reopen-reasons', close: 'job-close-reasons' };

/**
 * Uses GET /master-data/catalog/:category when it exists and has active values;
 * falls back to the client presets on 404/empty/error. Returns the source for transparency.
 */
export async function jobReasonPresets(action: JobAction): Promise<{ source: 'master-data' | 'client'; reasons: string[] }> {
  try {
    const rows = await getApi<Array<{ name?: string; status?: string }> | { data: Array<{ name?: string; status?: string }> }>(`/master-data/catalog/${REASON_CATEGORY[action]}`);
    const arr = Array.isArray(rows) ? rows : rows?.data ?? [];
    const reasons = arr.filter((r) => r.name?.trim() && r.status !== 'Inactive' && r.status !== 'Archived').map((r) => r.name!.trim());
    if (reasons.length) return { source: 'master-data', reasons };
  } catch { /* category not there yet */ }
  return { source: 'client', reasons: CLIENT_REASON_PRESETS[action] };
}
