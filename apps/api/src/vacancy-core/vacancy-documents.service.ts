import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthUser, JdCriteriaDefinition, VacancyDocumentItem } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { CompositeDocumentExtractor } from '../resume/extraction/composite-document-extractor';
import { ResumeSourceFactory } from '../resume/source/resume-source.factory';
import { JdParserService } from './jd-parser.service';
import { AccessControlService } from '../access-control/access-control.service';

@Injectable()
export class VacancyDocumentsService {
  private readonly logger = new Logger(VacancyDocumentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
    private readonly jdParser: JdParserService,
    private readonly accessControl: AccessControlService,
    @Optional() private readonly extractor?: CompositeDocumentExtractor,
    @Optional() private readonly sourceFactory?: ResumeSourceFactory,
  ) {}

  /**
   * Upload and process a JD document for an active or open Vacancy.
   */
  async uploadVacancyJd(
    organizationId: string,
    vacancyId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    user: AuthUser,
  ): Promise<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, organizationId },
      select: { id: true, vacancyCode: true, requiredSkills: true, status: true },
    });
    if (!vacancy) throw new NotFoundException('Job not found.');

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const stored = await this.storage.put(organizationId, vacancyId, file.originalname, file.buffer);

    // Extract text from PDF, Word, or plain-text
    let extractionText = '';
    let parserStatus = 'Completed';

    if (file.mimetype.includes('text') || file.originalname.endsWith('.txt')) {
      extractionText = file.buffer.toString('utf8');
    } else if (this.extractor && this.sourceFactory) {
      try {
        const resumeSource = this.sourceFactory.createFromUploadedFile({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        });
        const extracted = await this.extractor.extract(resumeSource);
        extractionText = extracted.rawText || '';
      } catch (err: unknown) {
        this.logger.warn(`Failed extracting text from JD ${file.originalname}: ${err}`);
        parserStatus = 'Failed';
        extractionText = file.buffer.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').slice(0, 10000);
      }
    } else {
      extractionText = file.buffer.toString('utf8').slice(0, 10000);
    }

    // Parse structured requirements
    const parsedCriteria = this.jdParser.parseJdText(extractionText, vacancy.requiredSkills);

    // Create VacancyDocument row
    const doc = await this.prisma.vacancyDocument.create({
      data: {
        organizationId,
        vacancyId,
        documentType: 'JOB_DESCRIPTION',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: stored.storageKey,
        storageProvider: stored.provider,
        sha256,
        extractionText,
        parserStatus,
        uploadedById: user.userId,
      },
      include: { uploadedBy: { select: { displayName: true } } },
    });

    // Update Vacancy with parsed criteria and sync requiredSkills
    const updatedSkills = Array.from(
      new Set([
        ...vacancy.requiredSkills,
        ...parsedCriteria.mustHaveSkills.map((s) => s.name),
      ]),
    );

    await this.prisma.vacancy.update({
      where: { id: vacancyId },
      data: {
        jdCriteria: parsedCriteria as unknown as object,
        requiredSkills: updatedSkills,
        minExperienceYears: parsedCriteria.minExperienceYears ?? null,
      },
    });

    return {
      document: {
        id: doc.id,
        vacancyId: doc.vacancyId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        parserStatus: doc.parserStatus,
        extractionText: doc.extractionText,
        uploadedByName: doc.uploadedBy?.displayName || null,
        createdAt: doc.createdAt.toISOString(),
      },
      criteria: parsedCriteria,
    };
  }

  /**
   * Upload and process a JD document for a VacancyRequest (Requisition).
   */
  async uploadRequisitionJd(
    organizationId: string,
    vacancyRequestId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    user: AuthUser,
  ): Promise<{ document: VacancyDocumentItem; criteria: JdCriteriaDefinition }> {
    const req = await this.prisma.vacancyRequest.findFirst({
      where: { id: vacancyRequestId, organizationId },
      select: { id: true, requestCode: true, status: true },
    });
    if (!req) throw new NotFoundException('Requisition not found.');

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const stored = await this.storage.put(organizationId, vacancyRequestId, file.originalname, file.buffer);

    let extractionText = '';
    let parserStatus = 'Completed';

    if (file.mimetype.includes('text') || file.originalname.endsWith('.txt')) {
      extractionText = file.buffer.toString('utf8');
    } else if (this.extractor && this.sourceFactory) {
      try {
        const resumeSource = this.sourceFactory.createFromUploadedFile({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        });
        const extracted = await this.extractor.extract(resumeSource);
        extractionText = extracted.rawText || '';
      } catch (err: unknown) {
        this.logger.warn(`Failed extracting text from JD ${file.originalname}: ${err}`);
        parserStatus = 'Failed';
        extractionText = file.buffer.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').slice(0, 10000);
      }
    } else {
      extractionText = file.buffer.toString('utf8').slice(0, 10000);
    }

    const parsedCriteria = this.jdParser.parseJdText(extractionText, []);

    const doc = await this.prisma.vacancyDocument.create({
      data: {
        organizationId,
        vacancyRequestId,
        documentType: 'JOB_DESCRIPTION',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: stored.storageKey,
        storageProvider: stored.provider,
        sha256,
        extractionText,
        parserStatus,
        uploadedById: user.userId,
      },
      include: { uploadedBy: { select: { displayName: true } } },
    });

    await this.prisma.vacancyRequest.update({
      where: { id: vacancyRequestId },
      data: {
        jdCriteria: parsedCriteria as unknown as object,
      },
    });

    return {
      document: {
        id: doc.id,
        vacancyRequestId: doc.vacancyRequestId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        parserStatus: doc.parserStatus,
        extractionText: doc.extractionText,
        uploadedByName: doc.uploadedBy?.displayName || null,
        createdAt: doc.createdAt.toISOString(),
      },
      criteria: parsedCriteria,
    };
  }

  /**
   * Get JD details and criteria for a vacancy.
   */
  async getVacancyJd(organizationId: string, vacancyId: string): Promise<{ document: VacancyDocumentItem | null; criteria: JdCriteriaDefinition | null }> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, organizationId },
      select: {
        id: true,
        jdCriteria: true,
        documents: {
          where: { documentType: 'JOB_DESCRIPTION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { uploadedBy: { select: { displayName: true } } },
        },
      },
    });
    if (!vacancy) throw new NotFoundException('Job not found.');

    const doc = vacancy.documents[0] ?? null;
    return {
      document: doc
        ? {
            id: doc.id,
            vacancyId: doc.vacancyId,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            parserStatus: doc.parserStatus,
            extractionText: doc.extractionText,
            uploadedByName: doc.uploadedBy?.displayName || null,
            createdAt: doc.createdAt.toISOString(),
          }
        : null,
      criteria: (vacancy.jdCriteria as unknown as JdCriteriaDefinition) || null,
    };
  }

  /**
   * Recruiter review: Update and/or lock criteria.
   */
  async updateVacancyCriteria(
    organizationId: string,
    vacancyId: string,
    criteria: Partial<JdCriteriaDefinition>,
    user: AuthUser,
  ): Promise<JdCriteriaDefinition> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, organizationId },
      select: { id: true, jdCriteria: true, requiredSkills: true },
    });
    if (!vacancy) throw new NotFoundException('Job not found.');

    const current = (vacancy.jdCriteria as unknown as JdCriteriaDefinition) || this.jdParser.parseJdText('', vacancy.requiredSkills);

    const updated: JdCriteriaDefinition = {
      ...current,
      ...criteria,
      version: current.version + 1,
      weights: criteria.weights || current.weights,
      mustHaveSkills: criteria.mustHaveSkills || current.mustHaveSkills,
      niceToHaveSkills: criteria.niceToHaveSkills || current.niceToHaveSkills,
      knockoutRules: criteria.knockoutRules || current.knockoutRules,
    };

    if (criteria.isLocked && !current.isLocked) {
      updated.isLocked = true;
      updated.lockedAt = new Date().toISOString();
      updated.lockedById = user.userId;
      updated.lockedByName = user.userId;
    }

    const newSkills = Array.from(new Set([...updated.mustHaveSkills.map((s) => s.name)]));

    await this.prisma.vacancy.update({
      where: { id: vacancyId },
      data: {
        jdCriteria: updated as unknown as object,
        requiredSkills: newSkills.length > 0 ? newSkills : vacancy.requiredSkills,
        minExperienceYears: updated.minExperienceYears ?? null,
      },
    });

    return updated;
  }
}
