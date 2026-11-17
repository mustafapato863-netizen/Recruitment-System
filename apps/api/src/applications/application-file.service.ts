import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JOINING_CHECK_LABELS } from './application-gates';
import { complianceNameForCheck, invalidateStaleApproval, isJoiningCheckType, resolveSnapshot } from '../hiring/joining-policy';
import { readPortalGrants, type PortalTokenPayload } from '../public-jobs/candidate-portal.service';

export const APPLICATION_FOLLOW_UP_TASK_TYPE = 'ApplicationFollowUp';
const PORTAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function portalSecret(): string {
  const configured = process.env.SELF_SCHEDULE_SECRET;
  if (configured && configured.length >= 32) return `portal-v1:${configured}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SELF_SCHEDULE_SECRET must be configured (min 32 chars) in production');
  }
  return 'portal-v1:recruitflow-dev-self-schedule-secret-key-2026';
}

function signPortalToken(payload: PortalTokenPayload): string {
  const dataPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', portalSecret()).update(dataPart).digest('base64url');
  return `${dataPart}.${signature}`;
}

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
        candidate: { select: { firstName: true, lastName: true } },
        hiringCase: { select: { requirementSnapshot: true } },
        vacancy: { select: { vacancyCode: true, position: { select: { title: true, metadata: true } } } },
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
    const syncFollowUp = async (tx: PrismaService | Prisma.TransactionClient) => {
      const updatedApp = await tx.application.update({
        where: { id },
        data: { followUpDate: date },
        select: { id: true, followUpDate: true },
      });
      const taskDelegate = (tx as { task?: PrismaService['task'] }).task;
      if (taskDelegate && typeof taskDelegate.findFirst === 'function') {
        const now = new Date();
        if (date === null) {
          if (typeof taskDelegate.updateMany === 'function') {
            await taskDelegate.updateMany({
              where: {
                organizationId: user.organizationId,
                entityType: 'Application',
                entityId: id,
                type: APPLICATION_FOLLOW_UP_TASK_TYPE,
                status: { in: ['Open', 'In Progress'] },
              },
              data: { status: 'Dismissed', updatedAt: now },
            });
          }
        } else {
          const candName = app.candidate ? `${app.candidate.firstName ?? ''} ${app.candidate.lastName ?? ''}`.trim() : '';
          const jobTitle = app.vacancy?.position?.title ?? app.vacancy?.vacancyCode ?? '';
          const title = candName && jobTitle
            ? `Follow up: ${candName} · ${jobTitle}`
            : candName
              ? `Follow up: ${candName}`
              : 'Application follow-up';
          const existing = await taskDelegate.findFirst({
            where: {
              organizationId: user.organizationId,
              entityType: 'Application',
              entityId: id,
              type: APPLICATION_FOLLOW_UP_TASK_TYPE,
              status: { in: ['Open', 'In Progress'] },
            },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            await taskDelegate.update({
              where: { id: existing.id },
              data: {
                title,
                dueAt: date,
                assigneeUserId: user.userId,
                description: `Application follow-up scheduled for ${followUpDate}`,
                updatedAt: now,
              },
            });
          } else {
            await taskDelegate.create({
              data: {
                organizationId: user.organizationId,
                createdById: user.userId,
                assigneeUserId: user.userId,
                type: APPLICATION_FOLLOW_UP_TASK_TYPE,
                title,
                description: `Application follow-up scheduled for ${followUpDate}`,
                priority: 'Normal',
                status: 'Open',
                dueAt: date,
                entityType: 'Application',
                entityId: id,
              },
            });
          }
        }
      }
      return updatedApp;
    };
    const updated = typeof this.prisma.$transaction === 'function'
      ? await this.prisma.$transaction((tx) => syncFollowUp(tx))
      : await syncFollowUp(this.prisma);
    void this.audit?.log({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      action: 'APPLICATION_FOLLOW_UP_SET',
      entityType: 'Application',
      entityId: id,
      result: 'Success',
      reason: followUpDate ?? 'cleared',
    });
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
          where: { hiringCaseId: hiringCase.id, name: { in: type === 'CONTRACT' ? ['Employment contract', 'Background Check'] : [complianceNameForCheck(type)] } },
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
    const [checks, downloads, requests, candidateRow] = await Promise.all([
      typeof (this.prisma as { joiningCheck?: { findMany?: unknown } }).joiningCheck?.findMany === 'function'
        ? this.prisma.joiningCheck.findMany({
            where: { applicationId: id },
            select: { type: true, verified: true, documentId: true },
          })
        : Promise.resolve([]),
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
      typeof (this.prisma as { candidate?: { findFirst?: unknown } }).candidate?.findFirst === 'function'
        ? this.prisma.candidate.findFirst({
            where: { id: app.candidateId, organizationId: user.organizationId },
            select: { metadata: true },
          })
        : Promise.resolve(null),
    ]);
    const { grants } = readPortalGrants(candidateRow?.metadata);
    const appGrants = grants.filter((g) => g.applicationId === id);
    const latestGrant = appGrants[appGrants.length - 1] ?? null;
    const hasActiveGrant = Boolean(
      latestGrant && !latestGrant.revokedAt && new Date(latestGrant.expiresAt).getTime() > Date.now(),
    );
    const portalLink = {
      hasActiveGrant,
      expiresAt: latestGrant?.expiresAt ?? null,
      revokedAt: latestGrant?.revokedAt ?? null,
    };
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
      requests: requests.map((row) => {
        const reqType = row.reason ?? 'Document';
        const resolved = resolveRequestStatus(reqType, row.createdAt, docs, checks);
        return {
          id: row.id,
          documentType: reqType,
          at: row.createdAt.toISOString(),
          status: resolved.status,
          matchedDocumentId: resolved.matchedDocumentId,
          matchedDocumentName: resolved.matchedDocumentName,
          associationKind: resolved.associationKind,
          deliveryMode: hasActiveGrant ? ('portal_link_active' as const) : ('internal_log' as const),
        };
      }),
      portalLink,
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
    return {
      id: row.id,
      documentType: type,
      at: row.createdAt.toISOString(),
      status: 'Requested' as const,
      matchedDocumentId: null,
      matchedDocumentName: null,
      associationKind: null,
      deliveryMode: 'internal_log' as const,
    };
  }

  async issueDocumentPortalLink(user: AuthUser, id: string, action: 'issue' | 'revoke' = 'issue') {
    const app = await this.visibleApplication(user, id);
    const candidateRow = typeof (this.prisma as { candidate?: { findFirst?: unknown } }).candidate?.findFirst === 'function'
      ? await this.prisma.candidate.findFirst({
          where: { id: app.candidateId, organizationId: user.organizationId },
          select: { id: true, metadata: true },
        })
      : null;
    const { base, grants } = readPortalGrants(candidateRow?.metadata);
    const nowIso = new Date().toISOString();
    const revokedExisting = grants.map((g) =>
      g.applicationId === id && !g.revokedAt ? { ...g, revokedAt: nowIso } : g,
    );
    if (action === 'revoke') {
      if (typeof (this.prisma as { candidate?: { update?: unknown } }).candidate?.update === 'function') {
        await this.prisma.candidate.update({
          where: { id: app.candidateId },
          data: { metadata: { ...base, portal: { grants: revokedExisting } } as unknown as Prisma.InputJsonValue },
        });
      }
      await this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'PORTAL_LINK_REVOKE',
          entityType: 'Application',
          entityId: id,
          result: 'SUCCESS',
          reason: 'Candidate portal link revoked by recruiter',
          afterData: { revokedAt: nowIso } satisfies Prisma.InputJsonObject,
        },
      });
      return {
        hasActiveGrant: false,
        token: null,
        portalPath: null,
        expiresAt: null,
        revokedAt: nowIso,
      };
    }

    const nonce = randomBytes(16).toString('hex');
    const expiresAtMs = Date.now() + PORTAL_TTL_MS;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const payload: PortalTokenPayload = {
      kind: 'portal',
      applicationId: id,
      candidateId: app.candidateId,
      organizationId: user.organizationId,
      expiresAt: expiresAtMs,
      nonce,
    };
    const token = signPortalToken(payload);
    const nextGrants = [
      ...revokedExisting,
      {
        nonce,
        applicationId: id,
        expiresAt,
        revokedAt: null,
      },
    ].slice(-20);
    if (typeof (this.prisma as { candidate?: { update?: unknown } }).candidate?.update === 'function') {
      await this.prisma.candidate.update({
        where: { id: app.candidateId },
        data: { metadata: { ...base, portal: { grants: nextGrants } } as unknown as Prisma.InputJsonValue },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: 'PORTAL_LINK_ISSUE',
        entityType: 'Application',
        entityId: id,
        result: 'SUCCESS',
        reason: 'Candidate portal upload link issued by recruiter',
        afterData: { expiresAt, issuedBy: user.userId } satisfies Prisma.InputJsonObject,
      },
    });
    return {
      hasActiveGrant: true,
      token,
      portalPath: `/portal/applications/${encodeURIComponent(token)}`,
      expiresAt,
      revokedAt: null,
    };
  }
}

function resolveRequestStatus(
  requestType: string,
  requestAt: Date,
  docs: Array<{ id: string; documentType: string; fileName: string; createdAt: Date }>,
  checks: Array<{ type: string; verified: boolean; documentId: string | null }>,
): {
  status: 'Requested' | 'Received' | 'Verified';
  matchedDocumentId: string | null;
  matchedDocumentName: string | null;
  associationKind: 'uploaded_after_request' | 'existing_document_match' | 'verified_check_match' | null;
} {
  const norm = requestType.trim().toLowerCase();
  const checkType = norm.includes('contract') || norm.includes('offer')
    ? 'CONTRACT'
    : norm === 'id' || norm.includes('passport') || norm.includes('national id')
      ? 'ID'
      : norm.includes('scfhs') || norm.includes('licen')
        ? 'SCFHS_LICENCE'
        : null;
  const docTokens = checkType === 'CONTRACT'
    ? ['contract', 'offer_letter', 'offer']
    : checkType === 'ID'
      ? ['id', 'passport']
      : checkType === 'SCFHS_LICENCE'
        ? ['license', 'licence', 'scfhs']
        : [norm];
  const matchingDocs = docs.filter((doc) => {
    const dt = doc.documentType.trim().toLowerCase();
    const fn = doc.fileName.trim().toLowerCase();
    return docTokens.some((tok) => dt === tok || dt.includes(tok) || fn.includes(tok));
  });
  const uploadedAfter = [...matchingDocs].reverse().find((d) => d.createdAt.getTime() >= requestAt.getTime()) ?? null;
  const recentDoc = uploadedAfter ?? matchingDocs[matchingDocs.length - 1] ?? null;
  const verifiedCheck = checks.find((c) => c.verified && ((recentDoc && c.documentId === recentDoc.id) || (checkType && c.type === checkType)));
  const associationKind = uploadedAfter
    ? 'uploaded_after_request'
    : recentDoc
      ? 'existing_document_match'
      : verifiedCheck
        ? 'verified_check_match'
        : null;
  if (verifiedCheck) {
    return {
      status: 'Verified',
      matchedDocumentId: verifiedCheck.documentId ?? recentDoc?.id ?? null,
      matchedDocumentName: recentDoc?.fileName ?? null,
      associationKind,
    };
  }
  if (recentDoc) {
    return {
      status: 'Received',
      matchedDocumentId: recentDoc.id,
      matchedDocumentName: recentDoc.fileName,
      associationKind,
    };
  }
  return { status: 'Requested', matchedDocumentId: null, matchedDocumentName: null, associationKind: null };
}

function storedFile(storageKey: string, storageProvider: string): boolean {
  return storageProvider !== 'metadata-only' && !storageKey.startsWith('metadata-only/');
}
