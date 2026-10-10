/**
 * A1 Users + reporting tree (Admin seat). Mirrors contracts UserRecord (#21 B9 base):
 *   GET /users · PATCH /users/:id {status | managerId} · POST /users/invitations.
 * Deactivate only: PATCH {status:'Inactive'} (DELETE /users/:id → 405 USER_DELETE_NOT_ALLOWED, never called).
 * B2 #6 owner block: 409 USER_OWNS_OPEN_WORK {counts:{openApplicationsPrimary, openApplicationsTaskOwner, openJobsPrimary, openRequisitions}}.
 * Reassign offered from that 409 (B2-9, CoS): Admin file moves go through the B9 override ONLY:
 *   POST /admin/overrides {action:'file.reassign', entityId:<the user leaving>, reason (>= 10 chars), toUserId}. Audited as ADMIN_OVERRIDE.
 *   Codes: 400 OVERRIDE_REASON_REQUIRED, 400/409 OVERRIDE_NOT_ALLOWED (server message shown, e.g. while Backend enables it), 403.
 */
import { getApi, patchApi, postApi } from '../../api/client';
import { domainError } from '../api/gates';
import { PROVISIONAL_ROLE_SEATS, SEAT_LABEL, isSeat, type Seat } from '../seat';

export interface AdminUser {
  id: string; email: string; displayName: string; jobTitle?: string | null; status: string; managerId: string | null;
  roles: Array<{ id: string; code: string; name: string }>; lastLoginAt: string | null;
  /** B10 may send the seat per user; else derived from role codes (provisional table). */
  seat?: string | null; branchName?: string | null; site?: string | null;
}
const RANK: Record<Seat, number> = { employee: 0, manager: 1, admin: 2 };
export function seatOf(u: Pick<AdminUser, 'roles' | 'seat'>): Seat {
  if (isSeat(u.seat)) return String(u.seat).toLowerCase() as Seat;
  return (u.roles ?? []).reduce<Seat>((s, r) => { const m = PROVISIONAL_ROLE_SEATS[r.code?.toUpperCase()]; return m && RANK[m] > RANK[s] ? m : s; }, 'employee');
}
export const seatLabel = (u: AdminUser) => SEAT_LABEL[seatOf(u)];
/** Sub-line: "Employee · Recruiter-onshore" (job title, else the first non-seat role name). */
export const subLine = (u: AdminUser) => [seatLabel(u), u.jobTitle || u.roles.find((r) => !['ADMINISTRATOR'].includes(r.code))?.name].filter(Boolean).join(' · ');
export const isActive = (u: AdminUser) => u.status === 'Active';
export const statusTone = (s: string) => (s === 'Active' ? 'success' : s === 'Invited' || s === 'Pending' ? 'info' : 'neutral') as 'success' | 'info' | 'neutral';

const list = <T,>(r: T[] | { data: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? []);
export async function fetchUsers(): Promise<AdminUser[]> {
  return list(await getApi<AdminUser[] | { data: AdminUser[] }>('/users?pageSize=500')).map((u) => ({ ...u, roles: u.roles ?? [], managerId: u.managerId ?? null }));
}
export const setStatus = (id: string, status: 'Active' | 'Inactive') => patchApi<AdminUser>(`/users/${encodeURIComponent(id)}`, { status });
export const setManager = (id: string, managerId: string | null) => patchApi<AdminUser>(`/users/${encodeURIComponent(id)}`, { managerId });
export const inviteUser = (body: { email: string; displayName: string; roleIds?: string[] }) => postApi<{ id: string }>('/users/invitations', body);

export interface OwnedWork { openApplicationsPrimary: number; openApplicationsTaskOwner: number; openJobsPrimary: number; openRequisitions: number; countsUnknown?: boolean }
/**
 * USER_OWNS_OPEN_WORK → counts. B2-9: until the normalizer passes the code and counts through, the wire carries
 * 409 {code:'CONFLICT', message:'This user still owns open work…'}; that still opens the reassign path, with countsUnknown.
 */
export function ownedWork(e: unknown): OwnedWork | null {
  const d = domainError(e);
  const x = e as { statusCode?: number; message?: string; counts?: Partial<OwnedWork>; details?: { counts?: Partial<OwnedWork> } };
  const legacy = x?.statusCode === 409 && /owns open work/i.test(x.message ?? '');
  if (d?.code !== 'USER_OWNS_OPEN_WORK' && !legacy) return null;
  const raw = x.counts ?? x.details?.counts;
  const c = raw ?? {};
  return { openApplicationsPrimary: c.openApplicationsPrimary ?? 0, openApplicationsTaskOwner: c.openApplicationsTaskOwner ?? 0, openJobsPrimary: c.openJobsPrimary ?? 0, openRequisitions: c.openRequisitions ?? 0, ...(raw ? {} : { countsUnknown: true }) };
}

/** Reporting tree: roots = no manager (or manager not in the list); children sorted by name; cycles cut. */
export interface TreeNode { user: AdminUser; children: TreeNode[]; depth: number }
export function buildTree(users: AdminUser[]): TreeNode[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const kids = new Map<string, AdminUser[]>();
  for (const u of users) if (u.managerId && byId.has(u.managerId) && u.managerId !== u.id) kids.set(u.managerId, [...(kids.get(u.managerId) ?? []), u]);
  const name = (a: AdminUser, b: AdminUser) => a.displayName.localeCompare(b.displayName);
  const seen = new Set<string>();
  const grow = (u: AdminUser, depth: number): TreeNode => { seen.add(u.id); return { user: u, depth, children: (kids.get(u.id) ?? []).filter((c) => !seen.has(c.id)).sort(name).map((c) => grow(c, depth + 1)) }; };
  const roots = users.filter((u) => !u.managerId || !byId.has(u.managerId)).sort(name).map((u) => grow(u, 0));
  // Anything left is in a cycle: show it at the top so it can be fixed.
  for (const u of users.filter((x) => !seen.has(x.id)).sort(name)) if (!seen.has(u.id)) roots.push(grow(u, 0));
  return roots;
}
export const flatten = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((n) => [n, ...flatten(n.children)]);
/** Would `managerId` sit under `userId`? (picking a descendant would make a loop) */
export function isDescendant(users: AdminUser[], userId: string, managerId: string): boolean {
  const byId = new Map(users.map((u) => [u.id, u]));
  let cur = byId.get(managerId); const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) { if (cur.id === userId) return true; seen.add(cur.id); cur = cur.managerId ? byId.get(cur.managerId) : undefined; }
  return false;
}

/** B2-9: the Admin moves a leaving user's open files via the B9 override (never /files/reassign). */
export const OVERRIDE_REASON_MIN = 10;
export const overrideReassign = (fromUserId: string, toUserId: string, reason: string) =>
  postApi<unknown>('/admin/overrides', { action: 'file.reassign', entityId: fromUserId, toUserId, reason });
