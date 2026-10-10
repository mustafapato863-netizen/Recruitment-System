/**
 * M1 adapters: Manager requisitions (list, create/edit draft, submit, activate, add target, cancel).
 *
 * Mirrors backend B3 (`feat/b3-req-job-lifecycle` @2e2fc7d) + B4 target chip (`feat/b4-my-work`, #9) exactly:
 * - GET  /vacancy-requests                → VacancyRequest[] (org-wide; statusLabel, targetChip, dueDate, gradeId, assignedEmployeeId)
 * - GET  /vacancy-requests/context        → { branches[{id,name}], positions[{id,title}], … }   (VACANCY_REQUEST_CREATE)
 * - POST /vacancy-requests                → CreateVacancyRequestDto {branchId, positionId, requestedHeadcount, dueDate?, gradeId?, assignedEmployeeId?, justification?}
 * - PATCH /vacancy-requests/:id           → same fields; only from Draft / Changes Requested (409 otherwise)
 * - POST /vacancy-requests/:id/submit     → Draft|Changes Requested → Pending Approval; 400 DUE_DATE_REQUIRED
 * - POST /vacancy-requests/:id/activate {assignedEmployeeId?} (VACANCY_MANAGE) → {request, vacancy}; only from Approved;
 *        409 REQUISITION_CANCELLED, 400 DUE_DATE_REQUIRED / ASSIGNEE_REQUIRED; idempotent once activated.
 * - POST /vacancy-requests/:id/cancel {reason}  (reason required once approved) → closes the live job and rejects its open files.
 * - Grades: GET /master-data/catalog/grades (active only). People: GET /users/assignable (the caller's reports).
 * Budget fields exist on the DTO but are pay: never read, never sent (stripPay drops budget*).
 *
 * CoS answers (Oct 10), coded ahead of Backend:
 * - A Manager can activate their OWN Draft once it has a due date. Until Backend lands it, /activate refuses a Draft
 *   (409 "must be approved before activation", or 403 without VACANCY_MANAGE): draftActivateRefused() spots that and the UI says so.
 * - Department is optional: `departmentId`/`department`/`departmentName` on the row and `departments[]` on /context. Shown only when present.
 * - Names (positionTitle, branchName, assignedEmployeeName) and team scope come from the server; the client fill and
 *   mineOrTeam() stay as the fallback.
 * - Target update (seats + due date + reason) on a live job: typed adapter below, hidden while TARGET_UPDATE_LIVE is false.
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { stripPay } from './paySafety';
import { domainError } from './gates';

const enc = encodeURIComponent;
export type ReqStatus = 'Draft' | 'Pending Approval' | 'Changes Requested' | 'Approved' | 'Rejected' | 'Cancelled' | 'Converted to Vacancy';
export interface TargetChip { title: string; filled: number; target: number; label: string; dueDate: string | null }
export interface Requisition {
  id: string; requestCode: string; status: ReqStatus; statusLabel?: string;
  branchId: string; positionId: string; requesterId: string;
  position?: { title: string } | null;
  requestedHeadcount: number; targetFillDate: string | null; dueDate?: string | null;
  gradeId?: string | null; assignedEmployeeId?: string | null; justification: string | null;
  /** Coming from Backend (CoS): server-filled names and department. Optional; client fill is the fallback. */
  positionTitle?: string | null; branchName?: string | null; assignedEmployeeName?: string | null; requesterName?: string | null;
  departmentId?: string | null; department?: { id: string; name: string } | string | null; departmentName?: string | null;
  targetChip?: TargetChip; activatedAt?: string | null; cancelledAt?: string | null; cancelReason?: string | null;
  createdAt: string; updatedAt: string;
}
export interface ReqContext { branches: Array<{ id: string; name: string }>; positions: Array<{ id: string; title: string }>; departments?: Array<{ id: string; name: string }> }
export interface Person { id: string; name: string; detail?: string }
export interface Grade { id: string; name: string }

const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
export const dueOf = (r: Pick<Requisition, 'dueDate' | 'targetFillDate'>) => (r.dueDate ?? r.targetFillDate ?? null)?.slice(0, 10) ?? null;
export const STATUS_LABEL: Record<ReqStatus, string> = {
  Draft: 'Draft', 'Pending Approval': 'Pending approval', 'Changes Requested': 'Changes requested', Approved: 'Approved',
  Rejected: 'Rejected', Cancelled: 'Cancelled', 'Converted to Vacancy': 'Job active',
};
export const STATUS_TONE: Record<ReqStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  Draft: 'neutral', 'Pending Approval': 'info', 'Changes Requested': 'warning', Approved: 'info', Rejected: 'danger', Cancelled: 'neutral', 'Converted to Vacancy': 'success',
};
export const isEditable = (s: ReqStatus) => s === 'Draft' || s === 'Changes Requested';
export const isClosed = (s: ReqStatus) => s === 'Cancelled' || s === 'Rejected' || s === 'Converted to Vacancy';

export const fetchRequisitions = async () => list(stripPay(await getApi<Requisition[] | { data: Requisition[] }>('/vacancy-requests')));
export const fetchRequisition = async (id: string) => stripPay(await getApi<Requisition>(`/vacancy-requests/${enc(id)}`));
export async function fetchContext(): Promise<ReqContext | null> {
  try {
    const c = await getApi<Partial<ReqContext>>('/vacancy-requests/context');
    return { branches: c?.branches ?? [], positions: c?.positions ?? [], ...(Array.isArray(c?.departments) ? { departments: c.departments } : {}) };
  } catch { return null; }
}
export async function fetchGrades(): Promise<Grade[] | null> {
  try {
    const rows = list(await getApi<Array<{ id: string; name?: string; status?: string }> | { data: Array<{ id: string; name?: string; status?: string }> }>('/master-data/catalog/grades'));
    return rows.filter((r) => r.name?.trim() && (r.status ?? 'Active') === 'Active').map((r) => ({ id: r.id, name: r.name!.trim() }));
  } catch { return null; }
}
type RawUser = { id: string; displayName?: string; name?: string; status?: string; roles?: Array<{ name?: string; code?: string }> };
/** The caller's reports (GET /users/assignable). null = not available to this user. */
export async function fetchPeople(): Promise<Person[] | null> {
  try {
    const rows = list(await getApi<RawUser[] | { data: RawUser[] }>('/users/assignable'));
    return rows.filter((u) => (u.status ?? 'Active') === 'Active').map((u) => ({ id: u.id, name: u.displayName ?? u.name ?? 'Unnamed', detail: u.roles?.[0]?.name }));
  } catch { return null; }
}

/** The fields M1 edits. Never budget, never pay. */
export interface ReqFields { departmentId?: string | null; positionId: string; branchId: string; requestedHeadcount: number; dueDate: string | null; gradeId: string | null; assignedEmployeeId: string | null; justification: string | null }
export const createRequisition = (f: ReqFields) => postApi<Requisition>('/vacancy-requests', f);
export const updateRequisition = (id: string, f: Partial<ReqFields>) => patchApi<Requisition>(`/vacancy-requests/${enc(id)}`, f);
export const submitRequisition = (id: string) => postApi<Requisition>(`/vacancy-requests/${enc(id)}/submit`, {});
export const activateRequisition = (id: string, assignedEmployeeId: string | null) =>
  postApi<{ request: Requisition; vacancy?: { id: string; vacancyCode?: string } }>(`/vacancy-requests/${enc(id)}/activate`, assignedEmployeeId ? { assignedEmployeeId } : {});
export const cancelRequisition = (id: string, reason: string) => postApi<{ request: Requisition; rejectedApplications?: number; closedJob?: boolean }>(`/vacancy-requests/${enc(id)}/cancel`, { reason });

/** Server names first, then the client fill from /context and /users/assignable. */
export const titleOf = (r: Requisition, ctx: ReqContext | null) => r.positionTitle ?? r.position?.title ?? ctx?.positions.find((p) => p.id === r.positionId)?.title ?? r.requestCode;
export const siteOf = (r: Requisition, ctx: ReqContext | null) => r.branchName ?? ctx?.branches.find((b) => b.id === r.branchId)?.name ?? '—';
export const ownerOf = (r: Requisition, people: Person[] | null) => (r.assignedEmployeeId ? r.assignedEmployeeName ?? people?.find((p) => p.id === r.assignedEmployeeId)?.name ?? 'Assigned' : '—');
export function deptOf(r: Requisition, ctx: ReqContext | null): string | null {
  if (r.departmentName) return r.departmentName;
  if (r.department && typeof r.department === 'object') return r.department.name;
  if (typeof r.department === 'string' && r.department) return r.department;
  return r.departmentId ? ctx?.departments?.find((d) => d.id === r.departmentId)?.name ?? null : null;
}

/** CoS: a Manager may activate their own Draft once it has a due date. */
export const canActivateDraft = (r: Pick<Requisition, 'status' | 'requesterId'> | null, meId: string | undefined, due: string | null) =>
  (!r || (r.status === 'Draft' && r.requesterId === meId)) && !!due;
/** The current backend refusing a Draft activation (not yet live): 409 without a known code, or 403. */
export function draftActivateRefused(e: unknown): boolean {
  const x = e as { statusCode?: number } | null;
  const d = domainError(e);
  if (d && CODE_TEXT[d.code]) return false;
  return x?.statusCode === 409 || x?.statusCode === 403;
}

/** Target update on a live job (seats + due date + reason). Endpoint announced by Backend, not live: hidden until TARGET_UPDATE_LIVE. */
export const TARGET_UPDATE_LIVE = false;
export interface TargetUpdate { requestedHeadcount: number; dueDate: string; reason: string }
export const updateTarget = (id: string, body: TargetUpdate) => patchApi<Requisition>(`/vacancy-requests/${enc(id)}/target`, body);

/** Manager scope: requisitions I raised or that are assigned to one of my reports. Defence-in-depth over an org-wide list. */
export function mineOrTeam(rows: Requisition[], meId: string | undefined, people: Person[] | null): Requisition[] {
  if (!people) return rows; // reports unknown: show what the API returned
  const team = new Set(people.map((p) => p.id));
  return rows.filter((r) => r.requesterId === meId || (r.assignedEmployeeId && (team.has(r.assignedEmployeeId) || r.assignedEmployeeId === meId)));
}

const CODE_TEXT: Record<string, { field?: 'dueDate' | 'assignee' | 'reason' | 'grade'; text: string }> = {
  DUE_DATE_REQUIRED: { field: 'dueDate', text: 'A due date is required.' },
  ASSIGNEE_REQUIRED: { field: 'assignee', text: 'Pick the primary recruiter who will own the job.' },
  ASSIGNEE_NOT_ELIGIBLE: { field: 'assignee', text: 'That person cannot own a job (inactive or an administrator).' },
  OWNER_NOT_ELIGIBLE: { field: 'assignee', text: 'That person cannot own a job (inactive or an administrator).' },
  GRADE_NOT_FOUND: { field: 'grade', text: 'Pick a grade from the Grades list.' },
  REQUISITION_CANCELLED: { text: 'This requisition is cancelled and cannot be activated.' },
  REASON_REQUIRED: { field: 'reason', text: 'A reason is required.' },
};
/** Codes first; otherwise the server's message. */
export function reqError(e: unknown): { field?: 'dueDate' | 'assignee' | 'reason' | 'grade'; text: string } {
  const d = domainError(e);
  if (d && CODE_TEXT[d.code]) return { field: CODE_TEXT[d.code].field, text: d.message || CODE_TEXT[d.code].text };
  const x = e as { statusCode?: number; message?: string } | null;
  if (x?.statusCode === 403) return { text: 'You do not have permission for this action.' };
  return { text: x?.message || 'Something went wrong. Try again.' };
}

export function formatDue(d: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`));
}
