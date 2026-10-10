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
import { contactKeys, normalizeEmailKey, normalizePhoneKey } from '../candidates/contact-keys';
import { catalogKey } from '../master-data/catalog-normalization';

/** B6: per-row outcome of a candidate import confirm. */
export interface ImportDuplicateReportRow {
  rowId: string;
  rowNumber: number;
  action: 'created' | 'linked' | 'skipped';
  candidateId: string | null;
  matchedBy: Array<'email' | 'phone'>;
  /** Empty fields on the existing person that the row filled. */
  filled: string[];
  /** Non-empty fields that differ; never overwritten. */
  conflicts: Array<{ field: string; existing: unknown; incoming: unknown }>;
}

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
    return normalizeEmailKey(email) ?? '';
  }

  /** B6: E.164-ish key (see candidates/contact-keys.ts), '' when not a usable phone. */
  private normalizePhone(phone: string | null | undefined): string {
    return normalizePhoneKey(phone) ?? '';
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
      where: { organizationId, emailNormalized: { in: emails } },
      select: { emailNormalized: true },
    });
    const existingEmails = new Set(existingCandidates.map((c) => c.emailNormalized).filter((e): e is string => Boolean(e)));
    const phoneNumbers = dto.rows.map((row) => this.normalizePhone(row.phone)).filter(Boolean);
    const existingPhones = phoneNumbers.length === 0 ? new Set<string>() : new Set(
      (await this.prisma.candidate.findMany({
        where: { organizationId, phoneNormalized: { in: phoneNumbers } },
        select: { phoneNormalized: true },
      })).map((candidate) => candidate.phoneNormalized).filter((p): p is string => Boolean(p)),
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

    const report: ImportDuplicateReportRow[] = [];
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
      const skillLibrary = await tx.masterDataValue.findMany({ where: { organizationId, category: 'skills', status: 'Active' }, select: { id: true, name: true } });
      const skillByKey = new Map(skillLibrary.map((v) => [catalogKey(v.name), v.id]));

      for (const row of job.rows) {
        const base = { rowId: row.id, rowNumber: row.rowNumber };
        if (row.result === 'Invalid') continue;
        if (row.result === 'Duplicate' && row.decision === 'Skip') {
          report.push({ ...base, action: 'skipped', candidateId: null, matchedBy: [], filled: [], conflicts: [] });
          continue;
        }

        const email = row.email ? this.normalizeEmail(row.email) || null : null;
        const phone = this.normalizePhone(row.phone) || null;
        if (!email && !phone) continue;
        const raw = (row.rawData && typeof row.rawData === 'object') ? (row.rawData as Record<string, unknown>) : {};
        const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
        const incoming: Record<string, string | number | null> = {
          firstName: str(row.firstName), lastName: str(row.lastName), email, phone,
          currentTitle: str(raw.currentTitle), currentCompany: str(raw.currentCompany),
          experienceYears: typeof raw.experienceYears === 'number' ? raw.experienceYears : null,
          location: str(raw.location), source: str(raw.source), availability: str(raw.availability),
          summary: str(raw.summary),
        };
        const skills = Array.isArray(raw.skills) ? (raw.skills as string[]).filter((x) => typeof x === 'string' && x.trim()) : [];
        const certifications = Array.isArray(raw.certifications) ? (raw.certifications as string[]) : [];
        const languages = Array.isArray(raw.languages) ? (raw.languages as string[]) : [];
        const importedStatus = typeof raw.status === 'string' && ['Active', 'Blacklisted', 'Archived'].includes(raw.status)
          ? raw.status
          : 'Active';

        // B6: a person already in the bank (same email OR phone) is linked, never duplicated.
        const match = await this.findExistingByContact(tx, organizationId, email, phone);
        let candidateId: string;
        if (match) {
          const existing = match.candidate as unknown as Record<string, unknown> & { id: string; skills: string[] };
          const fill: Record<string, unknown> = {};
          const filled: string[] = [];
          const conflicts: Array<{ field: string; existing: unknown; incoming: unknown }> = [];
          for (const [field, value] of Object.entries(incoming)) {
            if (value === null || value === undefined) continue;
            const current = existing[field];
            const empty = current === null || current === undefined || (typeof current === 'string' && !current.trim());
            if (empty) { fill[field] = value; filled.push(field); continue; }
            const same = field === 'email' ? normalizeEmailKey(String(current)) === value
              : field === 'phone' ? normalizePhoneKey(String(current)) === value
              : String(current).trim().toLowerCase() === String(value).trim().toLowerCase();
            if (!same) conflicts.push({ field, existing: current, incoming: value });
          }
          // E3: list fields from the parsed CV fill an EMPTY list only; a different non-empty list is a conflict.
          for (const [field, list] of [['certifications', certifications], ['languages', languages]] as const) {
            const clean = [...new Set(list.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))];
            if (!clean.length) continue;
            const current = Array.isArray(existing[field]) ? (existing[field] as string[]) : [];
            if (current.length === 0) { fill[field] = clean; filled.push(field); continue; }
            const same = current.length === clean.length && current.every((c) => clean.some((x) => catalogKey(x) === catalogKey(c)));
            if (!same) conflicts.push({ field, existing: current, incoming: clean });
          }
          const mergedSkills = [...existing.skills];
          for (const sk of skills) if (!mergedSkills.some((x) => catalogKey(x) === catalogKey(sk))) mergedSkills.push(sk.trim());
          if (mergedSkills.length !== existing.skills.length) { fill.skills = mergedSkills; filled.push('skills'); }
          if ('email' in fill || 'phone' in fill) {
            Object.assign(fill, contactKeys((fill.email ?? existing.email) as string | null, (fill.phone ?? existing.phone) as string | null));
          }
          if (Object.keys(fill).length > 0) await tx.candidate.update({ where: { id: existing.id }, data: fill });
          candidateId = existing.id;
          updateRowsCount++;
          report.push({ ...base, action: 'linked', candidateId, matchedBy: match.matchedBy, filled, conflicts });
          await tx.candidateImportRow.update({ where: { id: row.id }, data: { details: `Linked to existing candidate (${match.matchedBy.join(' + ')}).${filled.length ? ` Filled: ${filled.join(', ')}.` : ''}${conflicts.length ? ` Not overwritten: ${conflicts.map((c) => c.field).join(', ')}.` : ''}`.slice(0, 2000) } });
        } else {
          const created = await tx.candidate.create({
            data: {
              organizationId,
              createdById: createdById ?? null,
              candidateCode: await this.nextCandidateCode(tx),
              firstName: row.firstName!,
              lastName: row.lastName!,
              email,
              phone,
              ...contactKeys(email, phone),
              currentTitle: incoming.currentTitle as string | null,
              currentCompany: incoming.currentCompany as string | null,
              skills,
              experienceYears: incoming.experienceYears as number | null,
              location: incoming.location as string | null,
              certifications,
              languages,
              source: incoming.source as string | null,
              availability: incoming.availability as string | null,
              status: importedStatus,
            },
          });
          candidateId = created.id;
          newRowsCount++;
          report.push({ ...base, action: 'created', candidateId, matchedBy: [], filled: [], conflicts: [] });
        }

        // B6: skills listed on an import row are IMPORT evidence (library skills only).
        for (const sk of skills) {
          const skillId = skillByKey.get(catalogKey(sk));
          if (!skillId) continue;
          const link = await tx.candidateSkill.upsert({
            where: { candidateId_skillId: { candidateId, skillId } },
            create: { organizationId, candidateId, skillId },
            update: {},
          });
          const exists = await tx.candidateSkillEvidence.findFirst({ where: { candidateSkillId: link.id, sourceType: 'IMPORT', sourceRef: row.id } });
          if (!exists) {
            await tx.candidateSkillEvidence.create({ data: { candidateSkillId: link.id, sourceType: 'IMPORT', sourceRef: row.id, snippet: `Listed on import row ${row.rowNumber}: ${sk.trim()}`.slice(0, 200), addedById: createdById ?? null } });
          }
        }
      }

      return tx.candidateImportJob.update({
        where: { id: job.id },
        data: { status: 'Confirmed', newRows: newRowsCount, updateRows: updateRowsCount },
      });
    });

    return { success: true, status: result.status, newRows: result.newRows, updateRows: result.updateRows, duplicateReport: report };
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

  /** B6: match by normalized email OR phone (keys kept by the DB trigger). Email wins on ties. */
  private async findExistingByContact(
    tx: Prisma.TransactionClient,
    organizationId: string,
    email: string | null,
    phone: string | null,
  ): Promise<{ candidate: Prisma.CandidateGetPayload<{}>; matchedBy: Array<'email' | 'phone'> } | null> {
    if (!email && !phone) return null;
    const rows = await tx.candidate.findMany({
      where: { organizationId, OR: [...(email ? [{ emailNormalized: email }] : []), ...(phone ? [{ phoneNormalized: phone }] : [])] },
      orderBy: { createdAt: 'asc' },
    });
    const candidate = rows.find((c) => email && c.emailNormalized === email) ?? rows[0];
    if (!candidate) return null;
    const matchedBy: Array<'email' | 'phone'> = [];
    if (email && candidate.emailNormalized === email) matchedBy.push('email');
    if (phone && candidate.phoneNormalized === phone) matchedBy.push('phone');
    return { candidate, matchedBy };
  }
}
