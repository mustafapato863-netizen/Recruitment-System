import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { UploadImportDto, SaveDecisionDto } from './import.dto';
import type {
  ImportJobSummary,
  ImportRowDecision,
  ImportRowItem,
  ImportRowResult,
} from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async nextCandidateCode(client: Pick<PrismaService, 'codeSequence'>): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await client.codeSequence.upsert({
      where: { key: `CAN:${year}` },
      create: { key: `CAN:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `CAN-${year}-${String(sequence.lastIssued).padStart(4, '0')}`;
  }

  async upload(organizationId: string, userId: string, dto: UploadImportDto): Promise<{ jobId: string }> {
    const emails = dto.rows
      .map((row) => row.email ? this.normalizeEmail(row.email) : null)
      .filter((email): email is string => Boolean(email));

    const existingCandidates = emails.length === 0 ? [] : await this.prisma.candidate.findMany({
      where: { organizationId, email: { in: emails, mode: 'insensitive' } },
      select: { email: true },
    });
    const existingEmails = new Set(existingCandidates.map(c => this.normalizeEmail(c.email)));
    const seenEmails = new Set<string>();

    const totalRows = dto.rows.length;
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const rowData = dto.rows.map((row, index) => {
      let result: ImportRowResult;
      let details: string | null = null;
      const normalizedEmail = row.email ? this.normalizeEmail(row.email) : null;

      if (!row.email) {
        result = 'Invalid';
        details = 'Email is required';
        invalidRows++;
      } else if (!row.firstName || !row.lastName) {
        result = 'Invalid';
        details = 'First and last name are required';
        invalidRows++;
      } else if (existingEmails.has(normalizedEmail!) || seenEmails.has(normalizedEmail!)) {
        result = 'Duplicate';
        details = existingEmails.has(normalizedEmail!)
          ? 'Email already exists in candidates'
          : 'Email is duplicated in this import file';
        duplicateRows++;
      } else {
        result = 'Valid';
        validRows++;
      }

      if (normalizedEmail) seenEmails.add(normalizedEmail);

      return {
        rowNumber: index + 1,
        rawData: {
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          email: normalizedEmail,
          phone: row.phone ?? null,
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
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return {
      id: job.id,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      duplicateRows: job.duplicateRows,
      newRows: job.newRows,
      updateRows: job.updateRows,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async getJobRows(
    organizationId: string,
    jobId: string,
    resultFilter?: string,
    page = 1,
    pageSize = 20
  ) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId },
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
      rows: rows.map((r): ImportRowItem => ({
        id: r.id,
        rowNumber: r.rowNumber,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        result: r.result as ImportRowResult,
        details: r.details,
        decision: r.decision as ImportRowDecision | null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async saveDecision(organizationId: string, jobId: string, rowId: string, dto: SaveDecisionDto) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId },
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
      throw new BadRequestException('Decision can only be made for Duplicate rows');
    }

    await this.prisma.candidateImportRow.update({
      where: { id: row.id },
      data: { decision: dto.decision },
    });

    return { success: true };
  }

  async confirmJob(organizationId: string, jobId: string) {
    const job = await this.prisma.candidateImportJob.findFirst({
      where: { id: jobId, organizationId },
      include: { rows: true },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (job.status !== 'Review') {
      throw new BadRequestException(`Job cannot be confirmed from status ${job.status}`);
    }

    const duplicateRows = job.rows.filter(r => r.result === 'Duplicate');
    const unresolved = duplicateRows.some(r => !r.decision);

    if (unresolved) {
      throw new BadRequestException('All duplicate rows must have a decision before confirming');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedJob = await tx.candidateImportJob.updateMany({
        where: { id: job.id, organizationId, status: 'Review' },
        data: { status: 'Processing' },
      });
      if (lockedJob.count !== 1) {
        throw new BadRequestException('Import job is already being processed');
      }

      let newRowsCount = 0;
      let updateRowsCount = 0;

      for (const row of job.rows) {
        if (row.result === 'Invalid' || !row.email) continue;

        const email = this.normalizeEmail(row.email);
        if (row.result === 'Valid') {
          const existing = await tx.candidate.findFirst({
            where: { organizationId, email: { equals: email, mode: 'insensitive' } },
          });
          if (existing) continue;

          await tx.candidate.create({
            data: {
              organizationId,
              candidateCode: await this.nextCandidateCode(tx),
              firstName: row.firstName!,
              lastName: row.lastName!,
              email,
              phone: row.phone,
              status: 'Active',
            },
          });
          newRowsCount++;
        } else if (row.result === 'Duplicate' && row.decision === 'Update') {
          const existing = await tx.candidate.findFirst({
            where: { organizationId, email: { equals: email, mode: 'insensitive' } },
          });

          if (existing) {
            await tx.candidate.update({
              where: { id: existing.id },
              data: {
                firstName: row.firstName || existing.firstName,
                lastName: row.lastName || existing.lastName,
                phone: row.phone || existing.phone,
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
      where: { id: jobId, organizationId },
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
}
