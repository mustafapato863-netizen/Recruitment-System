/**
 * A4 Reports + Audit, A5 Integrations + Admin override (Admin seat).
 * - Open jobs: GET /vacancies/work-queue (org-wide for Admin; redacted rows kept as title/site/seats).
 * - Offers waiting: GET /offers?status=Pending Approval (never pay; stripPay). Uses approval submission time (R07).
 * - Stage counts: B8 GET /reports/overview?from&to → funnel[] using Africa/Cairo [month start, next month start) (R03/R04).
 * - Hiring report by team: B8 GET /results/org?month&managerId= per manager with bounded concurrency and partial-load tracking (R04/R09).
 * - Audit (CoS): server-side GET /audit?actor&entity&from&to&page&pageSize (C5, admin-only, pageSize ≤ 100) when present;
 *   else GET /audit-logs?page&pageSize=100 with the client-side filters. Read-only.
 * - Every list call stays at pageSize ≤ 100 (B2-22) and pages through fetchAllPages.
 * - Integrations: B9 — only careers_site and smtp (others hidden / 404).
 *   GET /integrations, PATCH /integrations/:id { configJson } (never status), POST /integrations/:id/test.
 *   A saved setting is not a verified send. The SMTP test does not send mail.
 * - Override: B9 POST /admin/overrides {action, entityId, reason}; actions job.hold | job.reopen | job.close; reason ≥ 10;
 *   #21 2ced190: hold/close send the list reason as `reason` (+ `note` for "Other") and holdUntil; reopen sends free text.
 *   400 OVERRIDE_REASON_REQUIRED / OVERRIDE_NOT_ALLOWED, 409 wrong state (OVERRIDE_NOT_ALLOWED), 403 non-admin.
 */
import type { IntegrationItem } from '@recruitflow/contracts';
import { override403Text } from './overrideErrors';
import { serverFormErrors } from '../forms/serverErrors';
import { getApi, patchApi, postApi } from '../../api/client';
import { fetchAllPages } from '../api/paged';
import { stripPay } from '../api/paySafety';
import { domainError } from '../api/gates';
import { isRedactedJob, type JobStatus, type JobWorkQueueItem, type RedactedJob } from '../api/jobs';
import { TILE_KEYS } from '../api/teamResult';
import { cairoMonthRange, type ResultTile, type ResultsResponse, type TileKey } from '../api/myResult';

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

export interface WaitingOfferRow {
  id: string;
  candidate: string;
  job: string;
  version: number;
  /** R07: Current approval-request timestamp (when submitted for approval), never draft creation. */
  submittedAt: string | null;
  /** Draft/version creation timestamp, kept separate from approval submission time. */
  versionCreatedAt?: string | null;
  approver: string | null;
}
type Person = { id?: string | null; name?: string | null; displayName?: string | null } | null | undefined;
const isRoleCode = (n: string) => /^[A-Z][A-Z0-9_]+$/.test(n.trim());
/** CoS: name the approver when the API sends one (approver / approvers[] / approvals[].approver); never a role code. */
export function approverName(o: { approver?: Person; approvers?: Person[]; approvals?: Array<{ status?: string; approver?: Person; approverName?: string | null }> }): string | null {
  const people: Person[] = [o.approver, ...(o.approvers ?? []), ...(o.approvals ?? []).filter((a) => !a.status || a.status === 'Pending').map((a) => a.approver ?? (a.approverName ? { name: a.approverName } : null))];
  const names = [...new Set(people.map((p) => (p?.name ?? p?.displayName ?? '').trim()).filter((n) => n && !isRoleCode(n)))];
  return names.length ? names.join(', ') : null;
}
export async function fetchOffersWaiting(): Promise<WaitingOfferRow[]> {
  type ApprovalRaw = { status?: string; createdAt?: string | null; requestedAt?: string | null; submittedAt?: string | null; approver?: Person; approverName?: string | null };
  type V = { id: string; versionNumber: number; createdAt?: string | null; submittedAt?: string | null; approvals?: ApprovalRaw[] };
  type Raw = {
    id: string;
    status?: string;
    candidateName?: string;
    positionTitle?: string;
    submittedAt?: string | null;
    currentVersionId?: string | null;
    currentVersion?: V | null;
    versions?: V[];
    approvals?: ApprovalRaw[];
  } & Parameters<typeof approverName>[0];
  const rows = stripPay(await fetchAllPages<Raw>(`/offers?${new URLSearchParams({ status: 'Pending Approval' })}`));
  return rows.filter((o) => !o.status || o.status === 'Pending Approval').map((o) => {
    const v = o.currentVersion ?? o.versions?.find((x) => x.id === o.currentVersionId) ?? [...(o.versions ?? [])].sort((x, y) => y.versionNumber - x.versionNumber)[0];
    const allApprovals = [...(v?.approvals ?? []), ...(o.approvals ?? [])];
    const pendingApprovals = allApprovals.filter((a) => !a.status || a.status === 'Pending');
    const approvalPool = pendingApprovals.length ? pendingApprovals : allApprovals;
    const latestApprovalAt = [...approvalPool]
      .map((a) => a.submittedAt ?? a.requestedAt ?? a.createdAt ?? null)
      .filter((ts): ts is string => typeof ts === 'string' && ts.trim().length > 0)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
    const submittedAt = v?.submittedAt ?? o.submittedAt ?? latestApprovalAt ?? null;
    const versionCreatedAt = v?.createdAt ?? null;
    return {
      id: o.id,
      candidate: o.candidateName ?? 'Candidate',
      job: o.positionTitle ?? 'Job',
      version: v?.versionNumber ?? 1,
      submittedAt,
      versionCreatedAt,
      approver: approverName({ ...o, approvals: allApprovals }),
    };
  });
}

export interface StageCount { name: string; count: number }
/**
 * R03 & R04: Use Africa/Cairo half-open [month start, next month start) instants.
 * Return null only when the endpoint is not implemented (404/501); rethrow 403/500/malformed errors so the UI can show error + retry.
 */
export async function fetchStageCounts(month: string): Promise<StageCount[] | null> {
  const range = cairoMonthRange(month);
  if (!range) throw new Error('month must be YYYY-MM.');
  try {
    const o = await getApi<{ funnel?: unknown }>(`/reports/overview?from=${enc(range.from)}&to=${enc(range.to)}`);
    if (!o || typeof o !== 'object' || !Array.isArray(o.funnel)) {
      throw new Error('Stage report returned an invalid response.');
    }
    return o.funnel.map((f: { name?: unknown; count?: unknown }) => ({
      name: typeof f?.name === 'string' ? f.name : 'Unknown',
      count: typeof f?.count === 'number' ? f.count : 0,
    }));
  } catch (e) {
    const s = (e as { statusCode?: number })?.statusCode;
    if (s === 404 || s === 501) return null;
    throw e;
  }
}

export interface TeamReportRow { managerId: string; managerName: string; team: string | null; people: number; tiles: Record<TileKey, ResultTile> }
export type TeamReportList = TeamReportRow[] & {
  partial: boolean;
  omittedCount: number;
  requestedCount: number;
  forbiddenCount: number;
  failedCount: number;
};

const TEAM_REPORT_CONCURRENCY = 3;

/**
 * R04 & R09: Bounded-concurrency B8 /results/org calls per manager with direct reports.
 * - Returns null when /results/org is not on this server (404/501).
 * - Attaches completeness metadata (`partial`, `omittedCount`, `requestedCount`, `forbiddenCount`, `failedCount`)
 *   when any manager row is restricted or fails, without disclosing restricted manager identities.
 */
export async function fetchTeamReport(
  month: string,
  managers: Array<{ id: string; name: string; team: string | null }>,
): Promise<TeamReportList | null> {
  if (managers.length === 0) {
    return Object.assign([] as TeamReportRow[], {
      partial: false,
      omittedCount: 0,
      requestedCount: 0,
      forbiddenCount: 0,
      failedCount: 0,
    });
  }
  type Outcome =
    | { kind: 'ok'; row: TeamReportRow }
    | { kind: 'not-found' }
    | { kind: 'forbidden' }
    | { kind: 'invalid' }
    | { kind: 'error'; error: unknown };

  const outcomes: Outcome[] = new Array(managers.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < managers.length) {
      const idx = cursor++;
      const m = managers[idx]!;
      try {
        const r = await getApi<ResultsResponse>(`/results/org?month=${month}&managerId=${enc(m.id)}`);
        if (
          !r?.tiles ||
          !TILE_KEYS.every((k) => r.tiles[k] && typeof r.tiles[k].value === 'number' && typeof r.tiles[k].sampleSize === 'number')
        ) {
          outcomes[idx] = { kind: 'invalid' };
          continue;
        }
        outcomes[idx] = {
          kind: 'ok',
          row: { managerId: m.id, managerName: m.name, team: m.team, people: r.people?.length ?? 0, tiles: r.tiles },
        };
      } catch (e) {
        const s = (e as { statusCode?: number })?.statusCode;
        if (s === 404 || s === 501) outcomes[idx] = { kind: 'not-found' };
        else if (s === 403 || s === 400) outcomes[idx] = { kind: 'forbidden' };
        else outcomes[idx] = { kind: 'error', error: e };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(TEAM_REPORT_CONCURRENCY, managers.length) }, () => worker()));

  const out: TeamReportRow[] = [];
  let notFoundCount = 0;
  let forbiddenCount = 0;
  let failedCount = 0;
  let firstError: unknown = null;

  for (const o of outcomes) {
    if (o.kind === 'ok') out.push(o.row);
    else if (o.kind === 'not-found') notFoundCount++;
    else if (o.kind === 'forbidden') forbiddenCount++;
    else if (o.kind === 'invalid') {
      failedCount++;
      if (!firstError) firstError = new Error('Team report returned an invalid response.');
    } else if (o.kind === 'error') {
      failedCount++;
      if (!firstError) firstError = o.error;
    }
  }

  if (notFoundCount === managers.length) return null;
  if (out.length === 0 && firstError) throw firstError;

  const omittedCount = managers.length - out.length;
  return Object.assign(out, {
    partial: omittedCount > 0,
    omittedCount,
    requestedCount: managers.length,
    forbiddenCount,
    failedCount,
  });
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
export interface AuditEntry { id: string; actorUserId: string | null; actorDisplayName?: string; action: string; entityType: string; entityId: string; result: string; reason: string | null; createdAt: string; correlationId?: string | null }
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

export type Integration = IntegrationItem;
export const ALLOWED_PROVIDERS = ['careers_site', 'smtp'] as const;

function textField(raw: Record<string, unknown>, key: 'careersUrl' | 'smtpHost' | 'fromAddress'): string | null {
  const value = raw[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function portField(value: unknown): number | null {
  const port = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}
/** Keep the settings form fields. Drop secret and *Encrypted keys before they can reach the page. */
export function publicIntegration(raw: Record<string, unknown>): Integration {
  const provider = typeof raw.provider === 'string' ? raw.provider : '';
  const status = typeof raw.status === 'string' ? raw.status : '';
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    provider,
    category: typeof raw.category === 'string' ? raw.category : '',
    status: provider === 'smtp' && status === 'Connected' ? 'Not verified' : status,
    lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : null,
    careersUrl: textField(raw, 'careersUrl'),
    smtpHost: textField(raw, 'smtpHost'),
    fromAddress: textField(raw, 'fromAddress'),
    port: portField(raw.port),
  };
}
export async function fetchIntegrations(): Promise<Integration[]> {
  const rows = list(await getApi<Array<Record<string, unknown>> | { data: Array<Record<string, unknown>> }>('/integrations'));
  return rows.filter((row) => typeof row.provider === 'string' && (ALLOWED_PROVIDERS as readonly string[]).includes(row.provider)).map(publicIntegration);
}
export const testIntegration = (id: string) => postApi<{ success?: boolean; ok?: boolean; message?: string; status?: string }>(`/integrations/${enc(id)}/test`);

export interface IntegrationSettings { careersUrl?: string; smtpHost?: string; fromAddress?: string; port?: number }
/** Patch settings only. Status is never sent — a save must not mark the provider connected. */
export async function updateIntegration(id: string, configJson: IntegrationSettings): Promise<Integration> {
  return publicIntegration(await patchApi<Record<string, unknown>>(`/integrations/${enc(id)}`, { configJson }));
}

export type OverrideAction = 'job.hold' | 'job.reopen' | 'job.close';
export const OVERRIDE_FROM: Record<OverrideAction, readonly string[]> = {
  'job.hold': ['Open', 'Partially Filled'], 'job.reopen': ['On Hold'], 'job.close': ['Open', 'On Hold', 'Partially Filled', 'Filled'],
};
export const OVERRIDE_LABEL: Record<OverrideAction, string> = { 'job.hold': 'Put on hold', 'job.reopen': 'Reopen', 'job.close': 'Close job' };
export const overridesFor = (status: string | null) => (Object.keys(OVERRIDE_FROM) as OverrideAction[]).filter((a) => !!status && OVERRIDE_FROM[a].includes(status));
export const OVERRIDE_MIN_REASON = 10;
/**
 * = #21 2ced190 POST /admin/overrides { action, entityId, reason, note?, holdUntil? }.
 * hold/close: `reason` is a hold-reasons / close-reasons list value ("Other" + `note`); holdUntil on hold only.
 * reopen: `reason` is free text (>= 10 characters). Without lists, free text >= 10 is stored server-side as "Other: <text>".
 */
export interface OverrideExtras { note?: string; holdUntil?: string }
export const postOverride = (action: OverrideAction, entityId: string, reason: string, extras: OverrideExtras = {}) => {
  const body: Record<string, string> = { action, entityId, reason };
  if (action !== 'job.reopen' && extras.note?.trim()) body.note = extras.note.trim();
  if (action === 'job.hold' && extras.holdUntil) body.holdUntil = extras.holdUntil;
  return postApi<{ action: string; entityId: string; from: string; to: string; reason: string }>('/admin/overrides', body);
};
type OverrideField = 'reason' | 'holdUntil' | 'note' | 'action';
const OVERRIDE_FIELD: Record<string, OverrideField> = { reason: 'reason', note: 'note', holdUntil: 'holdUntil', action: 'action' };
export function overrideError(e: unknown): { field?: OverrideField; text: string } {
  // #23: a 400's field/fields name the body path; show it on that input.
  const f = serverFormErrors(e);
  const hit = Object.keys(f.byField).find((k) => OVERRIDE_FIELD[k]);
  if (hit) return { field: OVERRIDE_FIELD[hit], text: f.byField[hit] };
  const d = domainError(e); const s = (e as { statusCode?: number })?.statusCode;
  // #21: "Other" from a reason list needs a short note (400 REASON_REQUIRED).
  if (d?.code === 'REASON_REQUIRED') return { field: 'note', text: d.message || '"Other" needs a short note.' };
  if (d?.code === 'OVERRIDE_REASON_REQUIRED') return { field: 'reason', text: `An override needs a reason (at least ${OVERRIDE_MIN_REASON} characters).` };
  if (d?.code === 'OVERRIDE_NOT_ALLOWED') return { text: d.message || 'That override is not allowed for this job now.' };
  if (d?.code === 'REASON_NOT_IN_LIST') return { field: 'reason', text: 'Pick a reason from the list.' };
  if (d?.code === 'HOLD_UNTIL_NOT_FUTURE') return { field: 'holdUntil', text: 'Pick a day after today (Cairo).' };
  // B2F-4: the caller is an admin; say what the server refused (e.g. the job owner check), by code.
  if (s === 403) return { text: override403Text(e) };
  return { text: (e as { message?: string })?.message || 'Could not apply the override.' };
}
