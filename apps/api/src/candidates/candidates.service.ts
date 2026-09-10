import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser, Candidate, CandidateMetrics, PaginatedResult } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { exportFailed } from '../common/errors/api-error';
/* DocumentStorageService is a runtime Nest dependency and must remain a value import. */
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { DocumentStorageService } from '../documents/document-storage.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CandidateQueryDto,
  CreateCandidateDto,
  UpdateCandidateDto,
} from './candidates.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() private readonly documentStorage?: DocumentStorageService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
  ) {}

  private async visibilityWhere(organizationId: string, user?: AuthUser): Promise<Prisma.CandidateWhereInput> {
    if (!user || !this.accessControl || user.roleCodes.includes('ADMINISTRATOR')) {
      return { organizationId };
    }
    const applicationVisibility = await this.accessControl.getApplicationVisibilityWhere(user);
    return {
      organizationId: user.organizationId,
      OR: [
        { createdById: user.userId },
        { applications: { some: applicationVisibility } },
      ],
    };
  }

  async exportExcel(
    organizationId: string,
    query: CandidateQueryDto,
    disclosure: { viewPii: boolean },
    user?: AuthUser,
  ): Promise<Buffer> {
    try {
      const where: Prisma.CandidateWhereInput = await this.visibilityWhere(organizationId, user);

      if (query.status) {
        where.status = query.status;
      }
      if (query.source) {
        where.source = query.source;
      }
      if (query.search?.trim()) {
        const term = query.search.trim();
        const searchOr: Prisma.CandidateWhereInput[] = [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { candidateCode: { contains: term, mode: 'insensitive' } },
            { currentCompany: { contains: term, mode: 'insensitive' } },
          ];
        const searchClause: Prisma.CandidateWhereInput = { OR: searchOr };
        if (where.OR) {
          where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            searchClause,
          ];
        } else {
          where.OR = searchOr;
        }
      }

      const candidates = await this.prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const headers = [
        'Candidate Code',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Current Title',
        'Current Company',
        'Location',
        'Experience (Years)',
        'Skills',
        'Source',
        'Status',
        'Consent Status',
        'Consent Captured At (UTC)',
        'Created At (UTC)',
      ];

      const rows = candidates.map((c) => [
        c.candidateCode,
        c.firstName,
        c.lastName,
        disclosure.viewPii ? c.email : maskEmail(c.email),
        disclosure.viewPii ? (c.phone ?? '') : maskPhone(c.phone),
        c.currentTitle ?? '',
        c.currentCompany ?? '',
        c.location ?? '',
        c.experienceYears ?? '',
        Array.isArray(c.skills) ? c.skills.join(', ') : '',
        c.source ?? '',
        c.status,
        c.consentStatus,
        c.consentCapturedAt ? c.consentCapturedAt.toISOString() : '',
        c.createdAt.toISOString(),
      ]);

      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Candidates');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('Unable to export candidates workbook.');
    }
  }

  async listCandidates(
    organizationId: string,
    query: CandidateQueryDto,
    disclosure: { viewPii: boolean },
    user?: AuthUser,
  ): Promise<PaginatedResult<Candidate>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CandidateWhereInput = await this.visibilityWhere(organizationId, user);

    if (query.status) {
      where.status = query.status;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      const searchOr: Prisma.CandidateWhereInput[] = [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { candidateCode: { contains: term, mode: 'insensitive' } },
          { currentCompany: { contains: term, mode: 'insensitive' } },
        ];
      const searchClause: Prisma.CandidateWhereInput = { OR: searchOr };
      if (where.OR) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          searchClause,
        ];
      } else {
        where.OR = searchOr;
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: items.map((c) => this.toCandidate(c, disclosure)),
      total,
      page,
      pageSize,
    };
  }

  async getMetrics(organizationId: string, user?: AuthUser): Promise<CandidateMetrics> {
    const visibility = await this.visibilityWhere(organizationId, user);
    const directOrReferral: Prisma.CandidateWhereInput = {
      OR: [
        { source: { contains: 'direct', mode: 'insensitive' } },
        { source: { contains: 'referral', mode: 'insensitive' } },
        { source: { contains: 'career', mode: 'insensitive' } },
      ],
    };
    const [totalCandidates, activeInPipeline, talentPool, disqualified, directReferral] = await Promise.all([
      this.prisma.candidate.count({ where: visibility }),
      this.prisma.candidate.count({
        where: {
          AND: [visibility, {
            applications: {
              some: {
                organizationId,
                stage: { in: ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'] },
              },
            },
          }],
        },
      }),
      this.prisma.candidate.count({
        where: {
          AND: [visibility, {
            talentPoolMemberships: {
              some: {
                talentPool: { organizationId, status: 'Active' },
                consentStatus: 'Active',
                eligibility: 'Eligible',
              },
            },
          }],
        },
      }),
      this.prisma.candidate.count({ where: { AND: [visibility, { status: 'Blacklisted' }] } }),
      this.prisma.candidate.count({ where: { AND: [visibility, directOrReferral] } }),
    ]);

    return {
      totalCandidates,
      activeInPipeline,
      talentPool,
      disqualified,
      directReferralPercentage: totalCandidates > 0
        ? Math.round((directReferral / totalCandidates) * 1000) / 10
        : null,
    };
  }

  async getCandidate(
    organizationId: string,
    id: string,
    disclosure: { viewPii: boolean },
    user?: AuthUser,
  ): Promise<Candidate> {
    const visibility = await this.visibilityWhere(organizationId, user);
    const candidate = await this.prisma.candidate.findFirst({
      where: { id, ...visibility },
    });

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${id} was not found.`);
    }

    return this.toCandidate(candidate, disclosure);
  }

  /** Return visible duplicate suggestions without merging or mutating identities. */
  async findDuplicateSuggestions(
    organizationId: string,
    query: { email?: string; phone?: string },
    user?: AuthUser,
    disclosure: { viewPii: boolean } = { viewPii: false },
  ): Promise<Candidate[]> {
    const email = query.email?.trim().toLowerCase();
    const phone = normalizePhone(query.phone);
    if (!email && !phone) return [];
    const visibility = await this.visibilityWhere(organizationId, user);
    const candidates = await this.prisma.candidate.findMany({
      where: {
        AND: [visibility, {
          OR: [
            ...(email ? [{ email: email }] : []),
            ...(phone ? [{ phone: { not: null } }] : []),
          ],
        }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return candidates
      .filter((candidate) => (email && candidate.email?.toLowerCase() === email) || (phone && normalizePhone(candidate.phone) === phone))
      .map((candidate) => this.toCandidate(candidate, disclosure));
  }

  async createCandidate(
    organizationId: string,
    dto: CreateCandidateDto,
    createdById?: string,
  ): Promise<Candidate> {
    const created = await this.createCandidateRecord(organizationId, dto, createdById);
    return this.toCandidate(created, { viewPii: true });
  }

  private async createCandidateRecord(
    organizationId: string,
    dto: CreateCandidateDto,
    createdById?: string,
  ): Promise<Prisma.CandidateGetPayload<{}>> {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = normalizePhone(dto.phone);
    if (!email && !phone) {
      throw new BadRequestException('Provide at least one valid contact method: email or phone.');
    }
    const existing = await this.findExistingByContact(organizationId, email, phone);

    if (existing) {
      throw new ConflictException('A candidate with the same email or phone already exists in your organization.');
    }

    const candidateCode = await this.nextCandidateCode();
    const created = await this.prisma.candidate.create({
      data: {
        organizationId,
        createdById: createdById ?? null,
        candidateCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone,
        currentTitle: dto.currentTitle?.trim() ?? null,
        currentCompany: dto.currentCompany?.trim() ?? null,
        summary: dto.summary?.trim() ?? null,
        source: dto.source?.trim() ?? null,
        status: 'Active',
        skills: dto.skills ?? [],
        experienceYears: dto.experienceYears ?? null,
        location: dto.location?.trim() ?? null,
        certifications: dto.certifications ?? [],
        languages: dto.languages ?? [],
        availability: dto.availability?.trim() ?? null,
      },
    });

    return created;
  }

  async updateCandidate(
    organizationId: string,
    id: string,
    dto: UpdateCandidateDto,
    user?: AuthUser,
  ): Promise<Candidate> {
    const visibility = await this.visibilityWhere(organizationId, user);
    const candidate = await this.prisma.candidate.findFirst({ where: { id, ...visibility } });
    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${id} was not found.`);
    }

    const nextEmail = dto.email === undefined ? candidate.email : dto.email?.trim().toLowerCase() || null;
    const nextPhone = dto.phone === undefined ? normalizePhone(candidate.phone) : normalizePhone(dto.phone);
    if (!nextEmail && !nextPhone) {
      throw new BadRequestException('Provide at least one valid contact method: email or phone.');
    }
    if (dto.email !== undefined || dto.phone !== undefined) {
      const existing = await this.findExistingByContact(organizationId, nextEmail, nextPhone, id);
      if (existing) {
        throw new ConflictException('A candidate with the same email or phone already exists in your organization.');
      }
    }

    const dataToUpdate: Prisma.CandidateUpdateInput = {};
    if (dto.firstName) dataToUpdate.firstName = dto.firstName.trim();
    if (dto.lastName) dataToUpdate.lastName = dto.lastName.trim();
    if (dto.email !== undefined) dataToUpdate.email = nextEmail;
    if (dto.phone !== undefined) dataToUpdate.phone = nextPhone;
    if (dto.currentTitle !== undefined) dataToUpdate.currentTitle = dto.currentTitle?.trim() ?? null;
    if (dto.currentCompany !== undefined) dataToUpdate.currentCompany = dto.currentCompany?.trim() ?? null;
    if (dto.summary !== undefined) dataToUpdate.summary = dto.summary?.trim() ?? null;
    if (dto.source !== undefined) dataToUpdate.source = dto.source?.trim() ?? null;
    if (dto.status) dataToUpdate.status = dto.status;
    if (dto.skills !== undefined) dataToUpdate.skills = dto.skills;
    if (dto.experienceYears !== undefined) dataToUpdate.experienceYears = dto.experienceYears;
    if (dto.location !== undefined) dataToUpdate.location = dto.location?.trim() ?? null;
    if (dto.certifications !== undefined) dataToUpdate.certifications = dto.certifications;
    if (dto.languages !== undefined) dataToUpdate.languages = dto.languages;
    if (dto.availability !== undefined) dataToUpdate.availability = dto.availability?.trim() ?? null;

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.toCandidate(updated, { viewPii: true });
  }

  /**
   * Permanently remove a candidate and the recruitment records that only exist
   * to support that candidate. This operation is deliberately administrator-only
   * because it bypasses the normal document archive/retention workflow.
   */
  async deleteCandidate(organizationId: string, id: string, user: AuthUser): Promise<{ deleted: true; candidateId: string; candidateCode: string }> {
    if (!user.roleCodes.includes('ADMINISTRATOR')) {
      throw new ForbiddenException('Only administrators can permanently delete candidate data.');
    }

    const candidate = await this.prisma.candidate.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        candidateCode: true,
        documents: { select: { storageKey: true } },
        applications: { select: { id: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate ${id} was not found.`);
    }

    const applicationIds = candidate.applications.map((application) => application.id);
    const storageKeys = candidate.documents.map((document) => document.storageKey);

    await this.prisma.$transaction(async (tx) => {
      // Candidate activities are stored as entity references rather than foreign keys.
      await tx.task.deleteMany({
        where: {
          organizationId,
          OR: [
            { entityType: 'Candidate', entityId: candidate.id },
            ...(applicationIds.length > 0
              ? [{ entityType: 'Application', entityId: { in: applicationIds } }]
              : []),
          ],
        },
      });

      if (applicationIds.length > 0) {
        const [interviews, offers] = await Promise.all([
          tx.interview.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true } }),
          tx.offer.findMany({ where: { organizationId, applicationId: { in: applicationIds } }, select: { id: true } }),
        ]);
        const interviewIds = interviews.map((interview) => interview.id);
        const offerIds = offers.map((offer) => offer.id);

        if (interviewIds.length > 0) {
          // Scorecards restrict interview deletion; attendees cascade with interviews.
          await tx.interviewScorecard.deleteMany({ where: { interviewId: { in: interviewIds } } });
          await tx.interview.deleteMany({ where: { id: { in: interviewIds }, organizationId } });
        }

        // Hiring cases reference offers restrictively, so remove the case before its offer.
        await tx.hiringCase.deleteMany({ where: { organizationId, applicationId: { in: applicationIds } } });
        if (offerIds.length > 0) {
          await tx.offer.deleteMany({ where: { id: { in: offerIds }, organizationId } });
        }

        await tx.applicationStatusHistory.deleteMany({ where: { applicationId: { in: applicationIds } } });
        await tx.applicationNote.deleteMany({ where: { organizationId, applicationId: { in: applicationIds } } });
        await tx.screeningLog.deleteMany({ where: { organizationId, applicationId: { in: applicationIds } } });
        await tx.application.deleteMany({ where: { id: { in: applicationIds }, organizationId, candidateId: candidate.id } });
      }

      await tx.candidateDocument.deleteMany({ where: { organizationId, candidateId: candidate.id } });
      await tx.talentPoolCandidate.deleteMany({ where: { candidateId: candidate.id } });
      await tx.candidate.delete({ where: { id: candidate.id } });
    });

    // Database state is authoritative. Clean up private files after the transaction
    // so a storage failure cannot leave a partially deleted candidate record.
    const documentStorage = this.documentStorage;
    if (documentStorage && storageKeys.length > 0) {
      await Promise.allSettled(storageKeys.map((storageKey) => documentStorage.remove(storageKey)));
    }

    return { deleted: true, candidateId: candidate.id, candidateCode: candidate.candidateCode };
  }

  private async nextCandidateCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `CND:${year}` },
      create: { key: `CND:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `CND-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
  }

  private async findExistingByContact(
    organizationId: string,
    email: string | null,
    phone: string | null,
    excludeId?: string,
  ): Promise<Prisma.CandidateGetPayload<{}> | null> {
    const baseWhere: Prisma.CandidateWhereInput = {
      organizationId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    };
    if (email) {
      const emailMatch = await this.prisma.candidate.findFirst({ where: { ...baseWhere, email } });
      if (emailMatch) return emailMatch;
    }
    if (!phone) return null;
    const phoneCandidates = await this.prisma.candidate.findMany({
      where: { ...baseWhere, phone: { not: null } },
      take: 1000,
    });
    return phoneCandidates.find((item) => normalizePhone(item.phone) === phone) ?? null;
  }

  private toCandidate(
    record: Prisma.CandidateGetPayload<{}>,
    disclosure: { viewPii: boolean },
  ): Candidate {
    return {
      id: record.id,
      organizationId: record.organizationId,
      candidateCode: record.candidateCode,
      firstName: record.firstName,
      lastName: record.lastName,
      email: disclosure.viewPii ? record.email : maskEmail(record.email),
      phone: disclosure.viewPii ? record.phone : maskPhone(record.phone),
      currentTitle: record.currentTitle,
      currentCompany: record.currentCompany,
      summary: record.summary,
      source: record.source,
      status: record.status as Candidate['status'],
      consentStatus: record.consentStatus,
      consentCapturedAt: record.consentCapturedAt?.toISOString() ?? null,
      consentSource: record.consentSource,
      skills: record.skills,
      experienceYears: record.experienceYears,
      location: record.location,
      certifications: record.certifications,
      languages: record.languages,
      availability: record.availability,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

function maskEmail(email: string | null): string {
  if (!email) return 'Not provided';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'restricted';
  const visible = localPart.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(1, localPart.length - 1))}@${domain}`;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  const visible = phone.slice(-2);
  return `${'•'.repeat(Math.max(0, phone.length - 2))}${visible}`;
}
