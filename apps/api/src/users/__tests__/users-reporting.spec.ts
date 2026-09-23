import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { PrismaService } from '../../database/prisma.service';
import type { RolesService } from '../../roles/roles.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';

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
    if (!row || row['organizationId'] !== ORG) return Promise.resolve(null);
    if (where['status'] && row['status'] !== where['status']) return Promise.resolve(null);
    return Promise.resolve(row);
  });
  const findMany = vi.fn().mockResolvedValue([]);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const prisma = { user: { findFirst, findMany, updateMany } } as unknown as PrismaService;
  const permissions = {
    getPermissionSet: vi.fn().mockResolvedValue(new Set(options.permissions ?? [])),
    hasPermission: vi.fn(),
  } as unknown as UserPermissionsService;
  const service = new UsersService(prisma, {} as RolesService, permissions);
  return { service, findFirst, findMany, updateMany, permissions };
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
      userRow({ id: 'other-1', displayName: 'Other', managerId: 'boss-2' }),
    ];
    const { service, findMany } = createService({ permissions: ['USERS_MANAGE', 'VACANCY_MANAGE'] });
    findMany.mockResolvedValue(rows);
    const result = await service.listAssignable(ORG, 'lead-1');
    expect(result.map((user) => user.id).sort()).toEqual(['member-1', 'nested-1']);
  });
});
