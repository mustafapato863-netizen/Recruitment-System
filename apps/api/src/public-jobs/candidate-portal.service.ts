import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@recruitflow/database';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { DocumentScannerService } from '../documents/document-scanner.service';
import { DocumentStorageService } from '../documents/document-storage.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { fileInvalid, fileTooLarge, fileUnsafe } from '../common/errors/api-error';
import * as path from 'node:path';

export const PORTAL_LINK_UNUSABLE = 'This link has expired or was revoked. Ask the hiring team for a new link. This page does not open another person\'s application.';
export const PORTAL_FILE_DENIED = 'That file is not available on this link.';
export const PORTAL_CONTACT_RECEIVED = 'We received your note. It does not open an application.';
const PORTAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface PortalTokenPayload {
  kind: 'portal';
  applicationId: string;
  candidateId: string;
  organizationId: string;
  expiresAt: number;
  nonce: string;
}

export interface PortalGrant {
  nonce: string;
  applicationId: string;
  expiresAt: string;
  revokedAt: string | null;
}

type PortalFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

type PortalScope = {
  payload: PortalTokenPayload;
  applicationCode: string;
  stage: string;
  vacancyCode: string;
  vacancyStatus: string;
  positionTitle: string;
  organizationCode: string;
  organizationName: string;
  candidateFirstName: string;
};

function portalSecret(): string {
  const configured = process.env.SELF_SCHEDULE_SECRET;
  if (configured && configured.length >= 32) return `portal-v1:${configured}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SELF_SCHEDULE_SECRET must be configured (min 32 chars) in production');
  }
  return 'portal-v1:recruitflow-dev-self-schedule-secret-key-2026';
}

function isGrant(value: unknown): value is PortalGrant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<PortalGrant>;
  return typeof row.nonce === 'string'
    && typeof row.applicationId === 'string'
    && typeof row.expiresAt === 'string'
    && (row.revokedAt === null || typeof row.revokedAt === 'string');
}

export function readPortalGrants(metadata: Prisma.JsonValue | null | undefined): { base: Record<string, unknown>; grants: PortalGrant[] } {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  const portal = base.portal;
  const raw = portal && typeof portal === 'object' && !Array.isArray(portal)
    ? (portal as { grants?: unknown }).grants
    : undefined;
  const grants = Array.isArray(raw) ? raw.filter(isGrant) : [];
  return { base, grants };
}

@Injectable()
export class CandidatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: DocumentScannerService,
    private readonly storage: DocumentStorageService,
  ) {}

  sign(payload: PortalTokenPayload): string {
    const dataPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', portalSecret()).update(dataPart).digest('base64url');
    return `${dataPart}.${signature}`;
  }

  /** Signature and expiry only. No database and no document read. */
  openToken(token: string): PortalTokenPayload {
    if (!token || typeof token !== 'string' || token.length > 4000) {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    const expected = createHmac('sha256', portalSecret()).update(parts[0]).digest('base64url');
    const left = Buffer.from(parts[1]);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    let payload: PortalTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as PortalTokenPayload;
    } catch {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    if (payload.kind !== 'portal' || !payload.applicationId || !payload.candidateId || !payload.nonce) {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    if (Date.now() > payload.expiresAt) {
      throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    }
    return payload;
  }

  async issueGrant(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      candidateId: string;
      applicationId: string;
      metadata: Prisma.JsonValue | null;
    },
  ): Promise<{ token: string; portalPath: string }> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + PORTAL_TTL_MS;
    const payload: PortalTokenPayload = {
      kind: 'portal',
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      organizationId: input.organizationId,
      expiresAt,
      nonce,
    };
    const token = this.sign(payload);
    const { base, grants } = readPortalGrants(input.metadata);
    const nextGrants = [...grants, {
      nonce,
      applicationId: input.applicationId,
      expiresAt: new Date(expiresAt).toISOString(),
      revokedAt: null,
    }].slice(-20);
    await tx.candidate.update({
      where: { id: input.candidateId },
      data: { metadata: { ...base, portal: { grants: nextGrants } } as unknown as Prisma.InputJsonValue },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: null,
        action: 'PORTAL_LINK_ISSUE',
        entityType: 'Application',
        entityId: input.applicationId,
        result: 'SUCCESS',
        reason: 'Candidate portal link issued on the on-screen receipt',
        afterData: { expiresAt, receipt: 'on-screen' },
      },
    });
    return { token, portalPath: `/portal/applications/${encodeURIComponent(token)}` };
  }

  async view(token: string) {
    const scope = await this.scope(token);
    const [requests, documents] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId: scope.payload.organizationId,
          action: 'DOCUMENT_REQUEST',
          entityType: 'Application',
          entityId: scope.payload.applicationId,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, reason: true, createdAt: true },
      }),
      this.prisma.candidateDocument.findMany({
        where: {
          organizationId: scope.payload.organizationId,
          candidateId: scope.payload.candidateId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, documentType: true, fileName: true, scanStatus: true, createdAt: true },
      }),
    ]);
    return {
      applicationCode: scope.applicationCode,
      stage: scope.stage,
      positionTitle: scope.positionTitle,
      vacancyCode: scope.vacancyCode,
      vacancyStatus: scope.vacancyStatus,
      organizationCode: scope.organizationCode,
      organizationName: scope.organizationName,
      candidateFirstName: scope.candidateFirstName,
      requests: requests.map((row) => ({ id: row.id, documentType: row.reason ?? 'Document', at: row.createdAt.toISOString() })),
      documents: documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        scanStatus: doc.scanStatus,
        awaitingVerification: doc.scanStatus === 'AwaitingVerification',
        uploadedAt: doc.createdAt.toISOString(),
      })),
    };
  }

  async fileStatus(token: string, documentId: string) {
    const scope = await this.scope(token);
    const doc = await this.prisma.candidateDocument.findFirst({
      where: {
        id: documentId,
        organizationId: scope.payload.organizationId,
        candidateId: scope.payload.candidateId,
        deletedAt: null,
      },
      select: { id: true, documentType: true, fileName: true, scanStatus: true },
    });
    if (!doc) throw new NotFoundException(PORTAL_FILE_DENIED);
    return {
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      scanStatus: doc.scanStatus,
      awaitingVerification: doc.scanStatus === 'AwaitingVerification',
      bytes: null,
    };
  }

  async revoke(token: string) {
    const payload = this.openToken(token);
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: payload.candidateId, organizationId: payload.organizationId },
      select: { id: true, metadata: true },
    });
    if (!candidate) throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    const { base, grants } = readPortalGrants(candidate.metadata);
    const match = grants.find((grant) => grant.nonce === payload.nonce && grant.applicationId === payload.applicationId);
    if (!match || match.revokedAt) throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    match.revokedAt = new Date().toISOString();
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: { metadata: { ...base, portal: { grants } } as unknown as Prisma.InputJsonValue },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        actorUserId: null,
        action: 'PORTAL_LINK_REVOKE',
        entityType: 'Application',
        entityId: payload.applicationId,
        result: 'SUCCESS',
        reason: 'Candidate portal link revoked',
        afterData: { revoked: true },
      },
    });
    return { revoked: true, message: PORTAL_LINK_UNUSABLE };
  }

  async contact(name: string, message: string) {
    const cleanName = name.trim().slice(0, 80);
    const cleanMessage = message.trim().slice(0, 500);
    if (cleanName.length < 2 || cleanMessage.length < 2) {
      throw new BadRequestException('Enter your name and a short message.');
    }
    await this.prisma.auditLog.create({
      data: {
        organizationId: null,
        actorUserId: null,
        action: 'PORTAL_CONTACT',
        entityType: 'PortalContact',
        entityId: randomUUID(),
        result: 'Received',
        reason: 'Generic portal contact',
        afterData: { name: cleanName, message: cleanMessage },
      },
    });
    return { received: true, message: PORTAL_CONTACT_RECEIVED };
  }

  async upload(token: string, documentType: string, file: PortalFile | undefined) {
    const scope = await this.scope(token);
    const type = documentType.trim();
    if (type.length < 2 || type.length > 60) {
      throw new BadRequestException('Name the requested document in 2 to 60 characters.');
    }
    const requests = await this.prisma.auditLog.findMany({
      where: {
        organizationId: scope.payload.organizationId,
        action: 'DOCUMENT_REQUEST',
        entityType: 'Application',
        entityId: scope.payload.applicationId,
      },
      select: { reason: true },
    });
    const requested = requests.some((row) => (row.reason ?? '').trim().toLowerCase() === type.toLowerCase());
    if (!requested) {
      throw new BadRequestException('That document was not requested for this application.');
    }
    if (!file?.buffer?.length || file.size === 0) throw fileInvalid('Uploaded file cannot be empty.');
    if (file.size > MAX_UPLOAD_BYTES) throw fileTooLarge('Files must be 2 MB or smaller.');
    const safeName = safeUploadName(file.originalname || 'document.pdf');
    const scan = this.scanner.scan(file.buffer, safeName, file.mimetype);
    if (scan.status !== 'Clean') throw fileUnsafe('The uploaded file is invalid or could not be verified.');
    const stored = await this.storage.put(scope.payload.organizationId, scope.payload.candidateId, safeName, file.buffer);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const doc = await this.prisma.candidateDocument.create({
      data: {
        organizationId: scope.payload.organizationId,
        candidateId: scope.payload.candidateId,
        documentType: type,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: stored.storageKey,
        storageProvider: stored.provider,
        sha256,
        scanStatus: 'AwaitingVerification',
        scanProvider: scan.provider,
        scanMessage: 'Received from the candidate. Awaiting staff verification.',
        parserStatus: 'NotStarted',
        consentStatus: 'Active',
        uploadedById: null,
      },
      select: { id: true, documentType: true, fileName: true, scanStatus: true },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: scope.payload.organizationId,
        actorUserId: null,
        action: 'PORTAL_UPLOAD',
        entityType: 'CandidateDocument',
        entityId: doc.id,
        result: 'SUCCESS',
        reason: 'Candidate upload awaiting verification',
        afterData: {
          documentType: doc.documentType,
          fileName: doc.fileName,
          scanStatus: 'AwaitingVerification',
          joiningCheckCompleted: false,
          licenceCheckCompleted: false,
        },
      },
    });
    return {
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      scanStatus: 'AwaitingVerification' as const,
      awaitingVerification: true,
      joiningCheckCompleted: false,
      licenceCheckCompleted: false,
    };
  }

  private async scope(token: string): Promise<PortalScope> {
    const payload = this.openToken(token);
    const app = await this.prisma.application.findFirst({
      where: {
        id: payload.applicationId,
        candidateId: payload.candidateId,
        organizationId: payload.organizationId,
      },
      select: {
        applicationCode: true,
        stage: true,
        candidate: { select: { firstName: true, metadata: true } },
        vacancy: {
          select: {
            vacancyCode: true,
            status: true,
            position: { select: { title: true } },
            organization: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!app) throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    const { grants } = readPortalGrants(app.candidate.metadata);
    const grant = grants.find((row) => row.nonce === payload.nonce && row.applicationId === payload.applicationId);
    if (!grant || grant.revokedAt) throw new BadRequestException(PORTAL_LINK_UNUSABLE);
    return {
      payload,
      applicationCode: app.applicationCode,
      stage: app.stage,
      vacancyCode: app.vacancy.vacancyCode,
      vacancyStatus: app.vacancy.status,
      positionTitle: app.vacancy.position.title,
      organizationCode: app.vacancy.organization.code,
      organizationName: app.vacancy.organization.name,
      candidateFirstName: app.candidate.firstName,
    };
  }
}

function safeUploadName(originalName: string): string {
  if (originalName.startsWith('.') || originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
    throw fileInvalid('Invalid file name.');
  }
  const parts = originalName.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) throw fileInvalid('File must have a valid extension.');
  const extension = parts[parts.length - 1] ?? '';
  if (extension === 'zip' || parts.slice(0, -1).includes('zip')) {
    throw fileInvalid('ZIP archives are not accepted.');
  }
  const allowed = new Set(['pdf', 'doc', 'docx']);
  if (!allowed.has(extension)) throw fileInvalid('Files must be PDF, DOC, or DOCX.');
  return path.basename(originalName).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || `document.${extension}`;
}
