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
  targetChip?: TargetChip; activatedAt?: string | null; cancelledAt?: string | null; cancelReason?: string | null;
  createdAt: string; updatedAt: string;
}
export interface ReqContext { branches: Array<{ id: string; name: string }>; positions: Array<{ id: string; title: string }> }
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
    return { branches: c?.branches ?? [], positions: c?.positions ?? [] };
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
export interface ReqFields { positionId: string; branchId: string; requestedHeadcount: number; dueDate: string | null; gradeId: string | null; assignedEmployeeId: string | null; justification: string | null }
export const createRequisition = (f: ReqFields) => postApi<Requisition>('/vacancy-requests', f);
export const updateRequisition = (id: string, f: Partial<ReqFields>) => patchApi<Requisition>(`/vacancy-requests/${enc(id)}`, f);
export const submitRequisition = (id: string) => postApi<Requisition>(`/vacancy-requests/${enc(id)}/submit`, {});
export const activateRequisition = (id: string, assignedEmployeeId: string | null) =>
  postApi<{ request: Requisition; vacancy?: { id: string; vacancyCode?: string } }>(`/vacancy-requests/${enc(id)}/activate`, assignedEmployeeId ? { assignedEmployeeId } : {});
export const cancelRequisition = (id: string, reason: string) => postApi<{ request: Requisition; rejectedApplications?: number; closedJob?: boolean }>(`/vacancy-requests/${enc(id)}/cancel`, { reason });

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
