import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser, CandidateActivityEntry, CandidateActivitySummary } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateCandidateActivityDto, CandidateActivityQueryDto } from './candidate-activity.dto';

const activityPrefix = 'CandidateActivity:';

export function summarizeCandidateActivity(entries: CandidateActivityEntry[], userId: string, now: Date, page = 1, pageSize = 20): CandidateActivitySummary {
  const completed = entries.filter((entry) => entry.status === 'Completed');
  const pending = entries.filter((entry) => entry.status === 'Open');
  const byKind: Record<string, number> = {};
  const recruiters = new Map<string, { userId: string; name: string; completed: number }>();
  for (const entry of completed) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    if (entry.actorId) {
      const row = recruiters.get(entry.actorId) ?? { userId: entry.actorId, name: entry.actorName, completed: 0 };
      row.completed += 1;
      recruiters.set(entry.actorId, row);
    }
  }
  const dates = pending.flatMap((entry) => entry.dueAt ? [entry.dueAt] : []).sort();
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return {
    completed: completed.length,
    completedByMe: completed.filter((entry) => entry.actorId === userId).length,
    pending: pending.length,
    overdue: pending.filter((entry) => entry.dueAt && new Date(entry.dueAt) < now).length,
    lastActivityAt: completed.map((entry) => entry.at).sort().at(-1) ?? null,
    nextFollowUpAt: dates[0] ?? null,
    byKind,
    byRecruiter: [...recruiters.values()].sort((a, b) => b.completed - a.completed),
    entries: sorted.slice((page - 1) * pageSize, page * pageSize),
    totalEntries: entries.length,
    page,
    pageSize,
  };
}

@Injectable()
export class CandidateActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly permissions: UserPermissionsService,
  ) {}

  private async context(user: AuthUser, candidateId: string) {
    const { organizationId, userId } = user;
    const [policy, permissions] = await Promise.all([
      this.access.getUserEffectiveScope(organizationId, userId, user.roleCodes),
      this.permissions.getPermissionSet(userId, organizationId),
    ]);
    const visibilityBuilder = this.access as unknown as {
      getApplicationVisibilityWhere?: (context: AuthUser) => Promise<Prisma.ApplicationWhereInput>;
    };
    const applicationVisibility = visibilityBuilder.getApplicationVisibilityWhere
      ? await visibilityBuilder.getApplicationVisibilityWhere(user)
      : this.fallbackApplicationVisibility(user, policy);
    const canUseAllCandidateRows = user.roleCodes.includes('ADMINISTRATOR');
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId,
        ...(canUseAllCandidateRows ? {} : {
          OR: [
            { createdById: userId },
            { applications: { some: applicationVisibility } },
          ],
        }),
      },
      select: { id: true, createdById: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    const where: Prisma.ApplicationWhereInput = { ...applicationVisibility, candidateId };
    const applications = await this.prisma.application.findMany({ where, select: { id: true } });
    if (policy.dataScope !== 'ALL' && applications.length === 0 && candidate.createdById !== userId) {
      throw new NotFoundException('Candidate not found in your assigned scope');
    }
    return { applicationIds: permissions.has('APPLICATION_VIEW') ? applications.map((app) => app.id) : [], viewText: policy.canViewPii && permissions.has('VIEW_CANDIDATE_PII'), permissions };
  }

  private fallbackApplicationVisibility(user: AuthUser, policy: { dataScope: string }): Prisma.ApplicationWhereInput {
    if (policy.dataScope === 'ALL') return { organizationId: user.organizationId };
    if (policy.dataScope === 'ASSIGNED_ONLY') {
      return { organizationId: user.organizationId, OR: [
        { primaryRecruiterId: user.userId },
        { taskOwnerId: user.userId },
        { vacancy: { assignments: { some: { userId: user.userId, isActive: true } } } },
      ] };
    }
    // Unit-test doubles that predate the shared builder use a fail-closed scope.
    return { organizationId: user.organizationId, vacancy: policy.dataScope === 'BRANCH'
      ? { branch: { OR: [{ id: { in: [] } }, { code: { in: [] } }] } }
      : { department: { in: [] } } };
  }

  async list(user: AuthUser, candidateId: string, query: CandidateActivityQueryDto): Promise<CandidateActivitySummary> {
    const { applicationIds, viewText, permissions } = await this.context(user, candidateId);
    const { organizationId, userId } = user;
    const [tasks, notes, screening, history, interviews, scorecards] = await Promise.all([
      this.prisma.task.findMany({
        where: { organizationId, status: { in: ['Open', 'In Progress', 'Completed'] }, OR: [
          { entityType: 'Candidate', entityId: candidateId, type: { startsWith: activityPrefix } },
          ...(permissions.has('TASK_VIEW') ? [{ assigneeUserId: userId, OR: [
            { entityType: 'Candidate', entityId: candidateId },
            { entityType: 'Application', entityId: { in: applicationIds } },
          ] }] : []),
        ] },
        select: { id: true, type: true, title: true, assigneeUserId: true, assignee: { select: { displayName: true } }, completedById: true, completedBy: { select: { displayName: true } }, status: true, completedAt: true, createdAt: true, dueAt: true, entityType: true, entityId: true },
      }),
      this.prisma.applicationNote.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true, applicationId: true, authorId: true, author: { select: { displayName: true } }, createdAt: true } }),
      this.prisma.screeningLog.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true, applicationId: true, screenerId: true, screener: { select: { displayName: true } }, outcome: true, screenedAt: true } }),
      this.prisma.applicationStatusHistory.findMany({ where: { applicationId: { in: applicationIds }, application: { organizationId } }, select: { id: true, applicationId: true, toStage: true, changedById: true, changedBy: { select: { displayName: true } }, createdAt: true } }),
      this.prisma.interview.findMany({ where: { organizationId, applicationId: { in: applicationIds }, status: { not: 'Cancelled' } }, select: { id: true, applicationId: true, status: true, interviewType: true, scheduledStart: true } }),
      this.prisma.interviewScorecard.findMany({ where: { isLocked: true, interview: { organizationId, applicationId: { in: applicationIds } } }, select: { id: true, interviewerId: true, interviewer: { select: { displayName: true } }, submittedAt: true, interview: { select: { applicationId: true } } } }),
    ]);
    const entries: CandidateActivityEntry[] = tasks.map((task) => ({
      id: `task:${task.id}`, kind: task.type.replace(activityPrefix, ''), title: viewText ? task.title : 'Activity details restricted',
      actorId: task.status === 'Completed' ? (task.completedById ?? task.assigneeUserId) : task.assigneeUserId,
      actorName: task.status === 'Completed' ? (task.completedBy?.displayName ?? task.assignee.displayName) : task.assignee.displayName,
      at: (task.completedAt ?? task.createdAt).toISOString(), dueAt: task.dueAt?.toISOString() ?? null,
      status: task.status === 'Completed' ? 'Completed' : 'Open',
      applicationId: task.entityType === 'Application' ? task.entityId : null,
      canComplete: task.assigneeUserId === userId && task.status !== 'Completed' && task.type.startsWith(activityPrefix) && task.entityType === 'Candidate',
    }));
    for (const note of notes) entries.push({ id: `note:${note.id}`, kind: 'Note', title: 'Application note recorded', actorId: note.authorId, actorName: note.author?.displayName ?? 'System', at: note.createdAt.toISOString(), dueAt: null, status: note.authorId ? 'Completed' : 'Event', applicationId: note.applicationId, canComplete: false });
    for (const log of screening) entries.push({ id: `screening:${log.id}`, kind: 'Screening', title: `Screening: ${log.outcome}`, actorId: log.screenerId, actorName: log.screener.displayName, at: log.screenedAt.toISOString(), dueAt: null, status: 'Completed', applicationId: log.applicationId, canComplete: false });
    for (const card of scorecards) entries.push({ id: `scorecard:${card.id}`, kind: 'Interview assessment', title: 'Interview scorecard submitted', actorId: card.interviewerId, actorName: card.interviewer.displayName, at: card.submittedAt.toISOString(), dueAt: null, status: 'Completed', applicationId: card.interview.applicationId, canComplete: false });
    // Lifecycle changes and interview scheduling are context, not recruiter productivity.
    for (const change of history) entries.push({ id: `stage:${change.id}`, kind: 'Stage change', title: `Moved to ${change.toStage}`, actorId: change.changedById, actorName: change.changedBy?.displayName ?? 'System', at: change.createdAt.toISOString(), dueAt: null, status: 'Event', applicationId: change.applicationId, canComplete: false });
    for (const interview of interviews) entries.push({ id: `interview:${interview.id}`, kind: 'Interview', title: `${interview.interviewType}: ${interview.status}`, actorId: null, actorName: 'Interview schedule', at: interview.scheduledStart.toISOString(), dueAt: null, status: 'Event', applicationId: interview.applicationId, canComplete: false });
    return summarizeCandidateActivity(entries, userId, new Date(), query.page, query.pageSize);
  }

  async create(user: AuthUser, candidateId: string, dto: CreateCandidateActivityDto) {
    await this.context(user, candidateId);
    const now = new Date();
    if (dto.dueAt && new Date(dto.dueAt) <= now) throw new BadRequestException('Choose a future follow-up date and time');
    const task = await this.prisma.task.create({ data: {
      organizationId: user.organizationId, createdById: user.userId, assigneeUserId: user.userId,
      entityType: 'Candidate', entityId: candidateId, type: `${activityPrefix}${dto.kind}`,
      title: dto.summary, status: dto.dueAt ? 'Open' : 'Completed',
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null, completedAt: dto.dueAt ? null : now,
      completedById: dto.dueAt ? null : user.userId,
    } });
    return { id: task.id };
  }

  async complete(user: AuthUser, candidateId: string, taskId: string) {
    await this.context(user, candidateId);
    const result = await this.prisma.task.updateMany({
      where: { id: taskId, organizationId: user.organizationId, assigneeUserId: user.userId, entityType: 'Candidate', entityId: candidateId, type: { startsWith: activityPrefix }, status: { in: ['Open', 'In Progress'] } },
      data: { status: 'Completed', completedAt: new Date(), completedById: user.userId },
    });
    if (!result.count) {
      const completed = await this.prisma.task.findFirst({ where: { id: taskId, organizationId: user.organizationId, assigneeUserId: user.userId, entityType: 'Candidate', entityId: candidateId, type: { startsWith: activityPrefix }, status: 'Completed' }, select: { id: true } });
      if (!completed) throw new NotFoundException('Open follow-up not found');
    }
    return { id: taskId };
  }

  async reschedule(user: AuthUser, candidateId: string, taskId: string, dueAtInput: string) {
    await this.context(user, candidateId);
    const dueAt = new Date(dueAtInput);
    if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) {
      throw new BadRequestException('Choose a future follow-up date and time');
    }
    const result = await this.prisma.task.updateMany({
      where: {
        id: taskId,
        organizationId: user.organizationId,
        assigneeUserId: user.userId,
        entityType: 'Candidate',
        entityId: candidateId,
        type: { startsWith: activityPrefix },
        status: { in: ['Open', 'In Progress'] },
      },
      data: { dueAt, updatedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Open follow-up not found');
    return { id: taskId, dueAt: dueAt.toISOString() };
  }
}
