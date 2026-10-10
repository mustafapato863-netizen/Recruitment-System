import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { escalatedManagers, fileOwnerIds, isAdmin } from './file-ownership';
import { resolveJobStatusReason } from '../vacancy-core/vacancy-lifecycle';

/** A file is open until it reaches an exit stage; closed files never move (v2 §7 Reassign). */
export const CLOSED_FILE_STAGES = ['Joined', 'Rejected', 'Withdrawn'];

export interface ReassignInput { applicationIds?: string[]; fromUserId?: string; toUserId: string; reason: string; note?: string }

/**
 * Files only (v2 §7): the job and its owner (Vacancy primary assignee / primaryRecruiterId) never move.
 * B7 reassign: the manager moves OPEN files owned by a direct report to another active,
 * non-admin user, with a reason. Admin never can (403). Atomic: all files move or none.
 * Owner field on this base: Application.primaryRecruiterId.
 * TODO(B1): also move Vacancy.primaryRecruiterId-derived ownership once #4 merges.
 * TODO(B2): this is what clears B2's deactivation 409 (open files owned) once #6 merges.
 */
@Injectable()
export class ReassignService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async reassign(user: AuthUser, input: ReassignInput) {
    if (isAdmin(user.roleCodes)) throw new ForbiddenException({ code: 'REASSIGN_ADMIN_FORBIDDEN', message: 'Administrators cannot reassign files; the owner\'s manager does. Use the admin override (POST /admin/overrides/file-reassign).' });
    return this.run(user, input, false);
  }

  /**
   * B9 admin override file.reassign: admin-only, same rules as the manager reassign (reason from master data,
   * open files only, atomic, target must be an active NON-admin user, so admins can't become owners),
   * except the "you must be the owner's manager" check. Writes FILE_REASSIGN rows plus one ADMIN_OVERRIDE audit row.
   */
  async adminOverride(user: AuthUser, input: ReassignInput) {
    if (!isAdmin(user.roleCodes)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only an administrator can use an override.' });
    return this.run(user, input, true);
  }

  private async run(user: AuthUser, input: ReassignInput, override: boolean) {
    if (!input.reason?.trim()) throw new BadRequestException({ code: 'REASSIGN_REASON_REQUIRED', message: 'A reason is required to reassign files.' });
    // M2-M4: the reason comes from master data 'reassign-reasons' ("Other" needs a note), like hold/close reasons.
    const reason = await resolveJobStatusReason(this.prisma, user.organizationId, 'reassign-reasons', input.reason, input.note);
    const byIds = Array.isArray(input.applicationIds) && input.applicationIds.length > 0;
    if (byIds === Boolean(input.fromUserId)) throw new BadRequestException({ code: 'REASSIGN_SCOPE', message: 'Give either applicationIds or fromUserId (all open files of that user).' });

    const target = await this.prisma.user.findFirst({
      where: { id: input.toUserId, organizationId: user.organizationId },
      select: { id: true, status: true, displayName: true, userRoles: { where: { role: { status: 'Active' } }, select: { role: { select: { code: true } } } } },
    });
    if (!target || target.status !== 'Active' || target.userRoles.some((r) => r.role.code === 'ADMINISTRATOR')) {
      throw new BadRequestException({ code: 'REASSIGN_TARGET_INELIGIBLE', message: 'The new owner must be an active, non-admin user in this organization.' });
    }

    const files = await this.prisma.application.findMany({
      where: { organizationId: user.organizationId, ...(byIds ? { id: { in: [...new Set(input.applicationIds)] } } : { primaryRecruiterId: input.fromUserId!, stage: { notIn: CLOSED_FILE_STAGES } }) },
      select: { id: true, applicationCode: true, stage: true, vacancyId: true, primaryRecruiterId: true, taskOwnerId: true, primaryRecruiter: { select: { managerId: true } } },
    });
    if (byIds && files.length !== new Set(input.applicationIds).size) throw new BadRequestException({ code: 'REASSIGN_FILE_NOT_FOUND', message: 'One or more files were not found.' });
    const closed = files.filter((f) => CLOSED_FILE_STAGES.includes(f.stage));
    if (closed.length) throw new ConflictException({ code: 'REASSIGN_FILE_CLOSED', message: 'Closed files do not move.', applicationIds: closed.map((f) => f.id) });
    // The reassigning manager is the (escalated) manager of the file's owner (primaryRecruiterId):
    // a manager who also owns the file is skipped and their own manager decides (same rule as offers).
    const notMine: typeof files = [];
    for (const f of override ? [] : files) {
      if (!f.primaryRecruiterId) { notMine.push(f); continue; }
      const owners = await fileOwnerIds(this.prisma, f);
      if (owners.includes(user.userId) || !(await escalatedManagers(this.prisma, [f.primaryRecruiterId], owners)).has(user.userId)) notMine.push(f);
    }
    if (notMine.length) throw new ForbiddenException({ code: 'REASSIGN_NOT_MANAGER', message: 'You can only reassign files owned by your direct reports.', applicationIds: notMine.map((f) => f.id) });
    const moving = files.filter((f) => f.primaryRecruiterId !== target.id);

    const batchId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      for (const f of moving) {
        const res = await tx.application.updateMany({ where: { id: f.id, primaryRecruiterId: f.primaryRecruiterId, stage: { notIn: CLOSED_FILE_STAGES } }, data: { primaryRecruiterId: target.id } });
        if (res.count !== 1) throw new ConflictException({ code: 'REASSIGN_CONFLICT', message: `File ${f.applicationCode} changed while reassigning; nothing was moved.` });
      }
      if (moving.length) {
        await tx.fileReassignment.createMany({ data: moving.map((f) => ({ organizationId: user.organizationId, applicationId: f.id, fromUserId: f.primaryRecruiterId, toUserId: target.id, reason, reassignedById: user.userId, batchId })) });
        if (override) {
          await tx.auditLog.create({ data: { action: 'ADMIN_OVERRIDE', actorUserId: user.userId, organizationId: user.organizationId, entityType: 'FileReassignmentBatch', entityId: batchId, result: 'Success', reason,
            beforeData: { action: 'file.reassign', owners: moving.map((f) => ({ applicationId: f.id, ownerId: f.primaryRecruiterId })) }, afterData: { action: 'file.reassign', toUserId: target.id } } });
        }
        await tx.auditLog.createMany({ data: moving.map((f) => ({ action: 'FILE_REASSIGN', actorUserId: user.userId, organizationId: user.organizationId, entityType: 'Application', entityId: f.id, result: 'SUCCESS', reason: `${f.primaryRecruiterId} -> ${target.id}: ${reason}` })) });
      }
    });

    // In-app notifications after commit (old owners and the new owner).
    const byOld = new Map<string, number>();
    for (const f of moving) byOld.set(f.primaryRecruiterId!, (byOld.get(f.primaryRecruiterId!) ?? 0) + 1);
    const notes = [
      ...[...byOld.entries()].map(([recipientUserId, n]) => ({ recipientUserId, title: 'Files reassigned away from you', message: `${n} open file(s) moved to ${target.displayName}. Reason: ${reason}` })),
      ...(moving.length ? [{ recipientUserId: target.id, title: 'Files reassigned to you', message: `${moving.length} open file(s) are now yours. Reason: ${reason}` }] : []),
    ];
    for (const n of notes) {
      await this.notifications.create({ organizationId: user.organizationId, type: 'FileReassigned', entityType: 'FileReassignmentBatch', entityId: batchId, ...n }).catch(() => undefined);
    }
    return { batchId, toUserId: target.id, moved: moving.map((f) => ({ applicationId: f.id, fromUserId: f.primaryRecruiterId })), unchanged: files.filter((f) => !moving.includes(f)).map((f) => f.id) };
  }
}
