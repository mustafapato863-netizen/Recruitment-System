import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import type { Prisma } from '@recruitflow/database';
import type { CandidateDocument, CvBankBackupStatus } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentScannerService } from './document-scanner.service';
import { DocumentStorageService } from './document-storage.service';
import { fileInvalid, fileTooLarge } from '../common/errors/api-error';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthUser } from '@recruitflow/contracts';
import type { ArchiveCandidateDocumentDto, UpdateDocumentRetentionDto, UploadCandidateDocumentDto, UploadCandidateFileDto } from './documents.dto';

type UploadedCandidateFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DocumentScannerService) private readonly scanner: DocumentScannerService,
    @Inject(DocumentStorageService) private readonly storage: DocumentStorageService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
  ) {}

  private async candidateWhere(organizationId: string, candidateId: string, user?: AuthUser): Promise<Prisma.CandidateWhereInput> {
    if (user && this.accessControl) return { id: candidateId, ...(await this.accessControl.getCandidateVisibilityWhere(user)) };
    return { id: candidateId, organizationId };
  }

  private async documentWhere(organizationId: string, documentId: string, user?: AuthUser): Promise<Prisma.CandidateDocumentWhereInput> {
    if (user && this.accessControl) {
      return { id: documentId, organizationId, candidate: await this.accessControl.getCandidateVisibilityWhere(user) };
    }
    return { id: documentId, organizationId };
  }

  async listCandidateDocuments(
    organizationId: string,
    candidateId: string,
    user?: AuthUser,
  ): Promise<CandidateDocument[]> {
    const candidate = await this.prisma.candidate.findFirst({
      where: await this.candidateWhere(organizationId, candidateId, user),
    });

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${candidateId} was not found.`);
    }

    const items = await this.prisma.candidateDocument.findMany({
      where: { organizationId, candidateId, deletedAt: null },
      include: { uploadedBy: true, candidate: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((doc) => this.toCandidateDocument(doc));
  }

  async getDocument(
    organizationId: string,
    id: string,
    user?: AuthUser,
  ): Promise<CandidateDocument> {
    const doc = await this.prisma.candidateDocument.findFirst({
      where: { ...(await this.documentWhere(organizationId, id, user)), deletedAt: null },
      include: { uploadedBy: true, candidate: true },
    });

    if (!doc) {
      throw new NotFoundException(`Document ${id} was not found.`);
    }

    return this.toCandidateDocument(doc);
  }

  async createDocument(
    organizationId: string,
    uploadedById: string,
    dto: UploadCandidateDocumentDto,
    user?: AuthUser,
  ): Promise<CandidateDocument> {
    const candidate = await this.prisma.candidate.findFirst({
      where: await this.candidateWhere(organizationId, dto.candidateId, user),
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate ${dto.candidateId} was not found.`);
    }

    if (/[\\/]/.test(dto.fileName) || dto.storageKey) {
      throw fileInvalid('File name must be safe and storage references are server-managed.');
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ]);
    if (!allowedMimeTypes.has(dto.mimeType)) {
      throw fileInvalid('Unsupported document type.');
    }

    const created = await this.prisma.candidateDocument.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        documentType: dto.documentType,
        fileName: dto.fileName.trim(),
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        // V1 records metadata only. Keep an internal non-downloadable reference
        // until reviewed object storage, scanning, and signed downloads exist.
        storageKey: `metadata-only/${organizationId}/${candidate.id}/${randomUUID()}`,
        storageProvider: 'metadata-only',
        sha256: null,
        extractionText: dto.extractionText ?? null,
        scanStatus: 'MetadataOnly',
        scanProvider: null,
        scanMessage: 'No binary file was supplied; this record is metadata only.',
        scannedAt: null,
        parserStatus: 'NotStarted',
        consentStatus: 'Unknown',
        uploadedById,
      },
      include: { uploadedBy: true, candidate: true },
    });

    return this.toCandidateDocument(created);
  }

  async listCvBank(organizationId: string, search = '', page = 1, pageSize = 25, user?: AuthUser) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const term = search.trim();
    const where: Prisma.CandidateDocumentWhereInput = {
      organizationId,
      documentType: { in: ['CV', 'Resume'] },
      deletedAt: null,
      ...(user && this.accessControl ? { candidate: await this.accessControl.getCandidateVisibilityWhere(user) } : {}),
      ...(term ? {
        OR: [
          { fileName: { contains: term, mode: 'insensitive' } },
          { candidate: { firstName: { contains: term, mode: 'insensitive' } } },
          { candidate: { lastName: { contains: term, mode: 'insensitive' } } },
          { candidate: { email: { contains: term, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [total, records] = await Promise.all([
      this.prisma.candidateDocument.count({ where }),
      this.prisma.candidateDocument.findMany({
        where,
        include: { uploadedBy: true, candidate: true },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);
    return { data: records.map((record) => this.toCandidateDocument(record)), total, page: safePage, pageSize: safePageSize };
  }

  async uploadFile(organizationId: string, uploadedById: string, dto: UploadCandidateFileDto, file: UploadedCandidateFile, user?: AuthUser): Promise<CandidateDocument> {
    const candidate = await this.prisma.candidate.findFirst({ where: await this.candidateWhere(organizationId, dto.candidateId, user) });
    if (!candidate) throw new NotFoundException(`Candidate ${dto.candidateId} was not found.`);
    if (!file?.buffer?.length) throw fileInvalid('Attach a CV file.');
    if (file.size > 10 * 1024 * 1024) throw fileTooLarge('CV files must be 10 MB or smaller.');
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    if (!allowedMimeTypes.has(file.mimetype)) throw fileInvalid('CV files must be PDF, DOC, or DOCX.');

    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || 'candidate-cv';
    const scan = this.scanner.scan(file.buffer, safeName, file.mimetype);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    let stored: { storageKey: string; provider: string } | undefined;
    if (scan.status === 'Clean') {
      stored = await this.storage.put(organizationId, candidate.id, safeName, file.buffer);
    }
    try {
      const created = await this.prisma.candidateDocument.create({
        data: {
          organizationId,
          candidateId: candidate.id,
          documentType: dto.documentType.trim() || 'CV',
          fileName: safeName,
          fileSize: file.size,
          mimeType: file.mimetype,
          storageKey: stored?.storageKey ?? `metadata-only/${organizationId}/${candidate.id}/${randomUUID()}`,
          storageProvider: stored?.provider ?? 'metadata-only',
          sha256,
          extractionText: dto.extractionText?.trim() || null,
          scanStatus: scan.status,
          scanProvider: scan.provider,
          scanMessage: scan.message,
          scannedAt: new Date(),
          parserStatus: 'NotStarted',
          consentStatus: 'Unknown',
          uploadedById,
        },
        include: { uploadedBy: true, candidate: true },
      });
      void this.auditService.log({
        action: 'CV_SCAN_RESULT',
        actorUserId: uploadedById,
        organizationId,
        entityType: 'CandidateDocument',
        entityId: created.id,
        result: scan.status === 'Clean' ? 'SUCCESS' : 'REJECTED',
        reason: scan.message,
      }).catch(() => undefined);
      return this.toCandidateDocument(created);
    } catch (error) {
      if (stored) await this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  async getFile(organizationId: string, id: string, user?: AuthUser) {
    const document = await this.prisma.candidateDocument.findFirst({ where: { ...(await this.documentWhere(organizationId, id, user)), deletedAt: null } });
    if (!document || document.storageProvider === 'metadata-only' || document.storageKey.startsWith('metadata-only/')) {
      throw new NotFoundException('This document has no stored file.');
    }
    if (document.scanStatus !== 'Clean') {
      throw new NotFoundException('This document is not available until its security scan is clean.');
    }
    if (document.consentStatus === 'Withdrawn' || document.consentStatus === 'Expired') {
      throw new NotFoundException('This document is not available because consent is not active.');
    }
    if (document.retentionExpiresAt && document.retentionExpiresAt <= new Date()) {
      throw new NotFoundException('This document is not available because its retention period has expired.');
    }
    const absolutePath = this.storage.absolutePath(document.storageKey);
    await stat(absolutePath).catch(() => { throw new NotFoundException('Document file was not found.'); });
    return { path: absolutePath, fileName: document.fileName, mimeType: document.mimeType };
  }

  async exportCvManifest(organizationId: string, user?: AuthUser): Promise<Buffer> {
    const candidateVisibility = user && this.accessControl ? await this.accessControl.getCandidateVisibilityWhere(user) : undefined;
    const records = await this.prisma.candidateDocument.findMany({
      where: { organizationId, documentType: { in: ['CV', 'Resume'] }, deletedAt: null, ...(candidateVisibility ? { candidate: candidateVisibility } : {}) },
      include: { uploadedBy: true, candidate: true },
      orderBy: { createdAt: 'desc' },
      take: 50_000,
    });
    const workbook = XLSX.utils.book_new();
    const manifestRows: Array<Record<string, string | number>> = [];
    for (const record of records) {
      const document = this.toCandidateDocument(record);
      manifestRows.push({
        candidate: document.candidateName ?? document.candidateId,
        candidateId: document.candidateId,
        fileName: document.fileName,
        documentType: document.documentType,
        fileSize: document.fileSize,
        sha256: document.sha256 ?? '',
        storageProvider: document.storageProvider ?? '',
        scanStatus: document.scanStatus,
        scanProvider: document.scanProvider ?? '',
        scanMessage: document.scanMessage ?? '',
        parserStatus: document.parserStatus ?? '',
        consentStatus: document.consentStatus ?? '',
        retentionExpiresAt: document.retentionExpiresAt ?? '',
        hasStoredFile: document.hasFile ? 'Yes' : 'No',
        missingFile: document.hasFile && !(await this.storage.exists(record.storageKey)) ? 'Yes' : 'No',
        uploadedAt: document.createdAt,
      });
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(manifestRows), 'CV Bank Manifest');
    const backup = await this.getBackupStatus(organizationId, user);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([backup]), 'Backup Readiness');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async getBackupStatus(organizationId: string, user?: AuthUser): Promise<CvBankBackupStatus> {
    const candidateVisibility = user && this.accessControl ? await this.accessControl.getCandidateVisibilityWhere(user) : undefined;
    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.candidateDocument.findMany({
        where: { organizationId, documentType: { in: ['CV', 'Resume'] }, deletedAt: null, ...(candidateVisibility ? { candidate: candidateVisibility } : {}) },
        select: { storageKey: true, storageProvider: true, scanStatus: true },
      }),
      this.prisma.candidateDocument.count({
        where: { organizationId, documentType: { in: ['CV', 'Resume'] }, deletedAt: { not: null }, ...(candidateVisibility ? { candidate: candidateVisibility } : {}) },
      }),
    ]);
    const stored = activeRecords.filter((record) => record.storageProvider !== 'metadata-only' && !record.storageKey.startsWith('metadata-only/'));
    const missing = await Promise.all(stored.map(async (record) => !(await this.storage.exists(record.storageKey))));
    const backupProvider = process.env.RECRUITFLOW_DOCUMENT_BACKUP_PROVIDER ?? 'not-configured';
    const lastBackupAt = process.env.RECRUITFLOW_DOCUMENT_BACKUP_LAST_SUCCESS_AT && !Number.isNaN(Date.parse(process.env.RECRUITFLOW_DOCUMENT_BACKUP_LAST_SUCCESS_AT))
      ? new Date(process.env.RECRUITFLOW_DOCUMENT_BACKUP_LAST_SUCCESS_AT).toISOString()
      : null;
    return {
      provider: backupProvider,
      storageProvider: this.storage.getProvider(),
      manifestOnly: true,
      backupConfigured: !['not-configured', 'none'].includes(backupProvider),
      totalRecords: activeRecords.length,
      storedFiles: stored.length,
      cleanFiles: activeRecords.filter((record) => record.scanStatus === 'Clean').length,
      pendingFiles: activeRecords.filter((record) => ['Pending', 'Scanning', 'Processing'].includes(record.scanStatus)).length,
      rejectedFiles: activeRecords.filter((record) => ['Rejected', 'Failed'].includes(record.scanStatus)).length,
      metadataOnlyFiles: activeRecords.filter((record) => record.storageProvider === 'metadata-only' || record.storageKey.startsWith('metadata-only/')).length,
      missingFiles: missing.filter(Boolean).length,
      archivedRecords,
      lastBackupAt,
    };
  }

  async updateRetention(organizationId: string, userId: string, id: string, dto: UpdateDocumentRetentionDto, user?: AuthUser): Promise<CandidateDocument> {
    const existing = await this.prisma.candidateDocument.findFirst({ where: { ...(await this.documentWhere(organizationId, id, user)), deletedAt: null } });
    if (!existing) throw new NotFoundException(`Document ${id} was not found.`);
    const retentionExpiresAt = dto.retentionExpiresAt === null || dto.retentionExpiresAt === undefined
      ? dto.retentionExpiresAt
      : new Date(dto.retentionExpiresAt);
    const updated = await this.prisma.candidateDocument.update({
      where: { id },
      data: {
        ...(dto.consentStatus ? { consentStatus: dto.consentStatus } : {}),
        ...(dto.retentionExpiresAt !== undefined ? { retentionExpiresAt } : {}),
      },
      include: { uploadedBy: true, candidate: true },
    });
    await this.auditService.log({
      action: 'DOCUMENT_RETENTION_UPDATE',
      actorUserId: userId,
      organizationId,
      entityType: 'CandidateDocument',
      entityId: id,
      result: 'SUCCESS',
      reason: JSON.stringify({ consentStatus: dto.consentStatus, retentionExpiresAt: dto.retentionExpiresAt }),
    }).catch(() => undefined);
    return this.toCandidateDocument(updated);
  }

  async archiveDocument(organizationId: string, userId: string, id: string, dto: ArchiveCandidateDocumentDto, user?: AuthUser): Promise<CandidateDocument> {
    const existing = await this.prisma.candidateDocument.findFirst({ where: { ...(await this.documentWhere(organizationId, id, user)), deletedAt: null }, include: { uploadedBy: true, candidate: true } });
    if (!existing) throw new NotFoundException(`Document ${id} was not found.`);
    const updated = await this.prisma.candidateDocument.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletionReason: dto.reason?.trim() || 'Archived by an authorized user.' },
      include: { uploadedBy: true, candidate: true },
    });
    await this.auditService.log({
      action: 'DOCUMENT_ARCHIVE',
      actorUserId: userId,
      organizationId,
      entityType: 'CandidateDocument',
      entityId: id,
      result: 'SUCCESS',
      reason: dto.reason?.trim() || 'Archived by an authorized user.',
    }).catch(() => undefined);
    return this.toCandidateDocument(updated);
  }

  async restoreDocument(organizationId: string, userId: string, id: string, user?: AuthUser): Promise<CandidateDocument> {
    const existing = await this.prisma.candidateDocument.findFirst({ where: { ...(await this.documentWhere(organizationId, id, user)), deletedAt: { not: null } }, include: { uploadedBy: true, candidate: true } });
    if (!existing) throw new NotFoundException(`Archived document ${id} was not found.`);
    const updated = await this.prisma.candidateDocument.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, deletionReason: null },
      include: { uploadedBy: true, candidate: true },
    });
    await this.auditService.log({
      action: 'DOCUMENT_RESTORE',
      actorUserId: userId,
      organizationId,
      entityType: 'CandidateDocument',
      entityId: id,
      result: 'SUCCESS',
      reason: 'Restored by an authorized user.',
    }).catch(() => undefined);
    return this.toCandidateDocument(updated);
  }

  private toCandidateDocument(
    record: Prisma.CandidateDocumentGetPayload<{ include: { uploadedBy: true; candidate: true } }>,
  ): CandidateDocument {
    return {
      id: record.id,
      organizationId: record.organizationId,
      candidateId: record.candidateId,
      candidateName: `${record.candidate.firstName} ${record.candidate.lastName}`.trim(),
      documentType: record.documentType,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      extractionText: record.extractionText,
      scanStatus: record.scanStatus,
      storageProvider: record.storageProvider,
      sha256: record.sha256,
      scanProvider: record.scanProvider,
      scanMessage: record.scanMessage,
      scannedAt: record.scannedAt?.toISOString() ?? null,
      parserStatus: record.parserStatus,
      parserVersion: record.parserVersion,
      retentionExpiresAt: record.retentionExpiresAt?.toISOString() ?? null,
      consentStatus: record.consentStatus,
      deletedAt: record.deletedAt?.toISOString() ?? null,
      hasFile: !record.storageKey.startsWith('metadata-only/'),
      uploadedById: record.uploadedById,
      uploadedByName: record.uploadedBy?.displayName,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
