import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TasksService } from '../tasks.service';
import type { PrismaService } from '../../database/prisma.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';

const ORG = 'org-1';
const LEAD = 'lead-1';

function taskRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-09-01T00:00:00.000Z');
  return {
    id: 'task-1',
    organizationId: ORG,
    assigneeUserId: 'member-1',
    createdById: LEAD,
    completedById: null,
    type: 'Screening',
    title: 'Screen 3 candidates',
    description: null,
    priority: 'Normal',
    status: 'Open',
    dueAt: null,
    entityType: null,
    entityId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(options: {
  assignee?: { id: string; managerId: string | null } | null;
  permissions?: string[];
}) {
  const prisma = {
    user: {
      findFirst: vi.fn().mockResolvedValue(options.assignee ?? null),
    },
    task: { create: vi.fn() },
    notification: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        task: { create: vi.fn().mockResolvedValue(taskRow({ assigneeUserId: options.assignee?.id ?? LEAD })) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    }),
  } as unknown as PrismaService;
  const permissions = {
    getPermissionSet: vi.fn().mockResolvedValue(new Set(options.permissions ?? [])),
    hasPermission: vi.fn(),
  } as unknown as UserPermissionsService;
  const service = new TasksService(prisma, undefined, permissions);
  return { service, permissions };
}

const dto = {
  assigneeUserId: 'member-1',
  type: 'Screening',
  title: 'Screen 3 candidates',
};

describe('TasksService team-scoped assignment', () => {
  it('blocks administrators from assigning outside their reporting line', async () => {
    const { service } = createService({
      assignee: { id: 'member-1', managerId: 'other-lead' },
      permissions: ['USERS_MANAGE'],
    });
    await expect(service.create(ORG, 'admin-1', { ...dto })).rejects.toThrow(ForbiddenException);
  });

  it('lets team leaders assign to their direct reports', async () => {
    const { service } = createService({
      assignee: { id: 'member-1', managerId: LEAD },
      permissions: ['VACANCY_ASSIGN'],
    });
    const task = await service.create(ORG, LEAD, { ...dto });
    expect(task.assigneeUserId).toBe('member-1');
  });

  it('lets anyone assign a task to themselves', async () => {
    const { service } = createService({
      assignee: { id: LEAD, managerId: 'other-lead' },
      permissions: [],
    });
    const task = await service.create(ORG, LEAD, { ...dto, assigneeUserId: LEAD });
    expect(task.assigneeUserId).toBe(LEAD);
  });

  it('lets a lead assign through a manager who reports to them', async () => {
    const findFirst = vi.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
      if (where.id === 'member-1') return Promise.resolve({ id: 'member-1', managerId: 'mid-1' });
      if (where.id === 'mid-1') return Promise.resolve({ id: 'mid-1', managerId: LEAD });
      return Promise.resolve(null);
    });
    const prisma = {
      user: { findFirst },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) => {
        const tx = {
          task: { create: vi.fn().mockResolvedValue(taskRow({ assigneeUserId: 'member-1' })) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      }),
    } as unknown as PrismaService;
    const service = new TasksService(prisma, undefined, { getPermissionSet: vi.fn(), hasPermission: vi.fn() } as unknown as UserPermissionsService);
    const task = await service.create(ORG, LEAD, { ...dto });
    expect(task.assigneeUserId).toBe('member-1');
  });

  it('blocks team leaders from assigning outside their team', async () => {
    const { service } = createService({
      assignee: { id: 'member-1', managerId: 'other-lead' },
      permissions: ['VACANCY_ASSIGN'],
    });
    await expect(service.create(ORG, LEAD, { ...dto })).rejects.toThrow(ForbiddenException);
  });
});
