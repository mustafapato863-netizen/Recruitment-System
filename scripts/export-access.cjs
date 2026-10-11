#!/usr/bin/env node
/* Roadmap v2 step 0a: export roles, users and grants (read-only).
 *
 * Usage:
 *   pnpm access:export                                  # all organizations, ./exports/
 *   pnpm access:export -- --out /path/to/dir            # custom output directory
 *   pnpm access:export -- --organization-id <uuid>      # one organization
 *
 * Writes <out>/roles-users-grants.json and <out>/roles-users-grants.csv.
 * Uses DATABASE_URL from the environment or the repo .env. Performs only
 * SELECT queries. Never selects password hashes, auth tokens, refresh tokens
 * or secrets.
 *
 * Mirrors apps/api/src/access-control/export/access-export.builder.ts and
 * AccessControlService.resolveScopes(); keep them in sync.
 */
const path = require('node:path');
const fs = require('node:fs');
const repoRoot = path.resolve(__dirname, '..');
const dotenv = require(path.join(repoRoot, 'database/node_modules/dotenv'));
const { PrismaClient } = require(path.join(repoRoot, 'database/generated/client'));

dotenv.config({ path: path.join(repoRoot, '.env') });

const args = process.argv.slice(2);
function valueFor(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}
const outDir = path.resolve(valueFor('--out') || path.join(repoRoot, 'exports'));
const organizationIdArg = valueFor('--organization-id');

const OPEN_JOB_STATUSES = ['Pending Activation', 'Open', 'On Hold', 'Partially Filled'];
const OPEN_REQUISITION_STATUSES = ['Draft', 'Pending Approval', 'Changes Requested', 'Approved'];
const CLOSED_APPLICATION_STAGES = ['Joined', 'Rejected', 'Withdrawn'];
const SCOPE_ORDER = ['ALL', 'BRANCH', 'DEPARTMENT', 'ASSIGNED_ONLY'];
const ADMIN_ROLE_CODE = 'ADMINISTRATOR';
// Same defaults as DEFAULT_ROLE_POLICIES in access-control.service.ts.
const DEFAULT_ROLE_SCOPES = {
  ADMINISTRATOR: 'ALL', TALENT_MANAGER: 'ALL', HR_MANAGER: 'ALL', RECRUITER: 'ALL',
  'RECRUITER-OFFSHORE': 'ALL', RECRUITER_OFFSHORE: 'ALL', HIRING_MANAGER: 'DEPARTMENT',
  INTERVIEWER: 'ASSIGNED_ONLY', HR_OPERATIONS: 'ALL', LICENSE_SPECIALIST: 'ALL',
  OFFER_APPROVER: 'ALL', FINAL_HIRING_APPROVER: 'ALL', VIEWER: 'ALL',
};

function widestScope(scopes) {
  for (const scope of SCOPE_ORDER) if (scopes.includes(scope)) return scope;
  return 'ASSIGNED_ONLY';
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(';') : value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(data) {
  const header = [
    'recordType', 'id', 'organizationId', 'code', 'name', 'email', 'active', 'status', 'roles',
    'isAdministrator', 'dataScope', 'branches', 'departments', 'openJobsPrimary', 'openJobsSupport',
    'openRequisitions', 'openApplicationsPrimary', 'openApplicationsTaskOwner', 'adminOwner',
    'userCount', 'activeUserCount', 'permissions',
  ];
  const rows = [];
  for (const role of data.roles) {
    rows.push(['role', role.id, role.organizationId || '', role.code, role.name, '', '', role.status, '', role.code === ADMIN_ROLE_CODE,
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

async function scopeResolver(prisma, organizationId, orgRoles) {
  const [rls, catalog] = await Promise.all([
    prisma.integration.findFirst({ where: { organizationId, name: 'RLS_ACCESS_POLICY' }, select: { configJson: true } }),
    prisma.integration.findFirst({ where: { organizationId, name: 'ACCESS_CONTROL_CATALOG' }, select: { configJson: true } }),
  ]);
  const config = (rls && rls.configJson) || {};
  const visibleCodes = Array.isArray(catalog && catalog.configJson && catalog.configJson.visibleRoleCodes)
    ? catalog.configJson.visibleRoleCodes : undefined;
  const visibleRoles = visibleCodes
    ? orgRoles.filter((r) => visibleCodes.includes(r.code) || r.code === ADMIN_ROLE_CODE)
    : orgRoles;
  const merged = {};
  for (const r of visibleRoles) {
    const saved = config.roles && config.roles[r.code];
    merged[r.code] = (saved && saved.dataScope) || DEFAULT_ROLE_SCOPES[r.code] || 'ALL';
  }
  return (userId, roleCodes) => {
    const responsibility = (config.userResponsibilities || {})[userId];
    const overrideScope = config.userOverrides && config.userOverrides[userId] && config.userOverrides[userId].dataScope;
    const roleScopes = roleCodes
      .map((code) => merged[code] || DEFAULT_ROLE_SCOPES[code] || (code.toUpperCase().includes('RECRUITER') ? DEFAULT_ROLE_SCOPES.RECRUITER : undefined))
      .filter(Boolean);
    return {
      scopes: overrideScope ? [overrideScope] : roleScopes.length > 0 ? roleScopes : ['ASSIGNED_ONLY'],
      branches: (responsibility && responsibility.branches) || [],
      departments: (responsibility && responsibility.departments) || [],
    };
  };
}

async function ownershipCounts(prisma, organizationId) {
  const [jobs, reqs, primaryApps, taskApps] = await Promise.all([
    // B1 owner column + active PRIMARY assignment, distinct per job (same rule as the API export / B2 owner block).
    prisma.vacancy.findMany({ where: { organizationId, status: { in: OPEN_JOB_STATUSES } }, select: { primaryRecruiterId: true, assignments: { where: { isActive: true }, select: { userId: true, assignmentKind: true } } } }),
    prisma.vacancyRequest.groupBy({ by: ['requesterId'], where: { organizationId, status: { in: OPEN_REQUISITION_STATUSES } }, _count: { _all: true } }),
    prisma.application.groupBy({ by: ['primaryRecruiterId'], where: { organizationId, stage: { notIn: CLOSED_APPLICATION_STAGES }, primaryRecruiterId: { not: null } }, _count: { _all: true } }),
    prisma.application.groupBy({ by: ['taskOwnerId'], where: { organizationId, stage: { notIn: CLOSED_APPLICATION_STAGES }, taskOwnerId: { not: null } }, _count: { _all: true } }),
  ]);
  const map = (rows, key, filter = () => true) => new Map(rows.filter(filter).map((r) => [r[key], r._count._all]));
  const primaryJobs = new Map();
  const supportJobs = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const job of jobs) {
    const owners = new Set(job.primaryRecruiterId ? [job.primaryRecruiterId] : []);
    for (const a of job.assignments) if (a.assignmentKind === 'PRIMARY') owners.add(a.userId);
    owners.forEach((id) => bump(primaryJobs, id));
    for (const id of new Set(job.assignments.filter((a) => a.assignmentKind !== 'PRIMARY' && !owners.has(a.userId)).map((a) => a.userId))) bump(supportJobs, id);
  }
  const requisitions = map(reqs, 'requesterId');
  const primary = map(primaryApps, 'primaryRecruiterId');
  const task = map(taskApps, 'taskOwnerId');
  return (userId) => ({
    openJobsPrimary: primaryJobs.get(userId) || 0,
    openJobsSupport: supportJobs.get(userId) || 0,
    openRequisitions: requisitions.get(userId) || 0,
    openApplicationsPrimary: primary.get(userId) || 0,
    openApplicationsTaskOwner: task.get(userId) || 0,
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const organizations = await prisma.organization.findMany({
      where: organizationIdArg ? { id: organizationIdArg } : {},
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (organizations.length === 0) throw new Error('No organizations found.');

    const allRoles = await prisma.role.findMany({
      select: { id: true, code: true, name: true, status: true, organizationId: true, permissions: { select: { permission: { select: { code: true } } } } },
      orderBy: { code: 'asc' },
    });
    const roleRecords = allRoles
      .filter((r) => !r.organizationId || organizations.some((o) => o.id === r.organizationId))
      .map((r) => ({ ...r, permissionCodes: r.permissions.map((p) => p.permission.code) }));
    const permsByRole = new Map(roleRecords.map((r) => [r.code, r.permissionCodes]));
    const allPermissionCodes = [...new Set(roleRecords.flatMap((r) => r.permissionCodes))].sort();

    const users = [];
    for (const org of organizations) {
      const orgRoles = roleRecords.filter((r) => !r.organizationId || r.organizationId === org.id);
      const resolve = await scopeResolver(prisma, org.id, orgRoles);
      const owned = await ownershipCounts(prisma, org.id);
      // Explicit field selection: never passwordHash, tokenVersion or auth tokens.
      const orgUsers = await prisma.user.findMany({
        where: { organizationId: org.id },
        select: { id: true, organizationId: true, displayName: true, email: true, status: true, jobTitle: true, managerId: true, userRoles: { select: { role: { select: { code: true } } } } },
        orderBy: { displayName: 'asc' },
      });
      for (const u of orgUsers) {
        const roles = [...new Set(u.userRoles.map((ur) => ur.role.code))].sort();
        const isAdministrator = roles.includes(ADMIN_ROLE_CODE);
        const scope = resolve(u.id, roles);
        const dataScopes = isAdministrator ? ['ALL'] : [...new Set(scope.scopes)];
        const o = owned(u.id);
        const ownsOpenWork = Object.values(o).some((n) => n > 0);
        users.push({
          id: u.id, organizationId: u.organizationId, name: u.displayName, email: u.email,
          active: u.status === 'Active', status: u.status, jobTitle: u.jobTitle, managerId: u.managerId,
          roles, isAdministrator,
          effectivePermissions: isAdministrator ? allPermissionCodes : [...new Set(roles.flatMap((c) => permsByRole.get(c) || []))].sort(),
          dataScope: widestScope(dataScopes), dataScopes,
          branches: scope.branches, departments: scope.departments,
          ownership: { ...o, ownsOpenWork },
          adminOwner: isAdministrator && ownsOpenWork,
        });
      }
    }

    const roles = roleRecords.map((r) => {
      const holders = users.filter((u) => u.roles.includes(r.code) && (!r.organizationId || u.organizationId === r.organizationId));
      return {
        id: r.id, code: r.code, name: r.name, status: r.status, organizationId: r.organizationId,
        scope: r.organizationId ? 'tenant' : 'shared', permissions: [...r.permissionCodes].sort(),
        userCount: holders.length, activeUserCount: holders.filter((u) => u.active).length,
      };
    });

    const data = {
      generatedAt: new Date().toISOString(),
      source: 'cli',
      organizationIds: organizations.map((o) => o.id),
      summary: {
        roleCount: roles.length,
        userCount: users.length,
        activeUserCount: users.filter((u) => u.active).length,
        administratorCount: users.filter((u) => u.isAdministrator).length,
        adminOwnerCount: users.filter((u) => u.adminOwner).length,
        usersOwningOpenWork: users.filter((u) => u.ownership.ownsOpenWork).length,
      },
      roles,
      users,
    };

    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'roles-users-grants.json');
    const csvPath = path.join(outDir, 'roles-users-grants.csv');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    fs.writeFileSync(csvPath, toCsv(data));
    console.log(JSON.stringify({ jsonPath, csvPath, ...data.summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
