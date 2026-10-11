/**
 * Pure builder for the admin roles / users / grants export (Roadmap v2 step 0a).
 *
 * Kept free of Nest and Prisma so the API service and its tests share one
 * implementation. scripts/export-access.cjs mirrors this logic for the CLI;
 * keep the two in sync (field names are asserted by tests on both paths).
 *
 * Secrets policy: the inputs are selected field-by-field and the builder only
 * copies whitelisted fields, so password hashes, auth tokens, refresh tokens
 * and token versions can never reach the output.
 */

export type ExportDataScope = 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'ASSIGNED_ONLY';

export const SCOPE_ORDER: ExportDataScope[] = ['ALL', 'BRANCH', 'DEPARTMENT', 'ASSIGNED_ONLY'];

export interface ExportRoleInput {
  id: string;
  code: string;
  name: string;
  status: string;
  organizationId: string | null;
  permissionCodes: string[];
}

export interface ExportUserInput {
  id: string;
  organizationId: string;
  displayName: string;
  email: string;
  status: string;
  jobTitle: string | null;
  managerId: string | null;
  roleCodes: string[];
  /** Data scopes resolved exactly as the API enforces them. */
  dataScopes: ExportDataScope[];
  branches: string[];
  departments: string[];
  ownership: ExportOwnershipCounts;
}

export interface ExportOwnershipCounts {
  openJobsPrimary: number;
  openJobsSupport: number;
  openRequisitions: number;
  openApplicationsPrimary: number;
  openApplicationsTaskOwner: number;
}

export interface ExportRole {
  id: string;
  code: string;
  name: string;
  status: string;
  scope: 'shared' | 'tenant';
  permissions: string[];
  userCount: number;
  activeUserCount: number;
}

export interface ExportUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  active: boolean;
  status: string;
  jobTitle: string | null;
  managerId: string | null;
  roles: string[];
  isAdministrator: boolean;
  effectivePermissions: string[];
  dataScope: ExportDataScope;
  dataScopes: ExportDataScope[];
  branches: string[];
  departments: string[];
  ownership: ExportOwnershipCounts & { ownsOpenWork: boolean };
  adminOwner: boolean;
}

export interface AccessExport {
  generatedAt: string;
  source: string;
  organizationIds: string[];
  summary: {
    roleCount: number;
    userCount: number;
    activeUserCount: number;
    administratorCount: number;
    adminOwnerCount: number;
    usersOwningOpenWork: number;
  };
  roles: ExportRole[];
  users: ExportUser[];
}

export const ADMIN_ROLE_CODE = 'ADMINISTRATOR';

export function widestScope(scopes: ExportDataScope[]): ExportDataScope {
  for (const scope of SCOPE_ORDER) if (scopes.includes(scope)) return scope;
  return 'ASSIGNED_ONLY';
}

export function buildAccessExport(input: {
  roles: ExportRoleInput[];
  users: ExportUserInput[];
  source: string;
  now?: Date;
}): AccessExport {
  const permissionsByRole = new Map(input.roles.map((role) => [role.code, role.permissionCodes]));
  const allPermissionCodes = [...new Set(input.roles.flatMap((role) => role.permissionCodes))].sort();

  const users: ExportUser[] = input.users.map((user) => {
    const roles = [...new Set(user.roleCodes)].sort();
    const isAdministrator = roles.includes(ADMIN_ROLE_CODE);
    // Mirrors PermissionsGuard: Administrator passes every permission check.
    const effectivePermissions = isAdministrator
      ? allPermissionCodes
      : [...new Set(roles.flatMap((code) => permissionsByRole.get(code) ?? []))].sort();
    const dataScopes = isAdministrator ? (['ALL'] as ExportDataScope[]) : [...new Set(user.dataScopes)];
    const o = user.ownership;
    const ownsOpenWork =
      o.openJobsPrimary + o.openJobsSupport + o.openRequisitions + o.openApplicationsPrimary + o.openApplicationsTaskOwner > 0;
    return {
      id: user.id,
      organizationId: user.organizationId,
      name: user.displayName,
      email: user.email,
      active: user.status === 'Active',
      status: user.status,
      jobTitle: user.jobTitle,
      managerId: user.managerId,
      roles,
      isAdministrator,
      effectivePermissions,
      dataScope: widestScope(dataScopes),
      dataScopes,
      branches: [...user.branches],
      departments: [...user.departments],
      ownership: {
        openJobsPrimary: o.openJobsPrimary,
        openJobsSupport: o.openJobsSupport,
        openRequisitions: o.openRequisitions,
        openApplicationsPrimary: o.openApplicationsPrimary,
        openApplicationsTaskOwner: o.openApplicationsTaskOwner,
        ownsOpenWork,
      },
      adminOwner: isAdministrator && ownsOpenWork,
    };
  });

  const roles: ExportRole[] = input.roles
    .map((role) => {
      const holders = users.filter((user) => user.roles.includes(role.code));
      return {
        id: role.id,
        code: role.code,
        name: role.name,
        status: role.status,
        scope: role.organizationId ? ('tenant' as const) : ('shared' as const),
        permissions: [...role.permissionCodes].sort(),
        userCount: holders.length,
        activeUserCount: holders.filter((user) => user.active).length,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    source: input.source,
    organizationIds: [...new Set(users.map((user) => user.organizationId))].sort(),
    summary: {
      roleCount: roles.length,
      userCount: users.length,
      activeUserCount: users.filter((user) => user.active).length,
      administratorCount: users.filter((user) => user.isAdministrator).length,
      adminOwnerCount: users.filter((user) => user.adminOwner).length,
      usersOwningOpenWork: users.filter((user) => user.ownership.ownsOpenWork).length,
    },
    roles,
    users,
  };
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(';') : value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One CSV row per user plus one per role, distinguished by `recordType`. */
export function accessExportToCsv(data: AccessExport): string {
  const header = [
    'recordType', 'id', 'organizationId', 'code', 'name', 'email', 'active', 'status', 'roles',
    'isAdministrator', 'dataScope', 'branches', 'departments', 'openJobsPrimary', 'openJobsSupport',
    'openRequisitions', 'openApplicationsPrimary', 'openApplicationsTaskOwner', 'adminOwner',
    'userCount', 'activeUserCount', 'permissions',
  ];
  const rows: unknown[][] = [];
  for (const role of data.roles) {
    rows.push(['role', role.id, '', role.code, role.name, '', '', role.status, '', role.code === ADMIN_ROLE_CODE,
      '', '', '', '', '', '', '', '', '', role.userCount, role.activeUserCount, role.permissions]);
  }
  for (const user of data.users) {
    const o = user.ownership;
    rows.push(['user', user.id, user.organizationId, '', user.name, user.email, user.active, user.status, user.roles,
      user.isAdministrator, user.dataScope, user.branches, user.departments, o.openJobsPrimary, o.openJobsSupport,
      o.openRequisitions, o.openApplicationsPrimary, o.openApplicationsTaskOwner, user.adminOwner, '', '',
      user.effectivePermissions]);
  }
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
