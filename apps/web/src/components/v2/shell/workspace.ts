import type { UserProfile } from '@recruitflow/contracts';

export interface WorkspaceOption { id: string; label: string; detail?: string; current?: boolean }

type NamedRef = { id?: string; name?: string | null } | null | undefined;
type MeWithWorkspaces = UserProfile & {
  /** Not on /auth/me today (it returns one organizationId/organizationName). Read if a later backend adds them. */
  organizations?: NamedRef[];
  departments?: NamedRef[];
  department?: NamedRef;
  departmentName?: string | null;
};

/**
 * /auth/me today (AuthService.getUserProfile): { id, email, displayName,
 * organizationId, organizationName, roles, permissions, lastLoginAt } — one org,
 * no department. So this returns one option and the shell shows a static label.
 */
export function workspaceOptions(me: UserProfile): WorkspaceOption[] {
  const m = me as MeWithWorkspaces;
  const deptName = m.department?.name ?? m.departmentName ?? undefined;
  const orgs = (m.organizations ?? []).filter((o): o is { id: string; name: string } => Boolean(o?.id && o?.name));
  if (orgs.length > 1) {
    return orgs.map((o) => ({ id: o.id, label: o.name, current: o.id === me.organizationId }));
  }
  const depts = (m.departments ?? []).filter((d): d is { id: string; name: string } => Boolean(d?.id && d?.name));
  if (depts.length > 1) {
    return depts.map((d, i) => ({ id: d.id, label: d.name, detail: me.organizationName, current: deptName ? d.name === deptName : i === 0 }));
  }
  const label = deptName || me.organizationName;
  if (!label) return [];
  return [{ id: me.organizationId || 'org', label, detail: deptName ? me.organizationName : undefined, current: true }];
}
