/**
 * A4 Reports + Audit, A5 Integrations + Admin override (Admin seat).
 * - Open jobs: GET /vacancies/work-queue (org-wide for Admin; redacted rows kept as title/site/seats).
 * - Offers waiting: GET /offers?status=Pending Approval (never pay; stripPay).
 * - Stage counts: B8 GET /reports/overview?from&to → funnel[] (counts only; no time-in-stage median on the API).
 * - Hiring report by team: B8 GET /results/org?month&managerId= per manager (ADMINISTRATOR only), tooFewToJudge from the server.
 * - Audit: GET /audit-logs?page&pageSize → AuditLogEntry. Read-only.
 * - Integrations: B9 — only careers_site and smtp (others hidden / 404). GET /integrations, POST /integrations/:id/test.
 * - Override: B9 POST /admin/overrides {action, entityId, reason}; actions job.hold | job.reopen | job.close; reason ≥ 10;
 *   400 OVERRIDE_REASON_REQUIRED / OVERRIDE_NOT_ALLOWED, 409 wrong state (OVERRIDE_NOT_ALLOWED), 403 non-admin.
 */
import { getApi, postApi } from '../../api/client';
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
  const r = stripPay(list(await getApi<Array<JobWorkQueueItem | RedactedJob> | { data: Array<JobWorkQueueItem | RedactedJob> }>('/vacancies/work-queue?pageSize=200')));
  return r.map((j) => (isRedactedJob(j)
    ? { id: j.id, title: j.title, site: j.site?.name ?? null, owner: null, status: null, seats: j.seats, dueDate: null, active: null, redacted: true }
    : { id: j.id, title: j.title, site: j.branch?.name ?? null, owner: j.owner?.displayName ?? null, status: j.status, seats: { filled: j.headcount.joined, target: j.headcount.approved }, dueDate: j.dueDate ?? null,
        active: ACTIVE.reduce((n, s) => n + (j.pipelineCounts?.[s] ?? 0), 0), redacted: false }))
    .filter((j) => j.status !== 'Closed' && j.status !== 'Filled');
}

export interface WaitingOfferRow { id: string; candidate: string; job: string; version: number; submittedAt: string | null }
export async function fetchOffersWaiting(): Promise<WaitingOfferRow[]> {
  type V = { id: string; versionNumber: number; createdAt?: string | null };
  type Raw = { id: string; status?: string; candidateName?: string; positionTitle?: string; currentVersionId?: string | null; currentVersion?: V | null; versions?: V[] };
  const rows = stripPay(list(await getApi<Raw[] | { data: Raw[] }>(`/offers?${new URLSearchParams({ status: 'Pending Approval', pageSize: '100' })}`)));
  return rows.filter((o) => !o.status || o.status === 'Pending Approval').map((o) => {
    const v = o.currentVersion ?? o.versions?.find((x) => x.id === o.currentVersionId) ?? [...(o.versions ?? [])].sort((x, y) => y.versionNumber - x.versionNumber)[0];
    return { id: o.id, candidate: o.candidateName ?? 'Candidate', job: o.positionTitle ?? 'Job', version: v?.versionNumber ?? 1, submittedAt: v?.createdAt ?? null };
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

export interface AuditEntry { id: string; actorUserId: string | null; actorDisplayName?: string; action: string; entityType: string; entityId: string; result: string; reason: string | null; createdAt: string }
export async function fetchAudit(pageSize = 200): Promise<{ rows: AuditEntry[]; total: number }> {
  const r = await getApi<{ data: AuditEntry[]; total?: number; meta?: { total?: number } } | AuditEntry[]>(`/audit-logs?page=1&pageSize=${pageSize}`);
  const rows = list(r);
  return { rows, total: Array.isArray(r) ? rows.length : r.total ?? r.meta?.total ?? rows.length };
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
export const postOverride = (action: OverrideAction, entityId: string, reason: string) => postApi<{ action: string; entityId: string; from: string; to: string; reason: string }>('/admin/overrides', { action, entityId, reason });
export function overrideError(e: unknown): { field?: 'reason'; text: string } {
  const d = domainError(e); const s = (e as { statusCode?: number })?.statusCode;
  if (d?.code === 'OVERRIDE_REASON_REQUIRED') return { field: 'reason', text: `An override needs a reason (at least ${OVERRIDE_MIN_REASON} characters).` };
  if (d?.code === 'OVERRIDE_NOT_ALLOWED') return { text: d.message || 'That override is not allowed for this job now.' };
  if (s === 403) return { text: 'Only an administrator can use an override.' };
  return { text: (e as { message?: string })?.message || 'Could not apply the override.' };
}
