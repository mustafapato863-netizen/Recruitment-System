/**
 * M2 adapters: Manager team work + reassign (Figma M02 / M06).
 *
 * Preferred: GET /team/work (coming, CoS) → TeamWorkApi below. When it is absent (404/405/501) we compose existing endpoints:
 * - GET /users/assignable                         → the people list, always (#21 B2-16: any signed-in user, the caller's own reports)
 * - GET /applications?primaryRecruiterId=:id      → each report's files (B5 list: stage, followUpDate, gates[], interview, positionTitle, vacancyBranchName)
 * - GET /offers?status=Pending Approval           → offers waiting on the Manager's decision (B7: the owner's manager decides)
 * Reassign is B7 (#15, feat/b7-manager-decision):
 * - POST /files/reassign {applicationIds? | fromUserId?, toUserId, reason} → {batchId, toUserId, moved[{applicationId, fromUserId}], unchanged[]}
 *   Codes: REASSIGN_ADMIN_FORBIDDEN 403, REASSIGN_NOT_MANAGER, REASSIGN_TARGET_INELIGIBLE, REASSIGN_FILE_CLOSED 409,
 *   REASSIGN_CONFLICT 409, REASSIGN_REASON_REQUIRED, REASSIGN_SCOPE, REASSIGN_FILE_NOT_FOUND. All-or-nothing.
 *   Jobs are not reassigned by B7 (files only); "Whole job" = that report's open files on the job.
 * The Manager's own pending scorecards come from GET /me/work (B4 items of type "scorecard").
 * Reassign reasons: GET /master-data/catalog/reassign-reasons when present (coming), free text otherwise.
 * Team work never shows pay: every read goes through stripPay().
 */
import { getApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { domainError } from './gates';
import { serverFormErrors } from '../forms/serverErrors';
import { blockingGate, cairoToday, type CardInterview, type FileGate } from './jobs';
import { fetchPeople, type Person } from './requisitions';
import { fetchMyWorkApi, type WorkItem } from './myWork';

const enc = encodeURIComponent;
const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
export const CLOSED_STAGES = ['Joined', 'Rejected', 'Withdrawn'] as const;

export interface RawTeamApp {
  id: string; applicationCode: string; vacancyId: string; stage: string; primaryRecruiterId?: string | null;
  followUpDate?: string | null; positionTitle?: string | null; vacancyBranchName?: string | null; vacancyLocation?: string | null;
  candidate?: { firstName?: string; lastName?: string } | null; gates?: FileGate[]; interview?: CardInterview | null; updatedAt?: string;
}
export interface TeamFile { id: string; code: string; candidate: string; vacancyId: string; job: string; site: string | null; stage: string; followUpDate: string | null; gates?: FileGate[]; interview?: CardInterview | null }
export type TaskTone = 'overdue' | 'today' | 'week' | 'waiting' | null;
export type TaskKind = 'followup-overdue' | 'gate' | 'offer' | 'followup' | 'interview' | 'next';
export interface TeamTask { fileId: string; kind: TaskKind; title: string; meta: string; tone: TaskTone }
export interface ReportWork { person: Person; files: TeamFile[]; tasks: TeamTask[]; open: number; overdue: number }
export interface WaitingOffer { offerId: string; versionId: string; versionNumber: number; applicationId: string; candidate: string; job: string; ownerName: string | null; submittedAt: string | null }
export interface WaitingScorecard { interviewId: string; applicationId: string | null; candidate: string; job: string | null; dueAt: string | null; overdue: boolean }
export interface TeamWork { reports: ReportWork[] | null; waiting: WaitingOffer[]; scorecards: WaitingScorecard[]; source: 'team-work' | 'composed' }

/** Typed adapter for the coming GET /team/work (shape from FRONTEND_GAP M2; every field optional so a partial server works). */
export interface TeamWorkApi {
  waitingOnYou?: Array<{
    type: 'offer' | 'scorecard' | string; offerId?: string; versionId?: string; versionNumber?: number; applicationId?: string;
    candidateName?: string; positionTitle?: string; ownerName?: string | null; submittedAt?: string | null; interviewId?: string; dueAt?: string | null;
  }>;
  reports: Array<{ user: { id: string; displayName?: string; name?: string; roleName?: string | null }; files: RawTeamApp[]; open?: number; overdue?: number }>;
}

const toFile = (a: RawTeamApp): TeamFile => ({
  id: a.id, code: a.applicationCode, vacancyId: a.vacancyId, stage: a.stage, followUpDate: a.followUpDate?.slice(0, 10) ?? null,
  candidate: `${a.candidate?.firstName ?? ''} ${a.candidate?.lastName ?? ''}`.trim() || a.applicationCode,
  job: a.positionTitle ?? 'Job', site: a.vacancyBranchName ?? a.vacancyLocation ?? null, gates: a.gates, interview: a.interview ?? null,
});

const GATE_TASK: Record<string, string> = { 'screen-note': 'Screen note missing', scorecard: 'Scorecard missing', 'offer-accepted': 'Offer not accepted yet', 'joining-checks': 'Joining checks open' };
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const cairoDay = (iso: string) => cairoToday(new Date(iso));

/** One task per file, most urgent first: overdue follow-up › blocked gate › offer waiting › follow-up today › interview › next step. */
export function taskFor(f: TeamFile, today = cairoToday()): TeamTask {
  const meta = [f.job, f.site].filter(Boolean).join(' · ');
  if (f.followUpDate && f.followUpDate < today) return { fileId: f.id, kind: 'followup-overdue', title: `Follow-up overdue — ${f.candidate}`, meta, tone: 'overdue' };
  const g = blockingGate({ stage: f.stage as never, gates: f.gates, interview: f.interview ?? undefined });
  if (g) return { fileId: f.id, kind: 'gate', title: `${GATE_TASK[g.gate] ?? 'Gate open'} — ${f.candidate}`, meta, tone: 'overdue' };
  if (f.stage === 'Offer') return { fileId: f.id, kind: 'offer', title: `Offer in progress — ${f.candidate}`, meta, tone: 'waiting' };
  if (f.followUpDate === today) return { fileId: f.id, kind: 'followup', title: `Follow up — ${f.candidate}`, meta, tone: 'today' };
  if (f.interview?.when === 'next') {
    const d = cairoDay(f.interview.startAt);
    return { fileId: f.id, kind: 'interview', title: `Interview — ${f.candidate}`, meta, tone: d === today ? 'today' : d <= addDays(today, 7) ? 'week' : null };
  }
  return { fileId: f.id, kind: 'next', title: `${f.stage} — ${f.candidate}`, meta, tone: f.followUpDate && f.followUpDate <= addDays(today, 7) ? 'week' : null };
}
const RANK: Record<string, number> = { overdue: 0, today: 1, waiting: 2, week: 3, null: 4 };

export async function fetchReportFiles(personId: string): Promise<TeamFile[]> {
  const rows = list(stripPay(await getApi<RawTeamApp[] | { data: RawTeamApp[] }>(`/applications?${new URLSearchParams({ primaryRecruiterId: personId, pageSize: '100' })}`)));
  // Defence-in-depth: only this person's open files, whatever the filter returned.
  return rows.filter((a) => (a.primaryRecruiterId ?? personId) === personId && !(CLOSED_STAGES as readonly string[]).includes(a.stage)).map(toFile);
}

type RawOffer = { id: string; applicationId: string; candidateName?: string; positionTitle?: string; status: string; currentVersionId?: string | null;
  currentVersion?: { id: string; versionNumber: number; status?: string; createdAt?: string } | null; versions?: Array<{ id: string; versionNumber: number; status?: string; createdAt?: string }> };
/** Offers in Pending Approval on my reports' files (the Manager decides, B7). */
export async function fetchWaitingOffers(owners: Map<string, string>): Promise<WaitingOffer[]> {
  let rows: RawOffer[];
  try { rows = list(stripPay(await getApi<RawOffer[] | { data: RawOffer[] }>(`/offers?${new URLSearchParams({ status: 'Pending Approval', pageSize: '100' })}`))); } catch { return []; }
  return rows.filter((o) => o.status === 'Pending Approval' && owners.has(o.applicationId)).map((o) => {
    const v = o.currentVersion ?? o.versions?.find((x) => x.id === o.currentVersionId) ?? [...(o.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    return { offerId: o.id, versionId: v?.id ?? '', versionNumber: v?.versionNumber ?? 1, applicationId: o.applicationId, candidate: o.candidateName ?? 'Candidate', job: o.positionTitle ?? 'Job', ownerName: owners.get(o.applicationId) ?? null, submittedAt: v?.createdAt ?? null };
  }).filter((w) => w.versionId);
}

const NOT_THERE = new Set([404, 405, 501]);
function buildReport(person: Person, files: TeamFile[], today: string, server?: { open?: number; overdue?: number }): ReportWork {
  const tasks = files.map((f) => taskFor(f, today)).sort((a, b) => RANK[String(a.tone)] - RANK[String(b.tone)]);
  return { person, files, tasks, open: server?.open ?? files.length, overdue: server?.overdue ?? files.filter((f) => f.followUpDate && f.followUpDate < today).length };
}
/** My own scorecards still to submit (I interviewed), from /me/work. Never fatal. */
export async function fetchMyScorecards(): Promise<WaitingScorecard[]> {
  try {
    const w = await fetchMyWorkApi('today');
    const items: Array<WorkItem & { _overdue?: boolean }> = [...w.overdue.map((i) => ({ ...i, _overdue: true })), ...w.dueToday];
    const seen = new Set<string>();
    return items.filter((i) => i.type === 'scorecard' && !seen.has(i.entity.id) && seen.add(i.entity.id)).map((i) => ({
      interviewId: i.entity.id, applicationId: i.applicationId ?? null, candidate: i.candidate?.name ?? i.title, job: i.reason || null, dueAt: i.dueAt, overdue: !!i._overdue,
    }));
  } catch { return []; }
}

export async function fetchTeamWork(): Promise<TeamWork> {
  const today = cairoToday();
  let api: TeamWorkApi | null = null;
  try { api = stripPay(await getApi<TeamWorkApi>('/team/work')); } catch (e) {
    if (!NOT_THERE.has((e as { statusCode?: number })?.statusCode ?? 0)) throw e;
  }
  if (api && Array.isArray(api.reports)) {
    // #21 (B2-16): the people list is GET /users/assignable (any signed-in user, the caller's own reports), so a
    // report with no open files still has a row and is a reassign target. /team/work supplies each person's files.
    const people = await fetchPeople();
    const byId = new Map(api.reports.map((r) => [r.user.id, r]));
    const roster: Person[] = people ?? api.reports.map((r) => ({ id: r.user.id, name: r.user.displayName ?? r.user.name ?? 'Unnamed', detail: r.user.roleName ?? undefined }));
    const reports = roster.map((person) => {
      const r = byId.get(person.id);
      return buildReport({ ...person, detail: person.detail ?? r?.user.roleName ?? undefined },
        (r?.files ?? []).filter((a) => !(CLOSED_STAGES as readonly string[]).includes(a.stage)).map(toFile), today, r);
    }).sort((a, b) => a.person.name.localeCompare(b.person.name));
    const items = api.waitingOnYou ?? [];
    const waiting = items.filter((w) => w.type === 'offer' && w.offerId && w.versionId).map((w) => ({
      offerId: w.offerId!, versionId: w.versionId!, versionNumber: w.versionNumber ?? 1, applicationId: w.applicationId ?? '', candidate: w.candidateName ?? 'Candidate', job: w.positionTitle ?? 'Job', ownerName: w.ownerName ?? null, submittedAt: w.submittedAt ?? null,
    }));
    const serverCards = items.filter((w) => w.type === 'scorecard' && w.interviewId).map((w) => ({
      interviewId: w.interviewId!, applicationId: w.applicationId ?? null, candidate: w.candidateName ?? 'Candidate', job: w.positionTitle ?? null, dueAt: w.dueAt ?? null, overdue: !!w.dueAt && w.dueAt.slice(0, 10) < today,
    }));
    return { reports, waiting, scorecards: serverCards.length ? serverCards : await fetchMyScorecards(), source: 'team-work' };
  }
  const people = await fetchPeople();
  if (!people) return { reports: null, waiting: [], scorecards: await fetchMyScorecards(), source: 'composed' };
  const reports = await Promise.all([...people].sort((a, b) => a.name.localeCompare(b.name)).map(async (person) => buildReport(person, await fetchReportFiles(person.id), today)));
  const owners = new Map<string, string>();
  for (const r of reports) for (const f of r.files) owners.set(f.id, r.person.name);
  const [waiting, scorecards] = await Promise.all([fetchWaitingOffers(owners), fetchMyScorecards()]);
  return { reports, waiting, scorecards, source: 'composed' };
}

/** Reassign reasons from master data when the list exists (coming); null → free text. Active names only. */
export async function fetchReassignReasons(): Promise<string[] | null> {
  try {
    const r = await getApi<Array<{ name?: string; status?: string }> | { data: Array<{ name?: string; status?: string }> }>('/master-data/catalog/reassign-reasons');
    const names = list(r).filter((x) => x.name?.trim() && (x.status ?? 'Active') === 'Active').map((x) => x.name!.trim());
    return names.length ? names : null;
  } catch { return null; }
}

/** = ReassignFilesDto: reason is a reassign-reasons list value; "Other" sends the free text in `note` (REASON_REQUIRED if < 3). */
export type ReassignBody = ({ applicationIds: string[] } | { fromUserId: string }) & { toUserId: string; reason: string; note?: string };
export interface ReassignResult { batchId: string; toUserId: string; moved: Array<{ applicationId: string; fromUserId: string | null }>; unchanged: string[] }
export const reassignFiles = (body: ReassignBody) => postApi<ReassignResult>('/files/reassign', body);

const REASSIGN_TEXT: Record<string, { field?: 'to' | 'reason' | 'what'; text: string }> = {
  REASSIGN_ADMIN_FORBIDDEN: { text: 'Administrators cannot reassign files.' },
  REASSIGN_NOT_MANAGER: { field: 'what', text: 'You can only move files owned by your direct reports.' },
  REASSIGN_TARGET_INELIGIBLE: { field: 'to', text: 'That person cannot own files (inactive or an administrator).' },
  REASSIGN_FILE_CLOSED: { field: 'what', text: 'A closed file (Joined, Rejected or Withdrawn) cannot move. Nothing was moved.' },
  REASSIGN_CONFLICT: { text: 'A file changed while reassigning; nothing was moved. Reload and try again.' },
  REASSIGN_REASON_REQUIRED: { field: 'reason', text: 'A reason is required.' },
  REASSIGN_SCOPE: { field: 'what', text: 'Pick a file, a job or a person to move.' },
  REASSIGN_FILE_NOT_FOUND: { field: 'what', text: 'That file no longer exists or is not visible to you.' },
  REASON_NOT_IN_LIST: { field: 'reason', text: 'Pick a reason from the Reassign reasons list.' },
  REASON_REQUIRED: { field: 'reason', text: '"Other" needs a short note (at least 3 characters).' },
};
/** Codes first (B7 passes them through), else the server message. */
export function reassignError(e: unknown): { field?: 'to' | 'reason' | 'what'; text: string; code?: string } {
  // #23: a 400's field/fields name the body path (toUserId, reason, applicationIds…): put it on that input.
  const f = serverFormErrors(e);
  const API: Record<string, 'to' | 'reason' | 'what'> = { toUserId: 'to', reason: 'reason', note: 'reason', applicationIds: 'what', fromUserId: 'what' };
  const hit = Object.keys(f.byField).find((k) => API[k.split('.')[0]]);
  if (hit) return { field: API[hit.split('.')[0]], text: f.byField[hit], ...(f.code ? { code: f.code } : {}) };
  const d = domainError(e);
  if (d && REASSIGN_TEXT[d.code]) return { ...REASSIGN_TEXT[d.code], code: d.code };
  const x = e as { statusCode?: number; message?: string } | null;
  if (x?.statusCode === 403) return { text: 'You do not have permission to reassign these files.' };
  return { text: x?.message || 'Something went wrong. Try again.' };
}

export const fileHref = (id: string) => `/applications/${enc(id)}`;
