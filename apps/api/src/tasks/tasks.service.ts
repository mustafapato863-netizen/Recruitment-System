import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto } from './tasks.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { TaskRecord, PaginatedResult } from '@recruitflow/contracts';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    assigneeUserId: string,
    opts: {
      status?: string;
      priority?: string;
      overdueOnly?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<PaginatedResult<TaskRecord>> {
    const { status, priority, overdueOnly, search, page = 1, pageSize = 20 } = opts;
    const now = new Date();

    const where: Record<string, unknown> = {
      organizationId,
      assigneeUserId,
    };
    if (status) where['status'] = status;
    if (priority) where['priority'] = priority;
    if (overdueOnly) {
      where['dueAt'] = { lt: now };
      where['status'] = { in: ['Open', 'In Progress'] };
    }
    if (search) {
      where['title'] = { contains: search, mode: 'insensitive' };
    }

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: data.map((t) => this.toRecord(t, now)),
      total,
      page,
      pageSize,
    };
  }

  async getOne(organizationId: string, assigneeUserId: string, id: string): Promise<TaskRecord> {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!task) throw new NotFoundException('Task not found');
    // Ownership enforcement: only the assignee or system can view their task
    if (task.assigneeUserId !== assigneeUserId) {
      throw new ForbiddenException('Access denied: task belongs to another user');
    }
    return this.toRecord(task, new Date());
  }

  async updateStatus(
    organizationId: string,
    assigneeUserId: string,
    id: string,
    status: string,
  ): Promise<TaskRecord> {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assigneeUserId !== assigneeUserId) {
      throw new ForbiddenException('Access denied: task belongs to another user');
    }

    const now = new Date();
    const completedAt = status === 'Completed' ? (task.completedAt ?? now) : null;

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status, completedAt, updatedAt: now },
    });
    return this.toRecord(updated, now);
  }

  async create(organizationId: string, createdById: string, dto: CreateTaskDto): Promise<TaskRecord> {
    const now = new Date();
    const task = await this.prisma.task.create({
      data: {
        organizationId,
        createdById,
        assigneeUserId: dto.assigneeUserId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'Normal',
        status: 'Open',
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
      },
    });

    await this.prisma.notification.create({
      data: {
        organizationId,
        recipientUserId: dto.assigneeUserId,
        type: 'TaskAssigned',
        title: 'New task assigned: ' + dto.title,
        message: dto.description || `You have been assigned a new task: ${dto.title}`,
        entityType: 'Task',
        entityId: task.id,
      },
    }).catch(() => {});

    return this.toRecord(task, now);
  }

  private toRecord(t: {
    id: string;
    organizationId: string;
    assigneeUserId: string;
    createdById: string;
    type: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    dueAt: Date | null;
    entityType: string | null;
    entityId: string | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }, now: Date): TaskRecord {
    const isOverdue =
      !!t.dueAt &&
      t.dueAt < now &&
      (t.status === 'Open' || t.status === 'In Progress');

    return {
      id: t.id,
      organizationId: t.organizationId,
      assigneeUserId: t.assigneeUserId,
      createdById: t.createdById,
      type: t.type,
      title: t.title,
      description: t.description,
      priority: t.priority as TaskRecord['priority'],
      status: t.status as TaskRecord['status'],
      dueAt: t.dueAt?.toISOString() ?? null,
      entityType: t.entityType,
      entityId: t.entityId,
      completedAt: t.completedAt?.toISOString() ?? null,
      isOverdue,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
