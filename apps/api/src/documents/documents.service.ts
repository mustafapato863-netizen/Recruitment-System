import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { CandidateDocument } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import type { UploadCandidateDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listCandidateDocuments(
    organizationId: string,
    candidateId: string,
  ): Promise<CandidateDocument[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${candidateId} was not found.`);
    }

    const items = await this.prisma.candidateDocument.findMany({
      where: { organizationId, candidateId },
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((doc) => this.toCandidateDocument(doc));
  }

  async getDocument(
    organizationId: string,
    id: string,
  ): Promise<CandidateDocument> {
    const doc = await this.prisma.candidateDocument.findUnique({
      where: { id },
      include: { uploadedBy: true },
    });

    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundException(`Document ${id} was not found.`);
    }

    return this.toCandidateDocument(doc);
  }

  async createDocument(
    organizationId: string,
    uploadedById: string,
    dto: UploadCandidateDocumentDto,
  ): Promise<CandidateDocument> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
    });

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${dto.candidateId} was not found.`);
    }

    if (/[\\/]/.test(dto.fileName) || dto.storageKey.includes('..')) {
      throw new BadRequestException('File name and storage key must be safe relative values.');
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ]);
    if (!allowedMimeTypes.has(dto.mimeType)) {
      throw new BadRequestException('Unsupported document type.');
    }

    const created = await this.prisma.candidateDocument.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        documentType: dto.documentType,
        fileName: dto.fileName.trim(),
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: dto.storageKey,
        extractionText: dto.extractionText ?? null,
        scanStatus: 'Pending',
        uploadedById,
      },
      include: { uploadedBy: true },
    });

    return this.toCandidateDocument(created);
  }

  private toCandidateDocument(
    record: Prisma.CandidateDocumentGetPayload<{ include: { uploadedBy: true } }>,
  ): CandidateDocument {
    return {
      id: record.id,
      organizationId: record.organizationId,
      candidateId: record.candidateId,
      documentType: record.documentType,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      extractionText: record.extractionText,
      scanStatus: record.scanStatus,
      uploadedById: record.uploadedById,
      uploadedByName: record.uploadedBy?.displayName,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
