import { Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { importInvalid } from '../common/errors/api-error';
import type { UploadImportDto, SaveDecisionDto } from './import.dto';
import type {
  ImportJobSummary,
  ImportRowDecision,
  ImportRowItem,
  ImportRowResult,
  PaginatedResult,
} from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(job: {
    id: string;
    fileName: string;
    dataset?: string;
    sourceFormat?: string;
    sheetName?: string | null;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    newRows: number;
    updateRows: number;
    createdAt: Date;
  }, unresolvedDuplicateRows?: number): ImportJobSummary {
    return {
      id: job.id,
      fileName: job.fileName,
      ...(job.dataset ? { dataset: job.dataset } : {}),
      ...(job.sourceFormat ? { sourceFormat: job.sourceFormat } : {}),
      ...(job.sheetName !== undefined ? { sheetName: job.sheetName } : {}),
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      duplicateRows: job.duplicateRows,
      ...(unresolvedDuplicateRows === undefined ? {} : { unresolvedDuplicateRows }),
      newRows: job.newRows,
      updateRows: job.updateRows,
      createdAt: job.createdAt.toISOString(),
    };
  }

  private normalizeEmail(email: string | null | undefined): string {
    return email?.trim().toLowerCase() ?? '';
  }

  private normalizePhone(phone: string | null | undefined): string {
    return phone?.replace(/\D/g, '') ?? '';
  }

  private isEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async nextCandidateCode(client: { codeSequence: PrismaService['codeSequence'] }): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await client.codeSequence.upsert({
      where: { key: `CND:${year}` },
      create: { key: `CND:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `CND-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
  }

  async listJobs(
    organizationId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<ImportJobSummary>> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = { organizationId, dataset: 'candidates' };
    const [total, jobs] = await Promise.all([
      this.prisma.candidateImportJob.count({ where }),
      this.prisma.candidateImportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      data: jobs.map((job) => this.toSummary(job)),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async upload(organizationId: string, userId: string, dto: UploadImportDto): Promise<{ jobId: string }> {
    const emails = dto.rows
      .map((row) => row.email ? this.normalizeEmail(row.email) : null)
      .filter((email): email is string => Boolean(email));

    const existingCandidates = emails.length === 0 ? [] : await this.prisma.candidate.findMany({
      where: { organizationId, email: { in: emails, mode: 'insensitive' } },
      select: { email: true, phone: true },
    });
    const existingEmails = new Set(existingCandidates.map(c => this.normalizeEmail(c.email)).filter(Boolean));
    const phoneNumbers = dto.rows.map((row) => this.normalizePhone(row.phone)).filter(Boolean);
    const existingPhones = phoneNumbers.length === 0 ? new Set<string>() : new Set(
      (await this.prisma.candidate.findMany({
        where: { organizationId, phone: { in: phoneNumbers } },
        select: { phone: true },
      })).map((candidate) => this.normalizePhone(candidate.phone)).filter(Boolean),
    );
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    const totalRows = dto.rows.length;
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const rowData = dto.rows.map((row, index) => {
      let result: ImportRowResult;
      let details: string | null = null;
      const normalizedEmail = row.email ? this.normalizeEmail(row.email) : null;
      const normalizedPhone = this.normalizePhone(row.phone);

      if (!row.email && !normalizedPhone) {
        result = 'Invalid';
        details = 'A valid email or phone number is required';
        invalidRows++;
      } else if (normalizedEmail && !this.isEmail(normalizedEmail)) {
        result = 'Invalid';
        details = 'Email format is invalid';
        invalidRows++;
      } else if (!row.firstName || !row.lastName) {
        result = 'Invalid';
        details = 'First and last name are required';
        invalidRows++;
      } else if (
        (normalizedEmail && (existingEmails.has(normalizedEmail) || seenEmails.has(normalizedEmail))) ||
        (normalizedPhone && (existingPhones.has(normalizedPhone) || seenPhones.has(normalizedPhone)))
      ) {
        result = 'Duplicate';
        details = normalizedEmail && existingEmails.has(normalizedEmail)
          ? 'Email already exists in candidates'
          : normalizedPhone && existingPhones.has(normalizedPhone)
            ? 'Phone already exists in candidates'
            : 'Email or phone is duplicated in this import file';
        duplicateRows++;
      } else {
        result = 'Valid';
        validRows++;
      }

      if (normalizedEmail) seenEmails.add(normalizedEmail);
      if (normalizedPhone) seenPhones.add(normalizedPhone);

      return {
        rowNumber: index + 1,
        rawData: {
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          email: normalizedEmail,
          phone: row.phone ?? null,
          currentTitle: row.currentTitle ?? null,
          currentCompany: row.currentCompany ?? null,
          skills: row.skills ?? [],
          experienceYears: row.experienceYears ?? null,
          location: row.location ?? null,
          certifications: row.certifications ?? [],
          languages: row.languages ?? [],
          education: row.education ?? null,
          summary: row.summary ?? null,
        },
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        email: normalizedEmail,
        phone: row.phone || null,
        result,
        details,
      };
    });

    const job = await this.prisma.candidateImportJob.create({
      data: {
        organizationId,
        uploadedById: userId,
        fileName: dto.fileName,
        dataset: 'candidates',
        sourceFormat: 'json',
        status: 'Review',
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
        rows: {
          createMany: {
            data: rowData,
          },
        },
      },
    });

    return { jobId: job.id };
  }

  async getJobSummary(organizationId: string, jobId: string): Promise<ImportJobSummary> {
    const [job, unresolvedDuplicateRows] = await Promise.all([
      this.prisma.candidateImportJob.findFirst({ where: { id: jobId, organizationId, dataset: 'candidates' } }),
      this.prisma.candidateImportRow.count({
        where: { job: { id: jobId, organizationId }, result: 'Duplicate', decision: null },
      }),
    ]);

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return this.toSummary(job, unresolvedDuplicateRows);
  }

  async getJobRows(
    organizationId: string,
    jobId: string,
    resultFilter?: string,
    page = 1,
    pageSize = 20
  ) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId, dataset: 'candidates' },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const where: Prisma.CandidateImportRowWhereInput = { jobId };
    if (resultFilter) {
      where.result = resultFilter;
    }

    const skip = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.candidateImportRow.count({ where }),
      this.prisma.candidateImportRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      rows: rows.map((r): ImportRowItem => {
        const raw = (r.rawData && typeof r.rawData === 'object') ? (r.rawData as Record<string, unknown>) : {};
        return {
          id: r.id,
          rowNumber: r.rowNumber,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          phone: r.phone,
          currentTitle: typeof raw.currentTitle === 'string' ? raw.currentTitle : null,
          currentCompany: typeof raw.currentCompany === 'string' ? raw.currentCompany : null,
          skills: Array.isArray(raw.skills) ? (raw.skills as string[]) : [],
          experienceYears: typeof raw.experienceYears === 'number' ? raw.experienceYears : null,
          location: typeof raw.location === 'string' ? raw.location : null,
          certifications: Array.isArray(raw.certifications) ? (raw.certifications as string[]) : [],
          languages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],
          education: typeof raw.education === 'string' ? raw.education : null,
          summary: typeof raw.summary === 'string' ? raw.summary : null,
          result: r.result as ImportRowResult,
          details: r.details,
          decision: r.decision as ImportRowDecision | null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async saveDecision(organizationId: string, jobId: string, rowId: string, dto: SaveDecisionDto) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId, dataset: 'candidates' },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const row = await this.prisma.candidateImportRow.findFirst({
      where: { id: rowId, jobId },
    });

    if (!row) {
      throw new NotFoundException('Import row not found');
    }

    if (row.result !== 'Duplicate') {
      throw importInvalid('Decision can only be made for Duplicate rows');
    }

    await this.prisma.candidateImportRow.update({
      where: { id: row.id },
      data: { decision: dto.decision },
    });

    return { success: true };
  }

  async confirmJob(organizationId: string, jobId: string, createdById?: string) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId, dataset: 'candidates' },
      include: { rows: true },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (job.status !== 'Review') {
      throw importInvalid(`Job cannot be confirmed from status ${job.status}`);
    }

    const duplicateRows = job.rows.filter(r => r.result === 'Duplicate');
    const unresolved = duplicateRows.some(r => !r.decision);

    if (unresolved) {
      throw importInvalid('All duplicate rows must have a decision before confirming');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedJob = await tx.candidateImportJob.updateMany({
        where: { id: job.id, organizationId, status: 'Review' },
        data: { status: 'Processing' },
      });
      if (lockedJob.count !== 1) {
        throw importInvalid('Import job is already being processed');
      }

      let newRowsCount = 0;
      let updateRowsCount = 0;

      for (const row of job.rows) {
        if (row.result === 'Invalid') continue;

        const email = row.email ? this.normalizeEmail(row.email) : null;
        const phone = this.normalizePhone(row.phone) || null;
        if (!email && !phone) continue;
        const raw = (row.rawData && typeof row.rawData === 'object') ? (row.rawData as Record<string, unknown>) : {};
        const currentTitle = typeof raw.currentTitle === 'string' ? raw.currentTitle : null;
        const currentCompany = typeof raw.currentCompany === 'string' ? raw.currentCompany : null;
        const skills = Array.isArray(raw.skills) ? (raw.skills as string[]) : [];
        const experienceYears = typeof raw.experienceYears === 'number' ? raw.experienceYears : null;
        const location = typeof raw.location === 'string' ? raw.location : null;
        const certifications = Array.isArray(raw.certifications) ? (raw.certifications as string[]) : [];
        const languages = Array.isArray(raw.languages) ? (raw.languages as string[]) : [];
        const source = typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : null;
        const availability = typeof raw.availability === 'string' && raw.availability.trim() ? raw.availability.trim() : null;
        const importedStatus = typeof raw.status === 'string' && ['Active', 'Blacklisted', 'Archived'].includes(raw.status)
          ? raw.status
          : 'Active';

        if (row.result === 'Valid') {
          const existing = await this.findExistingByContact(tx, organizationId, email, phone);
          if (existing) continue;

          await tx.candidate.create({
            data: {
              organizationId,
              createdById: createdById ?? null,
              candidateCode: await this.nextCandidateCode(tx),
              firstName: row.firstName!,
              lastName: row.lastName!,
              email,
              phone,
              currentTitle,
              currentCompany,
              skills,
              experienceYears,
              location,
              certifications,
              languages,
              source,
              availability,
              status: importedStatus,
            },
          });
          newRowsCount++;
        } else if (row.result === 'Duplicate' && row.decision === 'Update') {
          const existing = await this.findExistingByContact(tx, organizationId, email, phone);

          if (existing) {
            await tx.candidate.update({
              where: { id: existing.id },
              data: {
                firstName: row.firstName || existing.firstName,
                lastName: row.lastName || existing.lastName,
                phone: phone || existing.phone,
                currentTitle: currentTitle ?? existing.currentTitle,
                currentCompany: currentCompany ?? existing.currentCompany,
                skills: skills.length > 0 ? skills : existing.skills,
                experienceYears: experienceYears ?? existing.experienceYears,
                location: location ?? existing.location,
                source: source ?? existing.source,
                availability: availability ?? existing.availability,
              },
            });
            updateRowsCount++;
          }
        }
      }

      return tx.candidateImportJob.update({
        where: { id: job.id },
        data: { status: 'Confirmed', newRows: newRowsCount, updateRows: updateRowsCount },
      });
    });

    return { success: true, status: result.status, newRows: result.newRows, updateRows: result.updateRows };
  }

  async getErrorReport(organizationId: string, jobId: string) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId, dataset: 'candidates' },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const rows = await this.prisma.candidateImportRow.findMany({
      where: { jobId, result: 'Invalid' },
      orderBy: { rowNumber: 'asc' },
    });

    return rows.map((r): ImportRowItem => ({
      id: r.id,
      rowNumber: r.rowNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      result: r.result as ImportRowResult,
      details: r.details,
      decision: r.decision as ImportRowDecision | null,
    }));
  }

  private async findExistingByContact(
    tx: Prisma.TransactionClient,
    organizationId: string,
    email: string | null,
    phone: string | null,
  ) {
    if (email) {
      const emailMatch = await tx.candidate.findFirst({
        where: { organizationId, email: { equals: email, mode: 'insensitive' } },
      });
      if (emailMatch) return emailMatch;
    }
    if (!phone) return null;
    const candidates = await tx.candidate.findMany({
      where: { organizationId, phone: { not: null } },
      take: 1000,
    });
    return candidates.find((candidate) => this.normalizePhone(candidate.phone) === phone) ?? null;
  }
}
