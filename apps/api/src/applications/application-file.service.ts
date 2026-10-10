import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { JOINING_CHECK_LABELS, JOINING_CHECK_TYPES, type JoiningCheckType } from './application-gates';

/**
 * B5 follow-ups on the application file: follow-up date (owner only), typed joining
 * checks (gate 4 reads them), and the documents list for the file card (metadata only).
 * Owner signals on this base: primaryRecruiterId, taskOwnerId, the job's PRIMARY assignee.
 * TODO(B1): use file-access.ts ownership once #4 merges.
 */
@Injectable()
export class ApplicationFileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly accessControl: AccessControlService,
  ) {}

  private async visibleApplication(user: AuthUser, id: string) {
    const visibility = await this.accessControl.getApplicationVisibilityWhere(user);
    const app = await this.prisma.application.findFirst({
      where: { AND: [visibility, { id, organizationId: user.organizationId }] },
      select: { id: true, candidateId: true, vacancyId: true, primaryRecruiterId: true, taskOwnerId: true, followUpDate: true },
    });
    if (!app) throw new NotFoundException('Application not found.');
    return app;
  }

  async setFollowUp(user: AuthUser, id: string, followUpDate: string | null) {
    const app = await this.visibleApplication(user, id);
    const primary = await this.prisma.vacancyAssignment.findMany({ where: { vacancyId: app.vacancyId, isActive: true, assignmentKind: 'PRIMARY' }, select: { userId: true } });
    const owners = new Set([app.primaryRecruiterId, app.taskOwnerId, ...primary.map((p) => p.userId)].filter(Boolean));
    if (!owners.has(user.userId)) throw new ForbiddenException({ code: 'FOLLOW_UP_NOT_OWNER', message: 'Only the owner of this file can change its follow-up date.' });
    let date: Date | null = null;
    if (followUpDate !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate) || Number.isNaN(Date.parse(`${followUpDate}T00:00:00Z`))) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'followUpDate must be YYYY-MM-DD or null.' });
      }
      date = new Date(`${followUpDate}T00:00:00Z`);
    }
    const updated = await this.prisma.application.update({ where: { id }, data: { followUpDate: date }, select: { id: true, followUpDate: true } });
    return { id: updated.id, followUpDate: updated.followUpDate ? updated.followUpDate.toISOString().slice(0, 10) : null };
  }

  async listJoiningChecks(user: AuthUser, id: string) {
    await this.visibleApplication(user, id);
    const rows = await this.prisma.joiningCheck.findMany({ where: { applicationId: id }, include: { verifiedBy: { select: { id: true, displayName: true } } } });
    return JOINING_CHECK_TYPES.map((type) => {
      const r = rows.find((x) => x.type === type);
      return {
        type, label: JOINING_CHECK_LABELS[type], verified: r?.verified ?? false,
        verifiedBy: r?.verifiedBy ? { id: r.verifiedBy.id, name: r.verifiedBy.displayName } : null,
        verifiedAt: r?.verifiedAt?.toISOString() ?? null, documentId: r?.documentId ?? null,
      };
    });
  }

  async setJoiningCheck(user: AuthUser, id: string, typeRaw: string, input: { verified: boolean; documentId?: string | null }) {
    const type = typeRaw.toUpperCase() as JoiningCheckType;
    if (!JOINING_CHECK_TYPES.includes(type)) throw new BadRequestException({ code: 'JOINING_CHECK_TYPE_INVALID', message: `type must be one of ${JOINING_CHECK_TYPES.join(', ')}.` });
    const app = await this.visibleApplication(user, id);
    if (input.documentId) {
      const doc = await this.prisma.candidateDocument.findFirst({ where: { id: input.documentId, candidateId: app.candidateId, organizationId: user.organizationId, deletedAt: null }, select: { id: true } });
      if (!doc) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'documentId must be a document of this candidate.' });
    }
    const verified = Boolean(input.verified);
    const data = { verified, verifiedById: verified ? user.userId : null, verifiedAt: verified ? new Date() : null, ...(input.documentId !== undefined ? { documentId: input.documentId } : {}) };
    await this.prisma.joiningCheck.upsert({ where: { applicationId_type: { applicationId: id, type } }, create: { applicationId: id, type, ...data }, update: data });
    return this.listJoiningChecks(user, id);
  }

  /** Metadata only (no contents, no storage keys). */
  async listDocuments(user: AuthUser, id: string) {
    const app = await this.visibleApplication(user, id);
    const docs = await this.prisma.candidateDocument.findMany({
      where: { candidateId: app.candidateId, organizationId: user.organizationId, deletedAt: null },
      select: { id: true, documentType: true, fileName: true, createdAt: true, uploadedBy: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, type: d.documentType, name: d.fileName, uploadedAt: d.createdAt.toISOString(), uploadedBy: d.uploadedBy ? { id: d.uploadedBy.id, name: d.uploadedBy.displayName } : null }));
  }
}
