/**
 * A4 Reports + Audit, A5 Integrations + Admin override (Admin seat).
 * - Open jobs: GET /vacancies/work-queue (org-wide for Admin; redacted rows kept as title/site/seats).
 * - Offers waiting: GET /offers?status=Pending Approval (never pay; stripPay).
 * - Stage counts: B8 GET /reports/overview?from&to → funnel[] (counts only; no time-in-stage median on the API).
 * - Hiring report by team: B8 GET /results/org?month&managerId= per manager (ADMINISTRATOR only), tooFewToJudge from the server.
 * - Audit (CoS): server-side GET /audit?actor&entity&from&to&page&pageSize (C5, admin-only, pageSize ≤ 100) when present;
 *   else GET /audit-logs?page&pageSize=100 with the client-side filters. Read-only.
 * - Every list call stays at pageSize ≤ 100 (B2-22) and pages through fetchAllPages.
 * - Integrations: B9 — only careers_site and smtp (others hidden / 404). GET /integrations, POST /integrations/:id/test.
 * - Override: B9 POST /admin/overrides {action, entityId, reason}; actions job.hold | job.reopen | job.close; reason ≥ 10;
 *   CoS: also sends the B3 list reason (statusReason, + statusNote for "Other") and holdUntil when the B3 lists exist.
 *   400 OVERRIDE_REASON_REQUIRED / OVERRIDE_NOT_ALLOWED, 409 wrong state (OVERRIDE_NOT_ALLOWED), 403 non-admin.
 */
import { override403Text } from './overrideErrors';
import { serverFormErrors } from '../forms/serverErrors';
import { getApi, postApi } from '../../api/client';
import { fetchAllPages } from '../api/paged';
import { stripPay } from '../api/paySafety';
import { domainError } from '../api/gates';
import { isRedactedJob, type JobStatus, type JobWorkQueueItem, type RedactedJob } from '../api/jobs';
import { TILE_KEYS } from '../api/teamResult';
import type { ResultTile, ResultsResponse, TileKey } from '../api/myResult';

const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
const enc = encodeURIComponent;
const ACTIVE = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'];

export interface OrgJob { id: string; title: string; site: string | null; owner: string | null; status: JobStatus | null; seats: { filled: number; target: number }; dueDate: string | null; active: number | null; redacted: boolean }
export async function fetchOrgJobs(): Promise<OrgJob[]> {
  const r = stripPay(await fetchAllPages<JobWorkQueueItem | RedactedJob>('/vacancies/work-queue'));
  return r.map((j) => (isRedactedJob(j)
    ? { id: j.id, title: j.title, site: j.site?.name ?? null, owner: null, status: null, seats: j.seats, dueDate: null, active: null, redacted: true }
    : { id: j.id, title: j.title, site: j.branch?.name ?? null, owner: j.owner?.displayName ?? null, status: j.status, seats: { filled: j.headcount.joined, target: j.headcount.approved }, dueDate: j.dueDate ?? null,
        active: ACTIVE.reduce((n, s) => n + (j.pipelineCounts?.[s] ?? 0), 0), redacted: false }))
    .filter((j) => j.status !== 'Closed' && j.status !== 'Filled');
}

export interface WaitingOfferRow { id: string; candidate: string; job: string; version: number; submittedAt: string | null; approver: string | null }
type Person = { id?: string | null; name?: string | null; displayName?: string | null } | null | undefined;
const isRoleCode = (n: string) => /^[A-Z][A-Z0-9_]+$/.test(n.trim());
/** CoS: name the approver when the API sends one (approver / approvers[] / approvals[].approver); never a role code. */
export function approverName(o: { approver?: Person; approvers?: Person[]; approvals?: Array<{ status?: string; approver?: Person; approverName?: string | null }> }): string | null {
  const people: Person[] = [o.approver, ...(o.approvers ?? []), ...(o.approvals ?? []).filter((a) => !a.status || a.status === 'Pending').map((a) => a.approver ?? (a.approverName ? { name: a.approverName } : null))];
  const names = [...new Set(people.map((p) => (p?.name ?? p?.displayName ?? '').trim()).filter((n) => n && !isRoleCode(n)))];
  return names.length ? names.join(', ') : null;
}
export async function fetchOffersWaiting(): Promise<WaitingOfferRow[]> {
  type V = { id: string; versionNumber: number; createdAt?: string | null };
  type Raw = { id: string; status?: string; candidateName?: string; positionTitle?: string; currentVersionId?: string | null; currentVersion?: V | null; versions?: V[] } & Parameters<typeof approverName>[0];
  const rows = stripPay(await fetchAllPages<Raw>(`/offers?${new URLSearchParams({ status: 'Pending Approval' })}`));
  return rows.filter((o) => !o.status || o.status === 'Pending Approval').map((o) => {
    const v = o.currentVersion ?? o.versions?.find((x) => x.id === o.currentVersionId) ?? [...(o.versions ?? [])].sort((x, y) => y.versionNumber - x.versionNumber)[0];
    return { id: o.id, candidate: o.candidateName ?? 'Candidate', job: o.positionTitle ?? 'Job', version: v?.versionNumber ?? 1, submittedAt: v?.createdAt ?? null, approver: approverName(o) };
  });
}

export interface StageCount { name: string; count: number }
export async function fetchStageCounts(month: string): Promise<StageCount[] | null> {
  const from = `${month}-01`; const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  try {
    const o = await getApi<{ funnel?: Array<{ name: string; count: number }> }>(`/reports/overview?from=${from}&to=${d.toISOString().slice(0, 10)}`);
    return (o.funnel ?? []).map((f) => ({ name: f.name, count: f.count }));
  } catch { return null; }
}

export interface TeamReportRow { managerId: string; managerName: string; team: string | null; people: number; tiles: Record<TileKey, ResultTile> }
/** One B8 /results/org call per manager with direct reports. null = results not on this server. */
export async function fetchTeamReport(month: string, managers: Array<{ id: string; name: string; team: string | null }>): Promise<TeamReportRow[] | null> {
  const out: TeamReportRow[] = [];
  for (const m of managers) {
    try {
      const r = await getApi<ResultsResponse>(`/results/org?month=${month}&managerId=${enc(m.id)}`);
      if (!r?.tiles || !TILE_KEYS.every((k) => r.tiles[k])) continue;
      out.push({ managerId: m.id, managerName: m.name, team: m.team, people: r.people?.length ?? 0, tiles: r.tiles });
    } catch (e) {
      const s = (e as { statusCode?: number })?.statusCode;
      if (s === 404 && out.length === 0) return null;
      if (s !== 403 && s !== 400) throw e;
    }
  }
  return out;
}

/**
 * B2F-12: audit text (reason) can carry raw user ids, e.g. FILE_REASSIGN "<from> -> <to>: Owner leaving".
 * Show names: every UUID that is a known user becomes their name; "->" reads as "→". Unknown ids stay short.
 */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
export function namedAuditText(text: string | null | undefined, names: ReadonlyMap<string, string>): string {
  if (!text) return '';
  return text.replace(UUID, (id) => names.get(id.toLowerCase()) ?? names.get(id) ?? `${id.slice(0, 8)}…`).replace(/\s*->\s*/g, ' → ');
}
export interface AuditEntry { id: string; actorUserId: string | null; actorDisplayName?: string; action: string; entityType: string; entityId: string; result: string; reason: string | null; createdAt: string }
export interface AuditQuery { from?: string; to?: string; actor?: string; entity?: string; page?: number }
export interface AuditPage { rows: AuditEntry[]; total: number; page: number; pageSize: number; server: boolean }
export const AUDIT_PAGE_SIZE = 100;
/**
 * CoS: server-side filters + pagination via C5 GET /audit when it exists; on 404/405 (not deployed) fall back to /audit-logs
 * (page of 100, filters applied client-side by the page). `server` tells the page which mode it got.
 */
export async function fetchAudit(q: AuditQuery = {}): Promise<AuditPage> {
  const page = q.page ?? 1;
  type R = { data: AuditEntry[]; total?: number; meta?: { total?: number } } | AuditEntry[];
  const shape = (r: R, server: boolean): AuditPage => {
    const rows = list(r);
    return { rows, total: Array.isArray(r) ? rows.length : r.total ?? r.meta?.total ?? rows.length, page, pageSize: AUDIT_PAGE_SIZE, server };
  };
  const p = new URLSearchParams({ page: String(page), pageSize: String(AUDIT_PAGE_SIZE) });
  for (const k of ['from', 'to', 'actor', 'entity'] as const) if (q[k]) p.set(k, q[k]!);
  try { return shape(await getApi<R>(`/audit?${p}`), true); }
  catch (e) { const s = (e as { statusCode?: number })?.statusCode; if (s !== 404 && s !== 405 && s !== 501) throw e; }
  return shape(await getApi<R>(`/audit-logs?page=${page}&pageSize=${AUDIT_PAGE_SIZE}`), false);
}
/** Area chip from the entity type / action (Figma A09 areas). */
export function auditArea(e: Pick<AuditEntry, 'entityType' | 'action'>): string {
  const t = `${e.entityType} ${e.action}`.toLowerCase();
  if (t.includes('override')) return 'Override';
  if (t.includes('interview') || t.includes('scorecard')) return 'Interview';
  if (t.includes('offer')) return 'Offer';
  if (t.includes('screen')) return 'Screening';
  if (t.includes('reject') || t.includes('withdraw')) return 'Exit';
  if (t.includes('vacancy_request') || t.includes('requisition')) return 'Requisition';
  if (t.includes('vacancy') || t.includes('job')) return 'Job';
  if (t.includes('application') || t.includes('file')) return 'File';
  if (t.includes('user') || t.includes('role') || t.includes('permission')) return 'Users';
  if (t.includes('master') || t.includes('template') || t.includes('pipeline') || t.includes('integration') || t.includes('grade')) return 'Settings';
  return 'Other';
}
/** "APPLICATION_STAGE_MOVE" → "Application stage move". */
export const humanize = (code: string) => { const s = code.replace(/[_.]+/g, ' ').trim().toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

export function toCsv(head: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (v: string | number | null | undefined) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s; };
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface Integration { id: string; name: string; provider: string; category: string; status: string; lastSyncAt?: string | null }
export const ALLOWED_PROVIDERS = ['careers_site', 'smtp'] as const;
export async function fetchIntegrations(): Promise<Integration[]> {
  return list(await getApi<Integration[] | { data: Integration[] }>('/integrations')).filter((i) => (ALLOWED_PROVIDERS as readonly string[]).includes(i.provider));
}
export const testIntegration = (id: string) => postApi<{ success?: boolean; ok?: boolean; message?: string; status?: string }>(`/integrations/${enc(id)}/test`);

export type OverrideAction = 'job.hold' | 'job.reopen' | 'job.close';
export const OVERRIDE_FROM: Record<OverrideAction, readonly string[]> = {
  'job.hold': ['Open', 'Partially Filled'], 'job.reopen': ['On Hold'], 'job.close': ['Open', 'On Hold', 'Partially Filled', 'Filled'],
};
export const OVERRIDE_LABEL: Record<OverrideAction, string> = { 'job.hold': 'Put on hold', 'job.reopen': 'Reopen', 'job.close': 'Close job' };
export const overridesFor = (status: string | null) => (Object.keys(OVERRIDE_FROM) as OverrideAction[]).filter((a) => !!status && OVERRIDE_FROM[a].includes(status));
export const OVERRIDE_MIN_REASON = 10;
/** B3 extras on hold/close, sent only when the lists exist (B9 TODO(B3) routes them through the job lifecycle). */
export interface OverrideExtras { statusReason?: string; statusNote?: string; holdUntil?: string }
export const postOverride = (action: OverrideAction, entityId: string, reason: string, extras: OverrideExtras = {}) => {
  const body: Record<string, string> = { action, entityId, reason };
  if (action !== 'job.reopen' && extras.statusReason) body.statusReason = extras.statusReason;
  if (action !== 'job.reopen' && extras.statusNote?.trim()) body.statusNote = extras.statusNote.trim();
  if (action === 'job.hold' && extras.holdUntil) body.holdUntil = extras.holdUntil;
  return postApi<{ action: string; entityId: string; from: string; to: string; reason: string }>('/admin/overrides', body);
};
type OverrideField = 'reason' | 'statusReason' | 'holdUntil' | 'statusNote' | 'action';
const OVERRIDE_FIELD: Record<string, OverrideField> = { reason: 'reason', statusReason: 'statusReason', statusNote: 'statusNote', note: 'statusNote', holdUntil: 'holdUntil', action: 'action' };
export function overrideError(e: unknown): { field?: OverrideField; text: string } {
  // #23: a 400's field/fields name the body path; show it on that input.
  const f = serverFormErrors(e);
  const hit = Object.keys(f.byField).find((k) => OVERRIDE_FIELD[k]);
  if (hit) return { field: OVERRIDE_FIELD[hit], text: f.byField[hit] };
  const d = domainError(e); const s = (e as { statusCode?: number })?.statusCode;
  // #21: "Other" from a reason list needs a short note (400 REASON_REQUIRED).
  if (d?.code === 'REASON_REQUIRED') return { field: 'statusNote', text: d.message || '"Other" needs a short note.' };
  if (d?.code === 'OVERRIDE_REASON_REQUIRED') return { field: 'reason', text: `An override needs a reason (at least ${OVERRIDE_MIN_REASON} characters).` };
  if (d?.code === 'OVERRIDE_NOT_ALLOWED') return { text: d.message || 'That override is not allowed for this job now.' };
  if (d?.code === 'REASON_NOT_IN_LIST') return { field: 'statusReason', text: 'Pick a reason from the list.' };
  if (d?.code === 'HOLD_UNTIL_NOT_FUTURE') return { field: 'holdUntil', text: 'Pick a day after today (Cairo).' };
  // B2F-4: the caller is an admin; say what the server refused (e.g. the job owner check), by code.
  if (s === 403) return { text: override403Text(e) };
  return { text: (e as { message?: string })?.message || 'Could not apply the override.' };
}
