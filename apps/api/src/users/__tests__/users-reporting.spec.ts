import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { PrismaService } from '../../database/prisma.service';
import type { RolesService } from '../../roles/roles.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import { normalizeUserIdentity } from '../../common/user-name-normalization';

const ORG = 'org-1';

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'a@sgh.com',
    displayName: 'User One',
    jobTitle: null,
    status: 'Active',
    organizationId: ORG,
    managerId: null,
    branchId: null,
    branch: null,
    directReports: [],
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    userRoles: [],
    ...overrides,
  };
}

function createService(options: {
  users?: Record<string, Record<string, unknown>>;
  permissions?: string[];
} = {}) {
  const usersById = new Map(Object.entries(options.users ?? {}));
  const findFirst = vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    const row = usersById.get(where['id'] as string);
    if (!row && where['id'] === 'user-1') return Promise.resolve(userRow());
    if (!row || row['organizationId'] !== ORG) return Promise.resolve(null);
    if (where['status'] && row['status'] !== where['status']) return Promise.resolve(null);
    return Promise.resolve(row);
  });
  const findMany = vi.fn().mockResolvedValue([]);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const branchFindFirst = vi.fn();
  const roleFindMany = vi.fn();
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    user: { findFirst, findMany, updateMany },
    branch: { findFirst: branchFindFirst },
    role: { findMany: roleFindMany },
    userRole: { deleteMany, createMany },
  } as unknown as PrismaService;
  (prisma as unknown as { $transaction: unknown }).$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));
  const permissions = {
    getPermissionSet: vi.fn().mockResolvedValue(new Set(options.permissions ?? [])),
    hasPermission: vi.fn(),
  } as unknown as UserPermissionsService;
  const service = new UsersService(prisma, {} as RolesService, permissions);
  return { service, findFirst, findMany, updateMany, permissions, branchFindFirst, roleFindMany, deleteMany, createMany };
}

describe('UsersService reporting lines', () => {
  it('rejects reporting to yourself', async () => {
    const { service } = createService({ users: { 'user-1': userRow() } });
    await expect(service.update(ORG, 'user-1', { managerId: 'user-1' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown or inactive manager', async () => {
    const { service } = createService({ users: { 'user-1': userRow() } });
    await expect(service.update(ORG, 'user-1', { managerId: 'ghost' })).rejects.toThrow(
      'not an active user in this organization',
    );
  });

  it('rejects a circular reporting chain', async () => {
    const { service } = createService({
      users: {
        'user-1': userRow({ id: 'user-1' }),
        'user-2': userRow({ id: 'user-2', managerId: 'user-1' }),
      },
    });
    await expect(service.update(ORG, 'user-1', { managerId: 'user-2' })).rejects.toThrow('circular');
  });

  it('clears the link when managerId is null', async () => {
    const { service, updateMany } = createService({
      users: { 'user-1': userRow({ id: 'user-1', managerId: 'user-2' }), 'user-2': userRow({ id: 'user-2' }) },
    });
    const result = await service.update(ORG, 'user-1', { managerId: null });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', organizationId: ORG },
      data: expect.objectContaining({ managerId: null }),
    });
    expect(result.managerId).toBe('user-2');
  });

  it('returns managerId on list records', async () => {
    const { service, findMany } = createService();
    findMany.mockResolvedValue([userRow({ id: 'user-9', managerId: 'user-2' })]);
    const [record] = await service.list(ORG);
    expect(record.managerId).toBe('user-2');
  });

  it('lists only people who report to the caller, including indirect reports', async () => {
    const rows = [
      userRow({ id: 'lead-1', displayName: 'Lead' }),
      userRow({ id: 'member-1', displayName: 'Member', managerId: 'lead-1' }),
      userRow({ id: 'nested-1', displayName: 'Nested', managerId: 'member-1' }),
      userRow({ id: 'test-fixture', displayName: 'Test fixture', emailNormalized: 'test@t.test', managerId: 'lead-1' }),
      userRow({ id: 'other-1', displayName: 'Other', managerId: 'boss-2' }),
    ];
    const { service, findMany } = createService({ permissions: ['USERS_MANAGE', 'VACANCY_MANAGE'] });
    findMany.mockResolvedValue(rows);
    const result = await service.listAssignable(ORG, 'lead-1');
    expect(result.map((user) => user.id).sort()).toEqual(['member-1', 'nested-1']);
  });
});

describe('UsersService identity, branch, role, and directory behavior', () => {
  it('normalizes honorifics, trailing roles, and abbreviations', () => {
    expect(normalizeUserIdentity('Dr. Hassan Ali')).toEqual({ displayName: 'Hassan Ali', jobTitle: null });
    expect(normalizeUserIdentity('Omar Hassan (Hiring Mgr)')).toEqual({
      displayName: 'Omar Hassan',
      jobTitle: 'Hiring Manager',
    });
    expect(normalizeUserIdentity('Prof. Lady (Recruiter)', 'HR Mgr')).toEqual({
      displayName: 'Lady',
      jobTitle: 'Recruiter',
    });
    expect(normalizeUserIdentity('John (Jack)', 'HR Mgr')).toEqual({
      displayName: 'John (Jack)',
      jobTitle: 'HR Manager',
    });
  });

  it('rejects branches from another organization', async () => {
    const { service, branchFindFirst } = createService();
    branchFindFirst.mockResolvedValue(null);
    await expect(service.update(ORG, 'user-1', { branchId: '00000000-0000-4000-8000-000000000099' })).rejects.toThrow(
      'not in this organization',
    );
  });

  it('accepts a branch in the organization', async () => {
    const { service, branchFindFirst, updateMany } = createService();
    branchFindFirst.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000099' });
    await service.update(ORG, 'user-1', { branchId: '00000000-0000-4000-8000-000000000099' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ branchId: '00000000-0000-4000-8000-000000000099' }),
    }));
  });

  it('rejects inactive, unknown, or cross-tenant role IDs', async () => {
    const { service, roleFindMany } = createService();
    roleFindMany.mockResolvedValue([{ id: 'role-1' }]);
    await expect(service.update(ORG, 'user-1', { roleIds: ['role-1', 'role-other'] })).rejects.toThrow(
      'inactive or unavailable',
    );
  });

  it('atomically replaces roles and returns updated roles', async () => {
    const roleId = '00000000-0000-4000-8000-000000000001';
    const { service, roleFindMany, deleteMany, createMany } = createService({
      users: {
        'user-1': userRow({
          id: 'user-1',
          userRoles: [{ role: { id: roleId, code: 'RECRUITER', name: 'Recruiter' } }],
        }),
      },
    });
    roleFindMany.mockResolvedValue([{ id: roleId }]);
    const result = await service.update(ORG, 'user-1', { roleIds: [roleId] });
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId }],
      skipDuplicates: true,
    });
    expect(result.roles).toHaveLength(1);
  });

  it('filters R8 admin and t.test fixture accounts from both user list modes', async () => {
    const r8Admin = userRow({
      id: 'r8-admin',
      displayName: 'R8 Admin',
      emailNormalized: 'r8-admin@recruitflow.local',
    });
    const testDomain = userRow({
      id: 'test-domain',
      displayName: 'Fixture User',
      emailNormalized: 'fixture@t.test',
    });
    const regular = userRow({ id: 'regular', displayName: 'Regular User', emailNormalized: 'user@example.com' });
    const { service, findMany } = createService();
    findMany.mockResolvedValue([r8Admin, testDomain, regular]);

    expect((await service.list(ORG)).map((u) => u.id)).toEqual(['regular']);
    expect((await service.list(ORG, true)).map((u) => u.id)).toEqual(['regular']);
  });
});
