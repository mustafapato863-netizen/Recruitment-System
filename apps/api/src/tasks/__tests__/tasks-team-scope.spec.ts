import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

function serviceFor(row: ReturnType<typeof taskRow> | null) {
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...(row ?? taskRow()), ...data }));
  const prisma = {
    task: {
      findFirst: vi.fn().mockResolvedValue(row),
      update,
    },
  } as unknown as PrismaService;
  return { service: new TasksService(prisma), update };
}

describe('TasksService completion and reschedule', () => {
  it('completes the assignee task and ignores a duplicate completion', async () => {
    const open = taskRow({ assigneeUserId: 'member-1', status: 'Open' });
    const first = serviceFor(open);
    const completed = await first.service.updateStatus(ORG, 'member-1', 'task-1', 'Completed');
    expect(completed.status).toBe('Completed');
    expect(completed.completedById).toBe('member-1');
    expect(completed.completedAt).toEqual(expect.any(String));
    expect(first.update).toHaveBeenCalledTimes(1);
    expect(first.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({ status: 'Completed', completedById: 'member-1', completedAt: expect.any(Date) }),
    });

    const stored = taskRow({
      assigneeUserId: 'member-1',
      status: 'Completed',
      completedAt: new Date('2026-09-02T00:00:00.000Z'),
      completedById: 'original-user',
    });
    const second = serviceFor(stored);
    const again = await second.service.updateStatus(ORG, 'member-1', 'task-1', 'Completed');
    expect(again.completedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(again.completedById).toBe('original-user');
    expect(again.status).toBe('Completed');
    expect(second.update).not.toHaveBeenCalled();
  });

  it('refuses completion and reschedule from someone who is not the assignee', async () => {
    const row = taskRow({ assigneeUserId: 'member-1', status: 'Open' });
    const completion = serviceFor(row);
    await expect(completion.service.updateStatus(ORG, 'stranger', 'task-1', 'Completed')).rejects.toThrow(ForbiddenException);
    expect(completion.update).not.toHaveBeenCalled();

    const move = serviceFor(row);
    await expect(move.service.reschedule(ORG, 'stranger', 'task-1', '2099-06-01T12:00:00.000Z')).rejects.toThrow(ForbiddenException);
    expect(move.update).not.toHaveBeenCalled();
  });

  it('reschedules an open task to a future time and rejects a past, invalid, or closed task', async () => {
    const dueAt = '2099-06-01T12:00:00.000Z';
    const open = serviceFor(taskRow({ assigneeUserId: 'member-1', status: 'Open' }));
    const moved = await open.service.reschedule(ORG, 'member-1', 'task-1', dueAt);
    expect(moved.dueAt).toBe(dueAt);
    expect(open.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { dueAt: new Date(dueAt), updatedAt: expect.any(Date) },
    });

    const stillOpen = serviceFor(taskRow({ assigneeUserId: 'member-1', status: 'In Progress' }));
    await expect(stillOpen.service.reschedule(ORG, 'member-1', 'task-1', '2020-01-01T00:00:00.000Z')).rejects.toThrow(BadRequestException);
    await expect(stillOpen.service.reschedule(ORG, 'member-1', 'task-1', 'not-a-date')).rejects.toThrow('Choose a future follow-up date and time');
    expect(stillOpen.update).not.toHaveBeenCalled();

    const closed = serviceFor(taskRow({ assigneeUserId: 'member-1', status: 'Completed', completedAt: new Date('2026-09-02T00:00:00.000Z'), completedById: 'member-1' }));
    await expect(closed.service.reschedule(ORG, 'member-1', 'task-1', dueAt)).rejects.toThrow('Cannot reschedule a closed task.');
    expect(closed.update).not.toHaveBeenCalled();

    const dismissed = serviceFor(taskRow({ assigneeUserId: 'member-1', status: 'Dismissed' }));
    await expect(dismissed.service.updateStatus(ORG, 'member-1', 'task-1', 'Completed')).rejects.toThrow('Cannot update a closed task.');
    expect(dismissed.update).not.toHaveBeenCalled();

    const updateMany = vi.fn().mockResolvedValueOnce({ count: 0 });
    const findFirst = vi.fn()
      .mockResolvedValueOnce(taskRow({ assigneeUserId: 'member-1', status: 'Open', type: 'CandidateActivity:FollowUp', dueAt: new Date('2099-05-01T12:00:00.000Z'), description: 'Follow up on offer' }))
      .mockResolvedValueOnce(taskRow({ assigneeUserId: 'member-1', status: 'Completed' }));
    const guardedService = new TasksService({ task: { findFirst, updateMany } } as unknown as PrismaService);
    await expect(guardedService.reschedule(ORG, 'member-1', 'task-1', dueAt)).rejects.toThrow('Cannot reschedule a closed task.');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1', organizationId: ORG, assigneeUserId: 'member-1', status: { in: ['Open', 'In Progress'] } },
      data: expect.objectContaining({
        dueAt: new Date(dueAt),
        description: 'Follow up on offer\n[Rescheduled 2099-05-01T12:00:00.000Z -> 2099-06-01T12:00:00.000Z]',
      }),
    }));
  });
});
