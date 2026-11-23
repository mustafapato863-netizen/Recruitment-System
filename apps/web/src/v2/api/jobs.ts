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
import { fetchAllPages } from './paged';
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
  requiredSkills?: string[];
  minExperienceYears?: number | null;
  qualifications?: string | null;
  location?: string | null;
  jdCriteria?: unknown;
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
  /** Latest non-withdrawn offer on the applications list. Absent on older payloads. */
  offerStatus?: string | null;
  /** Latest offer version was sent back for changes. */
  offerSentBack?: boolean;
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

export type CardDrawer = 'screen' | 'schedule' | 'scorecard' | 'offer' | 'waiting' | 'send' | 'answer' | 'prehire';

type NextActionApp = {
  stage: string;
  gates?: FileGate[] | null;
  interview?: CardInterview | null;
  offerStatus?: string | null;
  offerSentBack?: boolean;
};

/** Statuses that already have an offer in flight. Draft stays on the stage's own next step until the file is in Offer. */
const OFFER_LEADS = new Set(['Pending Approval', 'Approved', 'Sent', 'Accepted', 'Changes Requested', 'Expired', 'Withdrawn']);

/** Next step for an offer that already exists. Sent is checked before the accepted gate so a sent offer stays "Record answer". */
export function offerWorkflow(app: NextActionApp): { key: CardDrawer; label: string } | null {
  const status = app.offerStatus ?? null;
  if (app.offerSentBack || status === 'Changes Requested') return { key: 'offer', label: 'Revise and resubmit' };
  if (status === 'Pending Approval') return { key: 'waiting', label: 'View approval' };
  if (status === 'Approved') return { key: 'send', label: 'Send offer' };
  if (status === 'Sent') return { key: 'answer', label: 'Record answer' };
  if (status === 'Withdrawn' && !isClosedStage(app.stage)) return { key: 'answer', label: 'Finish withdrawal' };
  const accepted = Boolean(app.gates?.some((row) => row.gate === 'offer-accepted' && row.met) || status === 'Accepted');
  if (accepted) return { key: 'prehire', label: 'Move to Pre-hire' };
  if (status === 'Expired') return { key: 'offer', label: 'New offer version' };
  if (status === 'Draft') return { key: 'waiting', label: 'Submit for approval' };
  return null;
}

/** The file drawer this card should open, from the stage, gates, interview, and offer the board already loaded. */
export function cardNextAction(app: NextActionApp): { key: CardDrawer; label: string } | null {
  if (isClosedStage(app.stage)) return null;
  const offerLeads = Boolean(app.offerSentBack || (app.offerStatus && OFFER_LEADS.has(app.offerStatus)));
  if (offerLeads && app.stage !== 'Pre-Hire') return offerWorkflow(app);
  const unmet = (gate: GateKey) => !app.gates?.some((row) => row.gate === gate && row.met);
  switch (app.stage) {
    case 'Applied':
    case 'Screening':
      return unmet('screen-note') ? { key: 'screen', label: 'Log screen' } : { key: 'schedule', label: 'Schedule interview' };
    case 'Interview':
      if (app.interview?.when !== 'last') return { key: 'schedule', label: 'Schedule interview' };
      return unmet('scorecard') ? { key: 'scorecard', label: 'Open scorecard' } : { key: 'offer', label: 'Draft offer' };
    case 'Offer':
      return offerWorkflow(app) ?? (app.offerStatus ? null : { key: 'offer', label: 'Draft offer' });
    case 'Pre-Hire':
      return { key: 'prehire', label: 'Pre-hire checklist' };
    default:
      return null;
  }
}

export function cardFileHref(app: Pick<BoardApplication, 'id' | 'stage' | 'gates' | 'interview'>): string {
  const file = `/applications/${encodeURIComponent(app.id)}`;
  const next = cardNextAction(app);
  return next ? `${file}?drawer=${next.key}` : file;
}

// ── Open jobs (E08) ──────────────────────────────────────────────────────────
export interface MyJobRow {
  id: string; code: string; title: string; status: JobStatus;
  site: string | null; siteId: string | null; department: string | null; ownerName: string | null;
  seats: { filled: number; target: number }; dueDate: string | null; holdUntil: string | null;
  pipelineCounts: Record<string, number>; active: number;
  /** Files that need a recruiter step. Separate from `active`, which is the open-stage total. */
  needsAction?: number;
  /** Work-queue health reason, when the row is not simply on track. */
  attention?: string | null;
}
/** `full`: the server sent the whole job (#23 603d44d: a manager sees their reports' jobs), so it links to the board. */
export interface OtherJobRow { id: string; title: string; site: string | null; seats: { filled: number; target: number }; full?: boolean; ownerName?: string | null; status?: JobStatus; department?: string | null; active?: number; dueDate?: string | null }
export interface OpenJobs { mine: MyJobRow[]; others: OtherJobRow[]; othersError?: string | null }

const ACTIVE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];

/**
 * Mine = GET /vacancies/work-queue?mine=true (jobs I own as primaryRecruiterId or an active PRIMARY assignment; ANDed with scope).
 * Others = the scoped queue minus mine. Unredacted report jobs keep full: true and may open the board.
 * A failed team fetch is othersError, not an empty team list. Redacted teammate rows stay title/site/seats.
 */
export async function fetchOpenJobs(): Promise<OpenJobs> {
  // B2-22 / B2R: the work queue caps pageSize at 100 (400 field=pageSize), so page through it.
  let othersError: string | null = null;
  const [mineData, allData] = await Promise.all([
    fetchAllPages<JobWorkQueueItem | RedactedJob>('/vacancies/work-queue?mine=true'),
    fetchAllPages<JobWorkQueueItem | RedactedJob>('/vacancies/work-queue').catch((e: { message?: string }) => {
      othersError = e?.message || 'Could not load team jobs.';
      return [] as Array<JobWorkQueueItem | RedactedJob>;
    }),
  ]);
  const mine: MyJobRow[] = [];
  for (const raw of stripPay(mineData ?? [])) {
    if (isRedactedJob(raw)) continue;
    const counts = raw.pipelineCounts ?? {};
    mine.push({
      id: raw.id, code: raw.code, title: raw.title, status: raw.status,
      site: raw.branch?.name ?? null, siteId: raw.branch?.id ?? null, department: raw.department ?? null, ownerName: raw.owner?.displayName ?? null,
      seats: { filled: raw.headcount.joined, target: raw.headcount.approved }, dueDate: raw.dueDate ?? null, holdUntil: raw.holdUntil ?? null,
      pipelineCounts: counts, active: ACTIVE_STAGES.reduce((n, s) => n + (counts[s] ?? 0), 0),
      needsAction: raw.needsActionCount ?? 0,
      attention: raw.health?.reason ?? null,
    });
  }
  const mineIds = new Set(mine.map((m) => m.id));
  const others: OtherJobRow[] = stripPay(allData ?? []).filter((raw) => !mineIds.has(raw.id)).map((raw) => (isRedactedJob(raw)
    ? { id: raw.id, title: raw.title, site: raw.site?.name ?? null, seats: raw.seats }
    : { id: raw.id, title: raw.title, site: raw.branch?.name ?? null, seats: { filled: raw.headcount.joined, target: raw.headcount.approved }, full: true, ownerName: raw.owner?.displayName ?? null,
      status: raw.status, department: raw.department ?? null, active: raw.pipelineCounts ? ACTIVE_STAGES.reduce((n, stage) => n + (raw.pipelineCounts[stage] ?? 0), 0) : undefined, dueDate: raw.dueDate ?? null }));
  mine.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
  return othersError ? { mine, others, othersError } : { mine, others };
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

export async function loadVacancyApplications(id: string): Promise<BoardApplication[]> {
  const first = await getApi<{ data?: BoardApplication[]; total?: number; meta?: { total?: number } } | BoardApplication[]>(`/applications?vacancyId=${enc(id)}&pageSize=100`);
  if (Array.isArray(first)) return stripPay(first);
  const rows = [...(first?.data ?? [])];
  const total = first?.total ?? first?.meta?.total ?? rows.length;
  for (let page = 2; rows.length < total && (first?.data?.length ?? 0) >= 100 && page <= 100; page += 1) {
    const next = await getApi<{ data?: BoardApplication[] } | BoardApplication[]>(`/applications?vacancyId=${enc(id)}&page=${page}&pageSize=100`);
    const pageRows = Array.isArray(next) ? next : next?.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return stripPay(rows);
}

export async function loadJobBoard(id: string): Promise<JobBoard> {
  const job = stripPay(await getApi<JobDetail | RedactedJob>(`/vacancies/${enc(id)}`));
  if (!job || typeof job !== 'object' || Array.isArray(job) || !job.id) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (isRedactedJob(job)) return { job, apps: [], closed: { rejected: 0, joined: 0, withdrawn: 0 } };
  const all = await loadVacancyApplications(id);
  void all;
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
  const all = await loadVacancyApplications(id);
  return (all ?? []).filter((a) => ['Joined', 'Rejected', 'Withdrawn'].includes(a.stage));
};

/** Candidates visible for this job, in list order, so the file can open the next person in the same filter. */
export interface PipelineSourceSet {
  vacancyId: string;
  applicationIds: string[];
  returnHref: string;
}

const PIPELINE_SOURCE_KEY = 'rf2:pipeline-source-set';

export function savePipelineSourceSet(set: PipelineSourceSet): void {
  try {
    sessionStorage.setItem(PIPELINE_SOURCE_KEY, JSON.stringify({
      vacancyId: set.vacancyId,
      applicationIds: set.applicationIds.filter(Boolean),
      returnHref: set.returnHref,
    }));
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export function readPipelineSourceSet(returnHref?: string | null): PipelineSourceSet | null {
  try {
    const raw = sessionStorage.getItem(PIPELINE_SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PipelineSourceSet>;
    if (!parsed || typeof parsed.vacancyId !== 'string' || !Array.isArray(parsed.applicationIds) || typeof parsed.returnHref !== 'string') {
      return null;
    }
    if (returnHref && parsed.returnHref !== returnHref) return null;
    return {
      vacancyId: parsed.vacancyId,
      applicationIds: parsed.applicationIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
      returnHref: parsed.returnHref,
    };
  } catch {
    return null;
  }
}

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

/** A forward column the gate still blocks. The stage stays; the card's next action opens instead. */
export function gateRefusesMove(app: BoardApplication, target: BoardStage, job: JobDetail | RedactedJob): boolean {
  if (!moveCheck(app, target, job).ok) return false;
  const from = BOARD_STAGES.indexOf(app.stage as BoardStage);
  return BOARD_STAGES.indexOf(target) > from && Boolean(blockingGate(app));
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
/** #23 NEW-3: an Admin's hold/reopen/close answers 403 ADMIN_CANNOT_CHANGE_JOB_STATUS; Admins use the logged override (B9). */
export const ADMIN_STATUS_TEXT = 'An administrator can’t hold, reopen or close a job here. Use Admin override (Reports → Open jobs) instead; it is logged.';

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
  if (d?.code === 'ADMIN_CANNOT_CHANGE_JOB_STATUS') return ADMIN_STATUS_TEXT;
  if (d?.code === 'FILE_CLOSED') return d.message || 'This file is closed and does not move.';
  if (d?.code === 'JOB_HAS_OPEN_APPLICATIONS') {
    const x = error as { counts?: { openApplications?: number }; details?: { counts?: { openApplications?: number } } };
    const n = x?.counts?.openApplications ?? x?.details?.counts?.openApplications;
    return typeof n === 'number' ? `This job still has ${n} open file${n === 1 ? '' : 's'}. Close or move them first.` : d.message || 'This job still has open files. Close or move them first.';
  }
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
