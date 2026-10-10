import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import type { PrismaService } from '../../../database/prisma.service';
import type { AccessControlService } from '../../access-control.service';
import { AccessExportController } from '../access-export.controller';
import { AccessExportService } from '../access-export.service';
import { accessExportToCsv, buildAccessExport } from '../access-export.builder';

const ORG = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '10000000-0000-4000-8000-0000000000a1';
const RECRUITER_ID = '10000000-0000-4000-8000-0000000000b1';

const SECRET_MARKERS = ['$2a$10$secret-hash', 'refresh-token-value', 'auth-token-hash', 'jwt-secret'];
const FORBIDDEN_KEYS = ['passwordHash', 'tokenHash', 'tokenVersion', 'authTokens', 'refreshToken', 'password', 'secret'];

function makePrisma() {
  // The mock deliberately returns secret-bearing columns even though the
  // service selects fields explicitly: the export must still never echo them.
  const users = [
    {
      id: ADMIN_ID, organizationId: ORG, displayName: 'System Administrator', email: 'admin@sgh.com', status: 'Active',
      jobTitle: null, managerId: null, passwordHash: SECRET_MARKERS[0], tokenVersion: 7,
      authTokens: [{ tokenHash: SECRET_MARKERS[2] }], refreshToken: SECRET_MARKERS[1],
      userRoles: [{ role: { code: 'ADMINISTRATOR' } }],
    },
    {
      id: RECRUITER_ID, organizationId: ORG, displayName: 'Mariam Farag', email: 'mariam@sgh.com', status: 'Active',
      jobTitle: 'Recruiter', managerId: ADMIN_ID, passwordHash: SECRET_MARKERS[0], tokenVersion: 1,
      userRoles: [{ role: { code: 'RECRUITER' } }],
    },
  ];
  return {
    role: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'r1', code: 'ADMINISTRATOR', name: 'Administrator', status: 'Active', organizationId: null,
          permissions: [{ permission: { code: 'ROLES_MANAGE' } }, { permission: { code: 'USERS_MANAGE' } }, { permission: { code: 'VIEW_CURRENT_SALARY' } }] },
        { id: 'r2', code: 'RECRUITER', name: 'Recruiter', status: 'Active', organizationId: null,
          permissions: [{ permission: { code: 'APPLICATION_VIEW' } }] },
      ]),
    },
    user: { findMany: vi.fn().mockResolvedValue(users) },
    vacancy: {
      // B1 owner column, active PRIMARY assignment (same job counted once), and a support link.
      findMany: vi.fn().mockResolvedValue([
        { primaryRecruiterId: ADMIN_ID, assignments: [{ userId: ADMIN_ID, assignmentKind: 'PRIMARY' }] },
        { primaryRecruiterId: ADMIN_ID, assignments: [{ userId: RECRUITER_ID, assignmentKind: 'SUPPORT' }] },
      ]),
    },
    vacancyRequest: { groupBy: vi.fn().mockResolvedValue([{ requesterId: RECRUITER_ID, _count: { _all: 3 } }]) },
    application: {
      groupBy: vi.fn().mockImplementation(({ by }: { by: string[] }) =>
        Promise.resolve(by[0] === 'primaryRecruiterId'
          ? [{ primaryRecruiterId: ADMIN_ID, _count: { _all: 5 } }]
          : [{ taskOwnerId: RECRUITER_ID, _count: { _all: 4 } }])),
    },
  };
}

function makeService(prisma = makePrisma()) {
  const accessControl = {
    resolveDataScopesForUser: vi.fn().mockImplementation((_org: string, userId: string) =>
      Promise.resolve(userId === RECRUITER_ID
        ? { scopes: ['ALL'], responsibility: { branches: ['OFFSHORE'], departments: ['IT'] } }
        : { scopes: ['ALL'], responsibility: undefined })),
  };
  return { service: new AccessExportService(prisma as unknown as PrismaService, accessControl as unknown as AccessControlService), prisma };
}

describe('AccessExportService', () => {
  it('exports roles with permissions and holder counts, and users with grants, scope and ownership', async () => {
    const { service, prisma } = makeService();
    const data = await service.exportForOrganization(ORG);

    expect(data.summary).toMatchObject({ roleCount: 2, userCount: 2, administratorCount: 1, adminOwnerCount: 1 });
    expect(data.roles.find((r) => r.code === 'RECRUITER')).toMatchObject({ permissions: ['APPLICATION_VIEW'], userCount: 1 });

    const admin = data.users.find((u) => u.id === ADMIN_ID)!;
    expect(admin).toMatchObject({ isAdministrator: true, dataScope: 'ALL', adminOwner: true, active: true });
    expect(admin.ownership).toMatchObject({ openJobsPrimary: 2, openApplicationsPrimary: 5, ownsOpenWork: true });
    expect(admin.effectivePermissions).toContain('APPLICATION_VIEW');

    const recruiter = data.users.find((u) => u.id === RECRUITER_ID)!;
    expect(recruiter).toMatchObject({
      name: 'Mariam Farag', email: 'mariam@sgh.com', roles: ['RECRUITER'], effectivePermissions: ['APPLICATION_VIEW'],
      dataScope: 'ALL', branches: ['OFFSHORE'], departments: ['IT'], adminOwner: false,
    });
    expect(recruiter.ownership).toMatchObject({ openJobsSupport: 1, openRequisitions: 3, openApplicationsTaskOwner: 4 });

    // The user query must select fields explicitly and never ask for secrets.
    const select = prisma.user.findMany.mock.calls[0][0].select as Record<string, unknown>;
    expect(select).not.toHaveProperty('passwordHash');
    expect(select).not.toHaveProperty('tokenVersion');
    expect(select).not.toHaveProperty('authTokens');
  });

  it('never includes password hashes, tokens, refresh tokens or secrets in JSON or CSV', async () => {
    const { service } = makeService();
    const data = await service.exportForOrganization(ORG);
    const json = JSON.stringify(data);
    const csv = accessExportToCsv(data);
    for (const marker of SECRET_MARKERS) {
      expect(json).not.toContain(marker);
      expect(csv).not.toContain(marker);
    }
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) { keys.add(key); walk(inner); }
      }
    };
    walk(data);
    for (const key of FORBIDDEN_KEYS) expect(keys.has(key)).toBe(false);
    const header = csv.split('\n')[0]!.split(',');
    for (const key of FORBIDDEN_KEYS) expect(header).not.toContain(key);
  });
});

describe('accessExportToCsv', () => {
  it('writes role and user rows and neutralises formula injection', () => {
    const csv = accessExportToCsv(buildAccessExport({
      source: 'test',
      roles: [{ id: 'r', code: 'X', name: '=HYPERLINK("x")', status: 'Active', organizationId: null, permissionCodes: [] }],
      users: [],
    }));
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('AccessExportController authorization', () => {
  function guardFor(roleCode: string, permissions: string[], handler: 'exportJson' | 'exportCsv') {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          userRoles: [{ role: { code: roleCode, permissions: permissions.map((code) => ({ permission: { code } })) } }],
        }),
      },
    };
    const guard = new PermissionsGuard(new Reflector(), prisma as unknown as PrismaService);
    const context = {
      getHandler: () => AccessExportController.prototype[handler],
      getClass: () => AccessExportController,
      switchToHttp: () => ({ getRequest: () => ({ user: { userId: RECRUITER_ID, organizationId: ORG } }) }),
    };
    return guard.canActivate(context as never);
  }

  it.each(['exportJson', 'exportCsv'] as const)('returns 403 to a non-admin on %s', async (handler) => {
    await expect(guardFor('RECRUITER', ['APPLICATION_VIEW', 'VIEW_CANDIDATE_PII'], handler)).rejects.toBeInstanceOf(ForbiddenException);
    // HR managers can manage users but not roles, so they are still refused.
    await expect(guardFor('HR_MANAGER', ['USERS_MANAGE', 'ROLES_VIEW'], handler)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['exportJson', 'exportCsv'] as const)('allows the Administrator on %s', async (handler) => {
    await expect(guardFor('ADMINISTRATOR', [], handler)).resolves.toBe(true);
  });
});
