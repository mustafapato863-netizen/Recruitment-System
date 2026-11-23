import { describe, expect, it, vi } from 'vitest';

// The generated Prisma client (database/generated/client) is absent when the
// Prisma engines cannot be downloaded; stub the package entry so the import
// in prisma.service.ts resolves. The service under test receives a mocked
// PrismaService, so this stub is never instantiated.
vi.mock('@recruitflow/database', () => ({
  PrismaClient: class MockPrismaClient {
    async $disconnect(): Promise<void> {}
  },
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { PrismaService } from '../../database/prisma.service';
import type { RolesService } from '../../roles/roles.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const MANAGER_ID = 'manager-1';
const ROLE_ADMIN = { id: 'role-admin', code: 'ADMINISTRATOR', name: 'Administrator', status: 'Active', organizationId: null };
const ROLE_RECRUITER = { id: 'role-rec', code: 'RECRUITER', name: 'Recruiter', status: 'Active', organizationId: null };

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'a@sgh.com',
    emailNormalized: 'a@sgh.com',
    displayName: 'User One',
    jobTitle: null,
    status: 'Active',
    organizationId: ORG,
    managerId: null,
    branchId: null,
    branch: null,
    directReports: [],
    userRoles: [],
    passwordHash: null,
    tokenVersion: 0,
    mustChangePassword: false,
    passwordChangedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(seedUsers: Array<Record<string, unknown>> = []) {
  const users = new Map<string, Record<string, unknown>>();
  for (const seed of seedUsers) users.set(seed['id'] as string, { ...seed });
  const rolesById = new Map([ROLE_ADMIN, ROLE_RECRUITER].map((role) => [role.id, role]));

  const findFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    if (typeof where['id'] === 'string') {
      const row = users.get(where['id']);
      if (!row) return null;
      if (where['organizationId'] && row['organizationId'] !== where['organizationId']) return null;
      if (where['status'] && row['status'] !== where['status']) return null;
      return row;
    }
    if (typeof where['emailNormalized'] === 'string') {
      for (const row of users.values()) {
        if (row['organizationId'] === where['organizationId'] && row['emailNormalized'] === where['emailNormalized']) {
          return row;
        }
      }
      return null;
    }
    return null;
  });
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row = {
      id: 'user-new',
      ...data,
      branch: null,
      directReports: [],
      userRoles: [],
      lastLoginAt: null,
      tokenVersion: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    users.set(row.id as string, row);
    return row;
  });
  const update = vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const row = users.get(where['id'] as string);
    if (!row) throw new Error('user not found');
    if (typeof data['passwordHash'] === 'string') row['passwordHash'] = data['passwordHash'];
    const increment = (data['tokenVersion'] as { increment?: number } | undefined)?.increment;
    if (typeof increment === 'number') {
      const current = typeof row['tokenVersion'] === 'number' ? row['tokenVersion'] : 0;
      row['tokenVersion'] = current + increment;
    }
    if ('mustChangePassword' in data) row['mustChangePassword'] = data['mustChangePassword'];
    if (data['passwordChangedAt'] instanceof Date) row['passwordChangedAt'] = data['passwordChangedAt'];
    row['updatedAt'] = new Date();
    return row;
  });
  const createMany = vi.fn(async ({ data }: { data: Array<{ userId: string; roleId: string }> }) => {
    for (const link of data) {
      const row = users.get(link.userId);
      const role = rolesById.get(link.roleId);
      if (row && role) {
        const userRoles = row['userRoles'] as Array<{ role: { id: string; code: string; name: string } }>;
        userRoles.push({ role: { id: role.id, code: role.code, name: role.name } });
      }
    }
    return { count: data.length };
  });
  const roleFindMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const all = [ROLE_ADMIN, ROLE_RECRUITER];
    if (Array.isArray((where['code'] as { in?: string[] } | undefined)?.in)) {
      const codes = (where['code'] as { in: string[] }).in;
      return all.filter((role) => codes.includes(role.code) && role.status === 'Active');
    }
    if (Array.isArray((where['id'] as { in?: string[] } | undefined)?.in)) {
      const ids = (where['id'] as { in: string[] }).in;
      return all.filter((role) => ids.includes(role.id) && role.status === 'Active');
    }
    return [];
  });
  const branchFindFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    where['id'] === 'branch-1' && where['organizationId'] === ORG ? { id: 'branch-1' } : null,
  );
  const prisma = {
    user: { findFirst, create, update },
    branch: { findFirst: branchFindFirst },
    role: { findMany: roleFindMany },
    userRole: { createMany },
  } as unknown as PrismaService;
  const permissions = {
    getPermissionSet: vi.fn().mockResolvedValue(new Set<string>()),
    hasPermission: vi.fn(),
  } as unknown as UserPermissionsService;
  const service = new UsersService(prisma, {} as RolesService, permissions);
  return { service, users, findFirst, create, update, createMany, roleFindMany, branchFindFirst };
}

function weakPasswordResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'WEAK_PASSWORD' });
}

describe('UsersService.create with strong passwords', () => {
  it('creates a user with role codes + role ids, manager, and mustChangePassword defaulting to true', async () => {
    const { service, create, createMany } = createService([
      userRow({ id: MANAGER_ID, email: 'boss@sgh.com', emailNormalized: 'boss@sgh.com' }),
    ]);
    const result = await service.create(ORG, {
      email: 'new@example.com',
      displayName: 'New User',
      password: 'Str0ng!Pass',
      roles: ['administrator'],
      roleIds: [ROLE_RECRUITER.id],
      managerId: MANAGER_ID,
      branchId: 'branch-1',
    });

    expect(result.managerId).toBe(MANAGER_ID);
    expect(result.branchId).toBe('branch-1');
    expect(result.mustChangePassword).toBe(true);
    expect(result.roles.map((role) => role.code).sort()).toEqual(['ADMINISTRATOR', 'RECRUITER']);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data).toMatchObject({
      emailNormalized: 'new@example.com',
      mustChangePassword: true,
      passwordChangedAt: null,
      managerId: MANAGER_ID,
    });
    expect(createMany).toHaveBeenCalledOnce();
    const assigned = createMany.mock.calls[0][0].data as Array<{ roleId: string }>;
    expect(assigned.map((link) => link.roleId).sort()).toEqual(['role-admin', 'role-rec']);
  });

  it('honours an explicit mustChangePassword: false', async () => {
    const { service } = createService();
    const result = await service.create(ORG, {
      email: 'new@example.com',
      displayName: 'New User',
      password: 'Str0ng!Pass',
      mustChangePassword: false,
    });
    expect(result.mustChangePassword).toBe(false);
  });

  it('rejects a weak password with WEAK_PASSWORD and creates nothing', async () => {
    const { service, create } = createService();
    const error = await service
      .create(ORG, { email: 'new@example.com', displayName: 'New User', password: 'weakpass1' })
      .catch((reason: unknown) => reason);
    weakPasswordResponse(error);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email in the same org (case-insensitive) with EMAIL_ALREADY_EXISTS', async () => {
    const { service, create } = createService([
      userRow({ id: 'user-dup', email: 'Dup@Example.com', emailNormalized: 'dup@example.com' }),
    ]);
    const error = await service
      .create(ORG, { email: 'DUP@example.com', displayName: 'Dup', password: 'Str0ng!Pass' })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
    expect(create).not.toHaveBeenCalled();
  });

  it('allows the same email in a different org', async () => {
    const { service } = createService([
      userRow({ id: 'user-dup', email: 'dup@example.com', emailNormalized: 'dup@example.com', organizationId: OTHER_ORG }),
    ]);
    const result = await service.create(ORG, {
      email: 'dup@example.com',
      displayName: 'Dup',
      password: 'Str0ng!Pass',
    });
    expect(result.email).toBe('dup@example.com');
  });

  it('rejects a manager from another organization', async () => {
    const { service } = createService([
      userRow({ id: 'manager-other', email: 'other@sgh.com', emailNormalized: 'other@sgh.com', organizationId: OTHER_ORG }),
    ]);
    await expect(
      service.create(ORG, {
        email: 'new@example.com',
        displayName: 'New User',
        password: 'Str0ng!Pass',
        managerId: 'manager-other',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown role codes and unknown role ids', async () => {
    const { service } = createService();
    await expect(
      service.create(ORG, { email: 'n@example.com', displayName: 'N', password: 'Str0ng!Pass', roles: ['NOPE'] }),
    ).rejects.toThrow('unavailable');
    await expect(
      service.create(ORG, { email: 'n@example.com', displayName: 'N', password: 'Str0ng!Pass', roleIds: ['role-ghost'] }),
    ).rejects.toThrow('unavailable');
  });
});

describe('UsersService.adminChangePassword', () => {
  it('sets a strong password, bumps tokenVersion, stamps passwordChangedAt, and forces a change by default', async () => {
    const { service, update } = createService([
      userRow({ id: 'user-1', tokenVersion: 2, mustChangePassword: true }),
    ]);
    const result = await service.adminChangePassword(ORG, 'user-1', { password: 'N3w!Strong' });

    expect(result.mustChangePassword).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data['tokenVersion']).toEqual({ increment: 1 });
    expect(data['mustChangePassword']).toBe(true);
    expect(data['passwordChangedAt']).toBeInstanceOf(Date);
    expect(typeof data['passwordHash']).toBe('string');
  });

  it('honours requireChangeOnNextLogin: false', async () => {
    const { service } = createService([userRow({ id: 'user-1', tokenVersion: 2 })]);
    const result = await service.adminChangePassword(ORG, 'user-1', {
      password: 'N3w!Strong',
      requireChangeOnNextLogin: false,
    });
    expect(result.mustChangePassword).toBe(false);
  });

  it('rejects a weak password with WEAK_PASSWORD and updates nothing', async () => {
    const { service, update } = createService([userRow({ id: 'user-1' })]);
    const error = await service
      .adminChangePassword(ORG, 'user-1', { password: 'weak' })
      .catch((reason: unknown) => reason);
    weakPasswordResponse(error);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 404 for a user in another organization (tenant isolation)', async () => {
    const { service, update } = createService([
      userRow({ id: 'user-1', organizationId: OTHER_ORG }),
    ]);
    const error = await service
      .adminChangePassword(ORG, 'user-1', { password: 'N3w!Strong' })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
