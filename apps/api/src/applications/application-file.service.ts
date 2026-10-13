import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JOINING_CHECK_LABELS } from './application-gates';
import { complianceNameForCheck, invalidateStaleApproval, isJoiningCheckType, resolveSnapshot } from '../hiring/joining-policy';

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
    @Optional() @Inject(AuditService) private readonly audit?: AuditService,
    @Optional() @Inject(NotificationsService) private readonly notifications?: NotificationsService,
  ) {}

  private async visibleApplication(user: AuthUser, id: string) {
    const visibility = await this.accessControl.getApplicationVisibilityWhere(user);
    const app = await this.prisma.application.findFirst({
      where: { AND: [visibility, { id, organizationId: user.organizationId }] },
      select: {
        id: true, candidateId: true, vacancyId: true, primaryRecruiterId: true, taskOwnerId: true, followUpDate: true,
        hiringCase: { select: { requirementSnapshot: true } },
        vacancy: { select: { position: { select: { metadata: true } } } },
      },
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
    const app = await this.visibleApplication(user, id);
    const required = resolveSnapshot(app.hiringCase?.requirementSnapshot, app.vacancy.position?.metadata).checks;
    const rows = await this.prisma.joiningCheck.findMany({ where: { applicationId: id }, include: { verifiedBy: { select: { id: true, displayName: true } } } });
    return required.map((type) => {
      const r = rows.find((x) => x.type === type);
      return {
        type, label: JOINING_CHECK_LABELS[type], verified: r?.verified ?? false,
        verifiedBy: r?.verifiedBy ? { id: r.verifiedBy.id, name: r.verifiedBy.displayName } : null,
        verifiedAt: r?.verifiedAt?.toISOString() ?? null, documentId: r?.documentId ?? null,
        expiryDate: r?.expiryDate?.toISOString() ?? null,
      };
    });
  }

  async setJoiningCheck(user: AuthUser, id: string, typeRaw: string, input: { verified: boolean; documentId?: string | null; expiryDate?: string | null }) {
    const type = typeRaw.toUpperCase();
    if (!isJoiningCheckType(type)) throw new BadRequestException({ code: 'JOINING_CHECK_TYPE_INVALID', message: 'type must be one of ID, CONTRACT, SCFHS_LICENCE.' });
    const app = await this.visibleApplication(user, id);
    const required = resolveSnapshot(app.hiringCase?.requirementSnapshot, app.vacancy.position?.metadata).checks;
    if (!required.includes(type)) {
      throw new BadRequestException({ code: 'JOINING_CHECK_NOT_REQUIRED', message: `${JOINING_CHECK_LABELS[type]} is not required for this job profile.` });
    }
    if (input.documentId) {
      const doc = await this.prisma.candidateDocument.findFirst({ where: { id: input.documentId, candidateId: app.candidateId, organizationId: user.organizationId, deletedAt: null }, select: { id: true } });
      if (!doc) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'documentId must be a document of this candidate.' });
    }
    const verified = Boolean(input.verified);
    const data = {
      verified,
      verifiedById: verified ? user.userId : null,
      verifiedAt: verified ? new Date() : null,
      ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
      ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate ? new Date(input.expiryDate) : null } : {}),
    };
    let invalidated = false;
    await this.prisma.$transaction(async (tx) => {
      await tx.joiningCheck.upsert({ where: { applicationId_type: { applicationId: id, type } }, create: { applicationId: id, type, ...data }, update: data });
      const hiringCase = await tx.hiringCase.findFirst({ where: { applicationId: id }, select: { id: true } });
      if (hiringCase) {
        await tx.complianceRequirement.updateMany({
          where: { hiringCaseId: hiringCase.id, name: complianceNameForCheck(type) },
          data: {
            status: verified ? 'Verified' : 'Pending',
            verifiedById: verified ? user.userId : null,
            verifiedAt: verified ? new Date() : null,
            ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate ? new Date(input.expiryDate) : null } : {}),
          },
        });
      }
      invalidated = await invalidateStaleApproval(tx, id);
    });
    if (invalidated) {
      void this.audit?.log({ organizationId: user.organizationId, actorUserId: user.userId, action: 'HIRING_APPROVAL_INVALIDATED', entityType: 'Application', entityId: id, result: 'Success', reason: 'A joining check changed after final approval.' });
    }
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

  /**
   * Versions, stored-file flag, download events and requests. Storage keys stay on the server.
   * Metadata-only rows are returned as history without invented bytes.
   */
  async documentHistory(user: AuthUser, id: string) {
    const app = await this.visibleApplication(user, id);
    const docs = await this.prisma.candidateDocument.findMany({
      where: { candidateId: app.candidateId, organizationId: user.organizationId, deletedAt: null },
      select: {
        id: true, documentType: true, fileName: true, fileSize: true, scanStatus: true,
        storageKey: true, storageProvider: true, createdAt: true,
        uploadedBy: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const versions = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const doc of docs) {
      const next = (seen.get(doc.documentType) ?? 0) + 1;
      seen.set(doc.documentType, next);
      versions.set(doc.id, next);
    }
    const ids = docs.map((doc) => doc.id);
    const [downloads, requests] = await Promise.all([
      ids.length === 0 ? Promise.resolve([]) : this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId, action: 'DOCUMENT_DOWNLOAD', entityType: 'CandidateDocument', entityId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        select: { entityId: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId, action: 'DOCUMENT_REQUEST', entityType: 'Application', entityId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, reason: true, createdAt: true },
      }),
    ]);
    return {
      documents: [...docs].reverse().map((doc) => ({
        id: doc.id,
        type: doc.documentType,
        name: doc.fileName,
        uploadedAt: doc.createdAt.toISOString(),
        uploadedBy: doc.uploadedBy ? { id: doc.uploadedBy.id, name: doc.uploadedBy.displayName } : null,
        hasFile: storedFile(doc.storageKey, doc.storageProvider),
        scanStatus: doc.scanStatus,
        fileSize: doc.fileSize,
        version: versions.get(doc.id) ?? 1,
        downloads: downloads.filter((row) => row.entityId === doc.id).map((row) => ({ at: row.createdAt.toISOString() })),
      })),
      requests: requests.map((row) => ({ id: row.id, documentType: row.reason ?? 'Document', at: row.createdAt.toISOString() })),
    };
  }

  async requestDocument(user: AuthUser, id: string, documentType: string) {
    await this.visibleApplication(user, id);
    const type = documentType.trim();
    if (type.length < 2 || type.length > 60) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Name the document in 2 to 60 characters.' });
    }
    const row = await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: 'DOCUMENT_REQUEST',
        entityType: 'Application',
        entityId: id,
        result: 'Requested',
        reason: type,
        afterData: { documentType: type } satisfies Prisma.InputJsonObject,
      },
    });
    if (this.notifications) {
      await this.notifications.create({
        organizationId: user.organizationId,
        recipientUserId: user.userId,
        type: 'DocumentRequested',
        title: 'Document requested',
        message: `${type} was requested on this file.`,
        entityType: 'Application',
        entityId: id,
      }).catch(() => undefined);
    }
    return { id: row.id, documentType: type, at: row.createdAt.toISOString() };
  }
}

function storedFile(storageKey: string, storageProvider: string): boolean {
  return storageProvider !== 'metadata-only' && !storageKey.startsWith('metadata-only/');
}
