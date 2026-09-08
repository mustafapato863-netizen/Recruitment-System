import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type {
  PublicApplicationResponse,
  PublicJob,
  PublicJobsResponse,
} from '@recruitflow/contracts';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { RateLimiterService } from '../auth/rate-limiter.service';
import { DocumentScannerService } from '../documents/document-scanner.service';
import { DocumentStorageService } from '../documents/document-storage.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { PublicApplicationDto, PublicJobQueryDto } from './public-jobs.dto';
import { fileInvalid, fileTooLarge, fileUnsafe } from '../common/errors/api-error';

type UploadedPublicFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const DEFAULT_SOURCE = 'career-site';
const PUBLIC_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
const PUBLIC_SOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

type PublicVacancyRecord = Prisma.VacancyGetPayload<{
  include: {
    organization: true;
    branch: true;
    position: true;
    vacancyRequest: true;
  };
}>;

@Injectable()
export class PublicJobsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
    private readonly scanner: DocumentScannerService,
    private readonly storage: DocumentStorageService,
  ) {}

  async listJobs(organizationCode: string, query: PublicJobQueryDto): Promise<PublicJobsResponse> {
    const organization = await this.findOrganization(organizationCode);
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const search = query.search?.trim();
    const now = new Date();
    const where: Prisma.VacancyWhereInput = {
      organizationId: organization.id,
      status: 'Open',
      openedAt: { not: null, lte: now },
      ...(search
        ? {
            OR: [
              { vacancyCode: { contains: search, mode: 'insensitive' } },
              { position: { title: { contains: search, mode: 'insensitive' } } },
              { position: { description: { contains: search, mode: 'insensitive' } } },
              { branch: { name: { contains: search, mode: 'insensitive' } } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, vacancies] = await Promise.all([
      this.prisma.vacancy.count({ where }),
      this.prisma.vacancy.findMany({
        where,
        include: {
          organization: true,
          branch: true,
          position: true,
          vacancyRequest: true,
        },
        orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      organization: { code: organization.code, name: organization.name },
      data: vacancies.map((vacancy) => this.toPublicJob(vacancy)),
      total,
      page,
      pageSize,
    };
  }

  async getJob(organizationCode: string, vacancyCode: string): Promise<PublicJob> {
    const organization = await this.findOrganization(organizationCode);
    const vacancy = await this.findOpenVacancy(organization.id, vacancyCode);
    return this.toPublicJob(vacancy);
  }

  async apply(
    organizationCode: string,
    vacancyCode: string,
    dto: PublicApplicationDto,
    ip?: string,
    cvFile?: UploadedPublicFile,
  ): Promise<PublicApplicationResponse> {
    if (dto.consentAccepted !== true) {
      throw new BadRequestException('Consent is required to submit an application.');
    }
    if (!dto.firstName.trim() || !dto.lastName.trim()) {
      throw new BadRequestException('First name and last name are required.');
    }
    const email = cleanOptional(dto.email)?.toLowerCase() ?? null;
    const normalizedPhone = normalizePhone(cleanOptional(dto.phone));
    const phone = normalizedPhone;
    if (!email && !normalizedPhone) {
      throw new BadRequestException('Provide a valid email address or phone number.');
    }
    const source = normalizeSource(dto.source);
    await this.rateLimiter.enforcePublicRequestLimit(
      email ?? `phone:${normalizedPhone}`,
      ip,
      'Maximum public application requests exceeded',
    );

    let safeCvName: string | undefined;
    if (cvFile) {
      if (cvFile.size === 0 || !cvFile.buffer?.length) {
        throw fileInvalid('Uploaded CV file cannot be empty.');
      }
      if (cvFile.size > 10 * 1024 * 1024) {
        throw fileTooLarge('CV files must be 10 MB or smaller.');
      }
      const rawName = cvFile.originalname || 'candidate-cv.pdf';
      if (rawName.startsWith('.') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
        throw fileInvalid('Invalid CV filename.');
      }
      const parts = rawName.toLowerCase().split('.').filter(Boolean);
      if (parts.length < 2) {
        throw fileInvalid('CV file must have a valid extension.');
      }
      const extension = parts[parts.length - 1] ?? '';
      const allowedExtensions = new Set(['pdf', 'doc', 'docx']);
      if (!allowedExtensions.has(extension)) {
        throw fileInvalid('CV files must be PDF, DOC, or DOCX.');
      }
      const dangerousExtensions = new Set(['exe', 'sh', 'bat', 'cmd', 'js', 'ts', 'html', 'htm', 'php', 'py', 'vbs', 'scr', 'dll']);
      for (const part of parts.slice(1, -1)) {
        if (dangerousExtensions.has(part)) {
          throw fileUnsafe('CV filename contains an invalid extension.');
        }
      }
      const allowedMimeTypes = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]);
      if (!allowedMimeTypes.has(cvFile.mimetype)) {
        throw fileInvalid('CV files must be PDF, DOC, or DOCX.');
      }
      safeCvName = path.basename(rawName).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || `cv.${extension}`;
      const scan = this.scanner.scan(cvFile.buffer, safeCvName, cvFile.mimetype);
      if (scan.status !== 'Clean') {
        throw fileUnsafe('The uploaded file is invalid or could not be verified.');
      }
    }

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.findFirst({
          where: {
            code: {
              equals: normalizeIdentifier(organizationCode, 'organization'),
              mode: 'insensitive',
            },
            status: 'Active',
          },
        });
        if (!organization) throw this.publicNotFound();

        const lockedVacancy = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "vacancies"
          WHERE "id" = (
            SELECT v."id"
            FROM "vacancies" v
            WHERE v."organizationId" = CAST(${organization.id} AS uuid)
              AND LOWER(v."vacancyCode") = LOWER(${normalizeIdentifier(vacancyCode, 'vacancy')})
              AND v."status" = 'Open'
              AND v."openedAt" IS NOT NULL
              AND v."openedAt" <= CURRENT_TIMESTAMP
            LIMIT 1
          )
          FOR UPDATE
        `;
        const vacancyId = lockedVacancy[0]?.id;
        if (!vacancyId) throw this.publicNotFound();

        const vacancy = await tx.vacancy.findUnique({
          where: { id: vacancyId },
          include: { position: true },
        });
        if (!vacancy || vacancy.status !== 'Open') throw this.publicNotFound();

        const candidateMatches = await tx.candidate.findMany({
          where: {
            organizationId: organization.id,
            OR: [
              ...(email ? [{ email }] : []),
              ...(normalizedPhone ? [{ phone: { not: null } }] : []),
            ],
          },
          select: { id: true, status: true, candidateCode: true, email: true, phone: true },
          take: 1000,
        });
        const existingCandidate = candidateMatches.find((candidate) =>
          (email && candidate.email?.toLowerCase() === email)
          || (normalizedPhone && normalizePhone(candidate.phone) === normalizedPhone),
        );
        const candidateId = existingCandidate?.id ?? (await this.nextCode(tx, 'CND'));

        if (existingCandidate?.status === 'Blacklisted') {
          throw new ConflictException('This application could not be submitted.');
        }

        const existingApplication = existingCandidate
          ? await tx.application.findUnique({
              where: { vacancyId_candidateId: { vacancyId: vacancy.id, candidateId: existingCandidate.id } },
              select: { id: true },
            })
          : null;
        if (existingApplication) {
          throw new ConflictException('An application for this vacancy already exists.');
        }

        const candidate = existingCandidate
          ? await tx.candidate.update({
              where: { id: existingCandidate.id },
              data: {
                consentStatus: 'Active',
                consentCapturedAt: new Date(),
                consentSource: source,
              },
            })
          : await tx.candidate.create({
              data: {
                organizationId: organization.id,
                candidateCode: candidateId,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                email,
                phone,
                currentTitle: cleanOptional(dto.currentTitle),
                currentCompany: cleanOptional(dto.currentCompany),
                location: cleanOptional(dto.location),
                skills: (dto.skills ?? []).map((skill) => skill.trim()).filter(Boolean),
                source,
                consentStatus: 'Active',
                consentCapturedAt: new Date(),
                consentSource: source,
                status: 'Active',
              },
            });

        const applicationCode = await this.nextCode(tx, 'APP');
        const created = await tx.application.create({
          data: {
            organizationId: organization.id,
            applicationCode,
            vacancyId: vacancy.id,
            candidateId: candidate.id,
            stage: 'Applied',
            source,
          },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: created.id,
            fromStage: null,
            toStage: 'Applied',
            reason: 'Public application submitted',
          },
        });

        if (cvFile && safeCvName) {
          const stored = await this.storage.put(organization.id, candidate.id, safeCvName, cvFile.buffer);
          const sha256 = createHash('sha256').update(cvFile.buffer).digest('hex');
          const doc = await tx.candidateDocument.create({
            data: {
              organizationId: organization.id,
              candidateId: candidate.id,
              documentType: 'CV',
              fileName: safeCvName,
              fileSize: cvFile.size,
              mimeType: cvFile.mimetype,
              storageKey: stored.storageKey,
              storageProvider: stored.provider,
              sha256,
              scanStatus: 'Clean',
              scanProvider: 'signature',
              scanMessage: 'Binary signature and malware test-signature checks passed.',
              scannedAt: new Date(),
              parserStatus: 'NotStarted',
              consentStatus: 'Active',
              uploadedById: null,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: organization.id,
              actorUserId: null,
              action: 'CV_FILE_UPLOAD',
              entityType: 'CandidateDocument',
              entityId: doc.id,
              result: 'SUCCESS',
              reason: `Public application CV uploaded for candidate ${candidate.candidateCode}`,
              afterData: { fileName: safeCvName, fileSize: cvFile.size, mimeType: cvFile.mimetype },
            },
          });
        }

        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            actorUserId: null,
            action: 'PUBLIC_APPLICATION_CREATE',
            entityType: 'Application',
            entityId: created.id,
            result: 'SUCCESS',
            reason: `source=${source}; consent=accepted; cvAttached=${Boolean(cvFile)}`,
            afterData: { source, consentAccepted: true, cvAttached: Boolean(cvFile) },
          },
        });

        return { applicationCode: created.applicationCode };
      });

      return {
        accepted: true,
        applicationCode: application.applicationCode,
        vacancyCode: normalizeIdentifier(vacancyCode, 'vacancy'),
        message: 'Your application has been received.',
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An application for this vacancy already exists.');
      }
      throw error;
    }
  }

  private async findOrganization(code: string) {
    const normalizedCode = normalizeIdentifier(code, 'organization');
    const organization = await this.prisma.organization.findFirst({
      where: { code: { equals: normalizedCode, mode: 'insensitive' }, status: 'Active' },
      select: { id: true, code: true, name: true },
    });
    if (!organization) throw this.publicNotFound();
    return organization;
  }

  private async findOpenVacancy(organizationId: string, code: string): Promise<PublicVacancyRecord> {
    const normalizedCode = normalizeIdentifier(code, 'vacancy');
    const vacancy = await this.prisma.vacancy.findFirst({
      where: {
        organizationId,
        vacancyCode: { equals: normalizedCode, mode: 'insensitive' },
        status: 'Open',
        openedAt: { not: null, lte: new Date() },
      },
      include: {
        organization: true,
        branch: true,
        position: true,
        vacancyRequest: true,
      },
    });
    if (!vacancy) throw this.publicNotFound();
    return vacancy;
  }

  private toPublicJob(vacancy: PublicVacancyRecord): PublicJob {
    const organizationCode = vacancy.organization.code;
    return {
      vacancyCode: vacancy.vacancyCode,
      organizationCode,
      organizationName: vacancy.organization.name,
      positionTitle: vacancy.position.title,
      description: vacancy.description ?? vacancy.position.description,
      jobSummary: vacancy.jobSummary,
      responsibilities: vacancy.responsibilities,
      qualifications: vacancy.qualifications,
      benefits: vacancy.benefits,
      branchName: vacancy.branch.name,
      location: vacancy.location ?? vacancy.branch.city ?? vacancy.branch.name,
      employmentType: vacancy.vacancyRequest.employmentType,
      requiredSkills: vacancy.requiredSkills,
      minExperienceYears: vacancy.minExperienceYears,
      targetStartDate: vacancy.targetStartDate?.toISOString().slice(0, 10) ?? null,
      publishedAt: (vacancy.openedAt ?? vacancy.createdAt).toISOString(),
      detailPath: `/careers/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancy.vacancyCode)}`,
      applyPath: `/careers/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancy.vacancyCode)}/apply`,
    };
  }

  private async nextCode(tx: Prisma.TransactionClient, prefix: 'CND' | 'APP'): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await tx.codeSequence.upsert({
      where: { key: `${prefix}:${year}` },
      create: { key: `${prefix}:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(sequence.lastIssued).padStart(3, '0')}`;
  }

  private publicNotFound(): NotFoundException {
    return new NotFoundException('The requested career site or job is not available.');
  }
}

function normalizeIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!PUBLIC_IDENTIFIER.test(normalized)) {
    throw new NotFoundException(`The requested ${label} is not available.`);
  }
  return normalized;
}

function normalizeSource(value: string | undefined): string {
  const normalized = (value ?? DEFAULT_SOURCE).trim().toLowerCase();
  if (!PUBLIC_SOURCE_PATTERN.test(normalized)) {
    throw new BadRequestException('The application source is invalid.');
  }
  return normalized;
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

function normalizePhone(value: string | null): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length >= 7 ? digits : null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
