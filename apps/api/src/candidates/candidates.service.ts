import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { Candidate, PaginatedResult } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  CandidateQueryDto,
  CreateCandidateDto,
  UpdateCandidateDto,
} from './candidates.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listCandidates(
    organizationId: string,
    query: CandidateQueryDto,
    disclosure: { viewPii: boolean },
  ): Promise<PaginatedResult<Candidate>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CandidateWhereInput = { organizationId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { candidateCode: { contains: term, mode: 'insensitive' } },
        { currentCompany: { contains: term, mode: 'insensitive' } },
      ];
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

  async getCandidate(
    organizationId: string,
    id: string,
    disclosure: { viewPii: boolean },
  ): Promise<Candidate> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${id} was not found.`);
    }

    return this.toCandidate(candidate, disclosure);
  }

  async createCandidate(
    organizationId: string,
    dto: CreateCandidateDto,
  ): Promise<Candidate> {
    const created = await this.createCandidateRecord(organizationId, dto);
    return this.toCandidate(created, { viewPii: true });
  }

  private async createCandidateRecord(
    organizationId: string,
    dto: CreateCandidateDto,
  ): Promise<Prisma.CandidateGetPayload<{}>> {
    const existing = await this.prisma.candidate.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: dto.email.trim().toLowerCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Candidate with email ${dto.email} already exists in your organization.`,
      );
    }

    const candidateCode = await this.nextCandidateCode();
    const created = await this.prisma.candidate.create({
      data: {
        organizationId,
        candidateCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() ?? null,
        currentTitle: dto.currentTitle?.trim() ?? null,
        currentCompany: dto.currentCompany?.trim() ?? null,
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
  ): Promise<Candidate> {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${id} was not found.`);
    }

    if (dto.email && dto.email.trim().toLowerCase() !== candidate.email) {
      const existing = await this.prisma.candidate.findUnique({
        where: {
          organizationId_email: {
            organizationId,
            email: dto.email.trim().toLowerCase(),
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Candidate with email ${dto.email} already exists in your organization.`,
        );
      }
    }

    const dataToUpdate: Prisma.CandidateUpdateInput = {};
    if (dto.firstName) dataToUpdate.firstName = dto.firstName.trim();
    if (dto.lastName) dataToUpdate.lastName = dto.lastName.trim();
    if (dto.email) dataToUpdate.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone?.trim() ?? null;
    if (dto.currentTitle !== undefined) dataToUpdate.currentTitle = dto.currentTitle?.trim() ?? null;
    if (dto.currentCompany !== undefined) dataToUpdate.currentCompany = dto.currentCompany?.trim() ?? null;
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

  private async nextCandidateCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `CND:${year}` },
      create: { key: `CND:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `CND-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
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

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'restricted';
  const visible = localPart.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(1, localPart.length - 1))}@${domain}`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  const visible = phone.slice(-2);
  return `${'•'.repeat(Math.max(0, phone.length - 2))}${visible}`;
}
