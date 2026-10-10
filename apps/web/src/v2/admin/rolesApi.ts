/**
 * A2 Roles (Admin seat). Contracts RoleRecord / PermissionRecord:
 *   GET /roles (each with permissions[]) · GET /roles/permissions · POST|DELETE /roles/:id/permissions/:permissionId.
 * Roadmap §3: three seats; Interviewer and licence-check are PERMISSIONS, not seats/roles.
 * BACKEND_GAP R1 names them INTERVIEW_PARTICIPATE and LICENSE_CHECK. Until the catalog has them, today's stand-ins are the
 * INTERVIEWER and LICENSE_SPECIALIST roles; the page says so and offers no toggle.
 */
import { deleteApi, getApi, postApi } from '../../api/client';
import { PROVISIONAL_ROLE_SEATS, isSeat, type Seat } from '../seat';

export interface Permission { id: string; code: string; name: string; description: string | null }
export interface AdminRole { id: string; code: string; name: string; status: string; permissions: Permission[]; seat?: string | null }
export const CAPABILITIES = [
  { key: 'interviewer', code: 'INTERVIEW_PARTICIPATE', legacyRole: 'INTERVIEWER', label: 'Interviewer', what: 'Read the CV of a candidate they interview and submit that scorecard.' },
  { key: 'licence', code: 'LICENSE_CHECK', legacyRole: 'LICENSE_SPECIALIST', label: 'Licence check', what: 'Tick the SCFHS licence item on the pre-hire checklist.' },
] as const;

const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
export async function fetchRoles(): Promise<AdminRole[]> {
  return list(await getApi<AdminRole[] | { data: AdminRole[] }>('/roles')).map((r) => ({ ...r, permissions: r.permissions ?? [] }));
}
export const fetchPermissions = async () => list(await getApi<Permission[] | { data: Permission[] }>('/roles/permissions'));
export const grant = (roleId: string, permissionId: string) => postApi(`/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permissionId)}`);
/** B2: removing a permission from a role unlinks it (history kept); it never deletes the permission. */
export const revoke = (roleId: string, permissionId: string) => deleteApi(`/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permissionId)}`);
export const roleSeat = (r: Pick<AdminRole, 'code' | 'seat'>): Seat | null => (isSeat(r.seat) ? (String(r.seat).toLowerCase() as Seat) : PROVISIONAL_ROLE_SEATS[r.code.toUpperCase()] ?? null);

/** The Figma A04 policy (Roadmap §3, §5–§6). Text per seat; 'yes' | 'info' | 'no' sets the icon. */
type Cell = [tone: 'yes' | 'info' | 'no', text: string];
export interface PolicyRow { label: string; employee: Cell; manager: Cell; admin: Cell; interviewer: Cell }
const H: Cell = ['no', 'Hidden'];
export const POLICY: Array<{ group: string; rows: PolicyRow[] }> = [
  { group: 'Recruiting work', rows: [
    { label: 'My Work, Open jobs, Candidates (own jobs)', employee: ['yes', 'Yes'], manager: H, admin: H, interviewer: H },
    { label: 'Read a candidate’s CV', employee: ['yes', 'Own jobs'], manager: ['yes', 'Direct reports’ jobs'], admin: H, interviewer: ['yes', 'Assigned interview only'] },
    { label: 'Submit scorecard', employee: ['info', 'When picked as interviewer'], manager: ['info', 'When picked as interviewer'], admin: H, interviewer: ['yes', 'Assigned interview only'] },
    { label: 'Other recruiters’ jobs', employee: ['info', 'Title, site, seats only'], manager: ['yes', 'Direct reports'], admin: H, interviewer: H },
    { label: 'See pay and grade band', employee: H, manager: ['yes', 'Team offers'], admin: H, interviewer: H },
  ] },
  { group: 'Manager decisions', rows: [
    { label: 'Approve offer / Request changes', employee: H, manager: ['yes', 'Yes'], admin: H, interviewer: H },
    { label: 'Requisitions, Activate job, Cancel requisition', employee: H, manager: ['yes', 'Yes'], admin: H, interviewer: H },
    { label: 'Add target, Reassign, Team result', employee: H, manager: ['yes', 'Direct reports'], admin: H, interviewer: H },
  ] },
  { group: 'Administration', rows: [
    { label: 'Users, Roles, Pipeline template, Master data, Templates, Integrations', employee: H, manager: H, admin: ['yes', 'Yes'], interviewer: H },
    { label: 'Reports and Audit', employee: H, manager: ['info', 'Team result only'], admin: ['yes', 'Yes'], interviewer: H },
    { label: 'Licence check (pre-hire)', employee: ['info', 'When granted'], manager: ['info', 'When granted'], admin: H, interviewer: H },
    { label: 'Delete anything', employee: ['no', 'Not available'], manager: ['no', 'Not available'], admin: ['no', 'Not available'], interviewer: ['no', 'Not available'] },
  ] },
];
