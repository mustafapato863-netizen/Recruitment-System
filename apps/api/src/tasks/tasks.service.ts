import { Inject, Injectable, NotFoundException, Optional, ForbiddenException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto } from './tasks.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { TaskRecord, PaginatedResult } from '@recruitflow/contracts';
import type { AuthUser } from '@recruitflow/contracts';
import { AccessControlService } from '../access-control/access-control.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
  ) {}

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
      data: { status, completedAt, completedById: status === 'Completed' ? assigneeUserId : null, updatedAt: now },
    });
    return this.toRecord(updated, now);
  }

  async create(organizationId: string, createdById: string, dto: CreateTaskDto, user?: AuthUser): Promise<TaskRecord> {
    const [assignee, reference] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: dto.assigneeUserId, organizationId, status: 'Active' }, select: { id: true } }),
      this.resolveReference(organizationId, dto.entityType, dto.entityId, user),
    ]);
    if (!assignee) throw new NotFoundException('Task assignee is not an active user in this organization.');
    if (dto.entityType && !dto.entityId) throw new NotFoundException('A linked task entity must include an identifier.');
    if (dto.entityId && !reference) throw new NotFoundException('The linked task entity was not found in this organization.');

    const now = new Date();
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
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
      await tx.notification.create({
        data: {
          organizationId,
          recipientUserId: dto.assigneeUserId,
          type: 'TaskAssigned',
          title: 'New task assigned: ' + dto.title,
          message: dto.description || `You have been assigned a new task: ${dto.title}`,
          entityType: 'Task',
          entityId: created.id,
        },
      });
      return created;
    });

    return this.toRecord(task, now);
  }

  private async resolveReference(organizationId: string, entityType?: string, entityId?: string, user?: AuthUser) {
    if (!entityType && !entityId) return true;
    if (!entityType || !entityId) return false;
    switch (entityType) {
      case 'Candidate':
        return this.prisma.candidate.findFirst({
          where: user && this.accessControl
            ? { id: entityId, ...(await this.accessControl.getCandidateVisibilityWhere(user)) }
            : { id: entityId, organizationId },
          select: { id: true },
        });
      case 'Application':
        return this.prisma.application.findFirst({
          where: user && this.accessControl
            ? { id: entityId, ...(await this.accessControl.getApplicationVisibilityWhere(user)) }
            : { id: entityId, organizationId },
          select: { id: true },
        });
      case 'Vacancy':
        return this.prisma.vacancy.findFirst({
          where: user && this.accessControl
            ? { id: entityId, ...(await this.accessControl.getVacancyVisibilityWhere(user)) }
            : { id: entityId, organizationId },
          select: { id: true },
        });
      case 'Interview':
        return this.prisma.interview.findFirst({
          where: user && this.accessControl
            ? { id: entityId, organizationId, application: await this.accessControl.getApplicationVisibilityWhere(user) }
            : { id: entityId, organizationId },
          select: { id: true },
        });
      case 'Offer':
        return this.prisma.offer.findFirst({
          where: user && this.accessControl
            ? { id: entityId, organizationId, application: await this.accessControl.getApplicationVisibilityWhere(user) }
            : { id: entityId, organizationId },
          select: { id: true },
        });
      case 'HiringCase':
        return this.prisma.hiringCase.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
      case 'VacancyRequest':
        return this.prisma.vacancyRequest.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
      case 'CandidateDocument':
        return this.prisma.candidateDocument.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
      case 'ComplianceRequirement':
        return this.prisma.complianceRequirement.findFirst({ where: { id: entityId, hiringCase: { organizationId } }, select: { id: true } });
      case 'HiringCaseApproval':
        return this.prisma.hiringCaseApproval.findFirst({ where: { id: entityId, hiringCase: { organizationId } }, select: { id: true } });
      case 'Task':
        return this.prisma.task.findFirst({ where: { id: entityId, organizationId }, select: { id: true } });
      default:
        throw new NotFoundException(`Unsupported task entity type: ${entityType}`);
    }
  }

  private toRecord(t: {
    id: string;
    organizationId: string;
    assigneeUserId: string;
    createdById: string;
    completedById: string | null;
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
      completedById: t.completedById,
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
