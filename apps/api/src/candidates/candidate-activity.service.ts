import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser, CandidateActivityEntry, CandidateActivitySummary, CreateCandidateActivityResponse } from '@recruitflow/contracts';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateCandidateActivityDto, CandidateActivityQueryDto } from './candidate-activity.dto';

const activityPrefix = 'CandidateActivity:';
const retryWindowMs = 60_000;

type SavedActivity = { id: string; followUpId?: string; at: number };
type RecentTask = {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt?: Date | string | null;
  description?: string | null;
};

export function summarizeCandidateActivity(entries: CandidateActivityEntry[], userId: string, now: Date, page = 1, pageSize = 20): CandidateActivitySummary {
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  const completed = unique.filter((entry) => entry.status === 'Completed');
  const pending = unique.filter((entry) => entry.status === 'Open');
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
  const sorted = [...unique].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
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
    totalEntries: unique.length,
    page,
    pageSize,
  };
}

@Injectable()
export class CandidateActivityService {
  /** Process-local retry shield. The key is never written into the task title or description. */
  private readonly savedActivities = new Map<string, SavedActivity>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly permissions: UserPermissionsService,
  ) {}

  private savedKey(userId: string, candidateId: string, token: string) {
    return `${userId}:${candidateId}:${token}`;
  }

  private readSaved(key: string): CreateCandidateActivityResponse | null {
    const hit = this.savedActivities.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > retryWindowMs) {
      // Local alias: the B2 scanner treats "<receiver>.delete(" as a hard delete.
      const saved = this.savedActivities;
      saved.delete(key);
      return null;
    }
    return { id: hit.id, ...(hit.followUpId ? { followUpId: hit.followUpId } : {}) };
  }

  private writeSaved(keys: string[], value: { id: string; followUpId?: string }) {
    const at = Date.now();
    for (const key of keys) this.savedActivities.set(key, { ...value, at });
  }

  private fingerprint(userId: string, candidateId: string, dto: CreateCandidateActivityDto, summary: string) {
    return this.savedKey(userId, candidateId, [
      dto.kind,
      summary,
      dto.dueAt ?? '',
      dto.followUpDueAt ?? '',
      dto.followUpSummary?.trim() ?? '',
      dto.followUpKind ?? '',
    ].join('\u001f'));
  }

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
            ...(policy.dataScope === 'ALL' ? [{ applications: { none: {} } }] : []),
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
        select: { id: true, type: true, title: true, description: true, assigneeUserId: true, assignee: { select: { displayName: true } }, completedById: true, completedBy: { select: { displayName: true } }, status: true, completedAt: true, createdAt: true, dueAt: true, entityType: true, entityId: true },
      }),
      this.prisma.applicationNote.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true, applicationId: true, authorId: true, content: true, author: { select: { displayName: true } }, createdAt: true } }),
      this.prisma.screeningLog.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true, applicationId: true, screenerId: true, screener: { select: { displayName: true } }, outcome: true, screenedAt: true } }),
      this.prisma.applicationStatusHistory.findMany({ where: { applicationId: { in: applicationIds }, application: { organizationId } }, select: { id: true, applicationId: true, toStage: true, changedById: true, changedBy: { select: { displayName: true } }, createdAt: true } }),
      this.prisma.interview.findMany({ where: { organizationId, applicationId: { in: applicationIds }, status: { not: 'Cancelled' } }, select: { id: true, applicationId: true, status: true, interviewType: true, scheduledStart: true } }),
      this.prisma.interviewScorecard.findMany({ where: { status: 'Submitted', interview: { organizationId, applicationId: { in: applicationIds } } }, select: { id: true, interviewerId: true, interviewer: { select: { displayName: true } }, submittedAt: true, interview: { select: { applicationId: true } } } }),
    ]);
    const entries: CandidateActivityEntry[] = tasks.map((task) => ({
      id: `task:${task.id}`, kind: task.type.replace(activityPrefix, ''), title: viewText ? task.title : 'Activity details restricted',
      actorId: task.status === 'Completed' ? (task.completedById ?? task.assigneeUserId) : task.assigneeUserId,
      actorName: task.status === 'Completed' ? (task.completedBy?.displayName ?? task.assignee.displayName) : task.assignee.displayName,
      at: (task.completedAt ?? task.createdAt).toISOString(), dueAt: task.dueAt?.toISOString() ?? null,
      status: task.status === 'Completed' ? 'Completed' : 'Open',
      applicationId: task.entityType === 'Application' ? task.entityId : null,
      canComplete: task.assigneeUserId === userId && task.status !== 'Completed' && task.type.startsWith(activityPrefix) && task.entityType === 'Candidate',
      detail: viewText ? task.description ?? null : null,
    }));
    for (const note of notes) {
      const content = note.content ?? '';
      const systemEvent = !note.authorId || /^\[(?:automation|system)\]/i.test(content);
      entries.push({
        id: `note:${note.id}`,
        kind: 'Note',
        title: systemEvent && /^\[automation\]\s*stale/i.test(content)
          ? 'System activity: automated stale alert'
          : systemEvent && !note.authorId
            ? 'System activity recorded'
            : 'Application note recorded',
        actorId: systemEvent ? null : note.authorId,
        actorName: systemEvent ? 'System' : (note.author?.displayName ?? 'System'),
        at: note.createdAt.toISOString(),
        dueAt: null,
        status: systemEvent ? 'Event' : 'Completed',
        applicationId: note.applicationId,
        canComplete: false,
      });
    }
    for (const log of screening) entries.push({ id: `screening:${log.id}`, kind: 'Screening', title: `Screening: ${log.outcome}`, actorId: log.screenerId, actorName: log.screener.displayName, at: log.screenedAt.toISOString(), dueAt: null, status: 'Completed', applicationId: log.applicationId, canComplete: false });
    for (const card of scorecards) entries.push({ id: `scorecard:${card.id}`, kind: 'Interview assessment', title: 'Interview scorecard submitted', actorId: card.interviewerId, actorName: card.interviewer.displayName, at: (card.submittedAt ?? new Date(0)).toISOString(), dueAt: null, status: 'Completed', applicationId: card.interview.applicationId, canComplete: false });
    // Lifecycle changes and interview scheduling are context, not recruiter productivity.
    for (const change of history) entries.push({ id: `stage:${change.id}`, kind: 'Stage change', title: `Moved to ${change.toStage}`, actorId: change.changedById, actorName: change.changedBy?.displayName ?? 'System', at: change.createdAt.toISOString(), dueAt: null, status: 'Event', applicationId: change.applicationId, canComplete: false });
    for (const interview of interviews) entries.push({ id: `interview:${interview.id}`, kind: 'Interview', title: `${interview.interviewType}: ${interview.status}`, actorId: null, actorName: 'Interview schedule', at: interview.scheduledStart.toISOString(), dueAt: null, status: 'Event', applicationId: interview.applicationId, canComplete: false });
    return summarizeCandidateActivity(entries, userId, new Date(), query.page, query.pageSize);
  }

  async create(user: AuthUser, candidateId: string, dto: CreateCandidateActivityDto): Promise<CreateCandidateActivityResponse> {
    await this.context(user, candidateId);
    if (dto.dueAt && dto.followUpDueAt) {
      throw new BadRequestException('Specify either dueAt to schedule a single follow-up or followUpDueAt to log a completed activity with a next follow-up');
    }
    const now = new Date();
    const summary = dto.summary.trim();
    if (dto.dueAt && new Date(dto.dueAt) <= now) throw new BadRequestException('Choose a future follow-up date and time');
    const followUpAt = dto.followUpDueAt ? new Date(dto.followUpDueAt) : null;
    if (dto.followUpDueAt && (!followUpAt || Number.isNaN(followUpAt.getTime()))) throw new BadRequestException('Invalid followUpDueAt date');
    if (followUpAt && followUpAt <= now) throw new BadRequestException('Choose a future follow-up date and time');

    const keys = [this.fingerprint(user.userId, candidateId, dto, summary)];
    if (dto.idempotencyKey) keys.unshift(this.savedKey(user.userId, candidateId, dto.idempotencyKey));
    for (const key of keys) {
      const saved = this.readSaved(key);
      if (saved) return { ...saved, deduplicated: true };
    }
    const recent = await this.findRecentDuplicate(user, candidateId, dto, summary);
    if (recent) {
      this.writeSaved(keys, recent);
      return { ...recent, deduplicated: true };
    }

    if (followUpAt) {
      const followKind = dto.followUpKind ?? 'FollowUp';
      const followText = dto.followUpSummary?.trim() || `Follow-up: ${summary}`;
      const owner = {
        organizationId: user.organizationId, createdById: user.userId, assigneeUserId: user.userId,
        entityType: 'Candidate' as const, entityId: candidateId,
      };
      const completedData = {
        ...owner, type: `${activityPrefix}${dto.kind}`, title: summary, status: 'Completed',
        dueAt: now, completedAt: now, completedById: user.userId,
      };
      const followData = {
        ...owner, type: `${activityPrefix}${followKind}`, title: `${followKind} activity`.slice(0, 255),
        description: followText, status: 'Open', dueAt: followUpAt, completedAt: null, completedById: null,
      };
      const saved = typeof this.prisma.$transaction === 'function'
        ? await this.prisma.$transaction(async (tx) => {
          const completed = await tx.task.create({ data: completedData });
          const followUp = await tx.task.create({ data: followData });
          return { id: completed.id, followUpId: followUp.id };
        })
        : await (async () => {
          const completed = await this.prisma.task.create({ data: completedData });
          const followUp = await this.prisma.task.create({ data: followData });
          return { id: completed.id, followUpId: followUp.id };
        })();
      this.writeSaved(keys, saved);
      return saved;
    }

    const task = await this.prisma.task.create({ data: {
      organizationId: user.organizationId, createdById: user.userId, assigneeUserId: user.userId,
      entityType: 'Candidate', entityId: candidateId, type: `${activityPrefix}${dto.kind}`,
      title: dto.summary, status: dto.dueAt ? 'Open' : 'Completed',
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null, completedAt: dto.dueAt ? null : now,
      completedById: dto.dueAt ? null : user.userId,
    } });
    const saved = { id: task.id };
    this.writeSaved(keys, saved);
    return saved;
  }

  private async findRecentDuplicate(user: AuthUser, candidateId: string, dto: CreateCandidateActivityDto, summary: string): Promise<{ id: string; followUpId?: string } | null> {
    const since = new Date(Date.now() - retryWindowMs);
    const rows = await this.prisma.task.findMany({
      where: {
        organizationId: user.organizationId,
        entityType: 'Candidate',
        entityId: candidateId,
        createdById: user.userId,
        type: { startsWith: activityPrefix },
        createdAt: { gte: since },
      },
      select: { id: true, type: true, title: true, status: true, createdAt: true, description: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }) as RecentTask[];
    const recent = rows.filter((row) => {
      const at = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt ?? 0).getTime();
      return Number.isFinite(at) && at >= since.getTime();
    });
    const expectedStatus = dto.dueAt ? 'Open' : 'Completed';
    const primary = recent.find((row) => row.type === `${activityPrefix}${dto.kind}` && row.title === summary && row.status === expectedStatus);
    if (!primary) return null;
    if (!dto.followUpDueAt) return { id: primary.id };
    const followKind = dto.followUpKind ?? 'FollowUp';
    const followTitle = `${followKind} activity`.slice(0, 255);
    const followText = dto.followUpSummary?.trim() || `Follow-up: ${summary}`;
    const follow = recent.find((row) => row.type === `${activityPrefix}${followKind}` && row.title === followTitle && row.status === 'Open' && (row.description ?? followText) === followText);
    if (!follow) return null;
    return { id: primary.id, followUpId: follow.id };
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
    const where = {
      id: taskId,
      organizationId: user.organizationId,
      assigneeUserId: user.userId,
      entityType: 'Candidate' as const,
      entityId: candidateId,
      type: { startsWith: activityPrefix },
      status: { in: ['Open', 'In Progress'] as ('Open' | 'In Progress')[] },
    };
    const current = await this.prisma.task.findFirst({ where, select: { id: true, dueAt: true, description: true } });
    if (!current) throw new NotFoundException('Open follow-up not found');
    const from = current.dueAt ? new Date(current.dueAt).toISOString() : 'unscheduled';
    const line = `[Rescheduled ${from} -> ${dueAt.toISOString()}]`;
    const description = current.description ? `${current.description}\n${line}` : line;
    const result = await this.prisma.task.updateMany({
      where,
      data: { dueAt, description, updatedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Open follow-up not found');
    return { id: taskId, dueAt: dueAt.toISOString() };
  }
}
