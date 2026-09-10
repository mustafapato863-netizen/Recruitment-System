import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreateOrganizationDto,
  CreateBranchDto,
  CreatePositionDto
} from './master-data.dto';
import type {
  OrganizationDetail,
  BranchRecord,
  PositionRecord
} from '@recruitflow/contracts';
import { Prisma } from '@recruitflow/database';
import type { MasterDataCategory, MasterDataValueRecord } from '@recruitflow/contracts';
import { catalogKey, normalizeCatalogText, uniqueCatalogNames } from './catalog-normalization';

const CATALOG_CATEGORIES = new Set<MasterDataCategory>(['departments', 'skills', 'candidate-sources', 'interview-types']);
const SUPPORTED_CATALOGS = new Set(['branches', 'job-titles', ...CATALOG_CATEGORIES]);

type MasterDataBatchRow = {
  id?: string;
  code?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: string;
  expectedVersion?: number;
};

@Injectable()
export class MasterDataService {
  constructor(private prisma: PrismaService) {}

  // ─── Organization ──────────────────────────────────────────────

  async listOrganizations(organizationId: string): Promise<OrganizationDetail[]> {
    return this.prisma.organization.findMany({
      where: { id: organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async getOrganization(id: string): Promise<OrganizationDetail | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async createOrganization(data: CreateOrganizationDto): Promise<OrganizationDetail> {
    return this.prisma.organization.create({
      data: {
        code: data.code,
        name: data.name,
        status: 'Active',
      },
    });
  }

  // ─── Branch ────────────────────────────────────────────────────

  async listBranches(organizationId: string): Promise<BranchRecord[]> {
    const records = await this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  }

  async listCatalog(organizationId: string, category: string) {
    this.assertCatalog(category);
    if (category === 'branches') {
      const branches = await this.prisma.branch.findMany({ where: { organizationId }, orderBy: { code: 'asc' } });
      return branches.map((branch) => ({
        id: branch.id,
        organizationId: branch.organizationId,
        category,
        code: branch.code,
        name: branch.name,
        country: branch.country,
        city: branch.city,
        metadata: { country: branch.country },
        status: branch.status,
        version: branch.version,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      }));
    }
    if (category === 'job-titles') {
      const positions = await this.prisma.position.findMany({ where: { organizationId }, orderBy: { code: 'asc' } });
      return positions.map((position) => {
        const metadata = ((position.metadata as Record<string, unknown> | null) ?? {});
        return {
        id: position.id,
        organizationId,
        category,
        code: position.code,
        name: position.title,
        metadata: {
          ...metadata,
          description: position.description,
        },
        status: position.status,
        version: position.version,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
        };
      });
    }
    const records = await this.prisma.masterDataValue.findMany({ where: { organizationId, category }, orderBy: [{ status: 'asc' }, { name: 'asc' }] });
    return records.map((record): MasterDataValueRecord => ({
      id: record.id,
      organizationId: record.organizationId,
      category: record.category as MasterDataCategory,
      code: record.code,
      name: record.name,
      metadata: record.metadata as Record<string, unknown> | null,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async saveCatalogBatch(organizationId: string, category: string, rows: MasterDataBatchRow[]) {
    this.assertCatalog(category);
    if (rows.length > 250) throw new BadRequestException('Master Data saves are limited to 250 rows per batch.');
    const saved = await this.prisma.$transaction(async (tx) => {
      // Serialize catalog writes so two administrators cannot create values
      // that differ only by case or invisible whitespace at the same time.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`master-data:${organizationId}:${category}`}))`;
      const results: unknown[] = [];
      for (const row of rows) {
        const name = normalizeCatalogText(row.name);
        if (!name) throw new BadRequestException('Every Master Data row needs a name.');
        const status = row.status?.trim() || 'Active';
        if (!['Active', 'Inactive', 'Archived'].includes(status)) throw new BadRequestException(`Invalid status for ${name}.`);
        if (category === 'branches') {
          const country = this.normalizeBranchCountry(row.country);
          const branchValues = await tx.branch.findMany({ where: { organizationId }, select: { id: true, code: true, name: true } });
          const duplicate = branchValues.find((value) =>
            value.id !== row.id &&
            ((Boolean(row.code?.trim()) && value.code === row.code?.trim()) || catalogKey(value.name) === catalogKey(name)),
          );
          if (duplicate) throw new ConflictException(`Branch code or name already exists in this organization.`);
          if (row.id) {
            const result = await tx.branch.updateMany({ where: { id: row.id, organizationId, ...(row.expectedVersion === undefined ? {} : { version: row.expectedVersion }) }, data: {
              ...(row.code?.trim() ? { code: row.code.trim() } : {}),
              name,
              country,
              city: row.city?.trim() || null,
              status,
              version: { increment: 1 },
            } });
            if (result.count !== 1) throw new ConflictException(`Branch ${name} changed since it was loaded. Reload before saving.`);
            results.push(await tx.branch.findUniqueOrThrow({ where: { id: row.id } }));
          } else {
            results.push(await this.createBranchInTransaction(tx, organizationId, {
              ...(row.code?.trim() ? { code: row.code.trim() } : {}),
              name,
              country,
              ...(row.city?.trim() ? { city: row.city.trim() } : {}),
            }));
          }
        } else if (category === 'job-titles') {
          const positionMetadata = row.metadata ?? {};
          const positionValues = await tx.position.findMany({ where: { organizationId }, select: { id: true, code: true, title: true } });
          const duplicate = positionValues.find((value) =>
            value.id !== row.id &&
            ((Boolean(row.code?.trim()) && value.code === row.code?.trim()) || catalogKey(value.title) === catalogKey(name)),
          );
          if (duplicate) throw new ConflictException(`Job title code or name already exists in this organization.`);
          if (row.id) {
            const result = await tx.position.updateMany({ where: { id: row.id, organizationId, ...(row.expectedVersion === undefined ? {} : { version: row.expectedVersion }) }, data: {
              ...(row.code?.trim() ? { code: row.code.trim() } : {}),
              title: name,
              ...(typeof row.metadata?.description === 'string' ? { description: row.metadata.description.trim() || null } : {}),
              ...(row.metadata ? { metadata: positionMetadata as Prisma.InputJsonValue } : {}),
              status,
              version: { increment: 1 },
            } });
            if (result.count !== 1) throw new ConflictException(`Job title ${name} changed since it was loaded. Reload before saving.`);
            results.push(await tx.position.findUniqueOrThrow({ where: { id: row.id } }));
          } else {
            results.push(await this.createPositionInTransaction(tx, organizationId, {
              ...(row.code?.trim() ? { code: row.code.trim() } : {}),
              title: name,
              ...(typeof row.metadata?.description === 'string' ? { description: row.metadata.description } : {}),
              ...(row.metadata ? { metadata: positionMetadata } : {}),
            }));
          }
        } else {
          const existing = row.id ? await tx.masterDataValue.findFirst({ where: { id: row.id, organizationId, category } }) : null;
          const existingValues = await tx.masterDataValue.findMany({ where: { organizationId, category }, select: { id: true, code: true, name: true } });
          const duplicate = existingValues.find((value) =>
            value.id !== row.id &&
            ((Boolean(row.code?.trim()) && value.code === row.code?.trim()) || catalogKey(value.name) === catalogKey(name)),
          );
          if (duplicate) throw new ConflictException(`${category} code or name already exists in this organization.`);
          if (row.id) {
            if (!existing || (row.expectedVersion !== undefined && existing.version !== row.expectedVersion)) throw new ConflictException(`${name} changed since it was loaded. Reload before saving.`);
            results.push(await tx.masterDataValue.update({ where: { id: row.id }, data: {
              code: row.code?.trim() || null,
              name,
              metadata: row.metadata == null ? Prisma.JsonNull : row.metadata as Prisma.InputJsonValue,
              status,
              version: { increment: 1 },
            } }));
          } else {
            results.push(await tx.masterDataValue.create({ data: {
              organizationId,
              category,
              code: row.code?.trim() || null,
              name,
              metadata: row.metadata == null ? Prisma.JsonNull : row.metadata as Prisma.InputJsonValue,
              status,
            } }));
          }
        }
      }
      return results;
    }).catch((error: unknown) => {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw new ConflictException('Master Data could not be saved because one or more rows conflict with existing values.');
    });
    return { saved: saved.length, data: await this.listCatalog(organizationId, category) };
  }

  /**
   * Ensure vacancy skills are represented by the tenant Skills catalog.
   * The caller must invoke this inside its business transaction so the
   * vacancy and catalog stay consistent if either write fails.
   */
  async syncSkillsInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    values: readonly (string | null | undefined)[],
  ): Promise<string[]> {
    const names = uniqueCatalogNames(values);
    if (names.length === 0) return [];

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`master-data:${organizationId}:skills`}))`;
    const existing = await tx.masterDataValue.findMany({
      where: { organizationId, category: 'skills' },
      orderBy: { name: 'asc' },
    });
    const byKey = new Map(existing.map((record) => [catalogKey(record.name), record]));
    const canonical: string[] = [];

    for (const name of names) {
      const key = catalogKey(name);
      const current = byKey.get(key);
      if (current) {
        canonical.push(current.name);
        if (current.status !== 'Active') {
          await tx.masterDataValue.update({
            where: { id: current.id },
            data: { status: 'Active', version: { increment: 1 } },
          });
        }
        continue;
      }

      const created = await tx.masterDataValue.create({
        data: {
          id: randomUUID(),
          organizationId,
          category: 'skills',
          name,
          status: 'Active',
        },
      });
      byKey.set(key, created);
      canonical.push(created.name);
    }

    return canonical;
  }

  private assertCatalog(category: string): asserts category is 'branches' | 'job-titles' | MasterDataCategory {
    if (!SUPPORTED_CATALOGS.has(category)) throw new BadRequestException(`Unsupported Master Data category: ${category}.`);
  }

  async getBranch(organizationId: string, id: string): Promise<BranchRecord> {
    const r = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Branch not found.');
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async createBranch(organizationId: string, data: CreateBranchDto): Promise<BranchRecord> {
    const r = await this.prisma.$transaction((tx) => this.createBranchInTransaction(tx, organizationId, data));
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async archiveBranch(organizationId: string, id: string): Promise<BranchRecord> {
    const r = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Branch not found.');
    if (r.status === 'Archived') throw new BadRequestException('Branch is already archived.');
    const updated = await this.prisma.branch.update({ where: { id }, data: { status: 'Archived', version: { increment: 1 } } });
    return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async restoreBranch(organizationId: string, id: string): Promise<BranchRecord> {
    const r = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Branch not found.');
    if (r.status === 'Active') throw new BadRequestException('Branch is already active.');
    const updated = await this.prisma.branch.update({ where: { id }, data: { status: 'Active', version: { increment: 1 } } });
    return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async deleteBranch(organizationId: string, id: string): Promise<void> {
    const r = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Branch not found.');
    const refs = await this.countBranchReferences(id);
    if (refs.total > 0) {
      const details = Object.entries(refs.breakdown)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      throw new ConflictException(`Cannot delete branch: referenced by ${details}. Archive it instead.`);
    }
    await this.prisma.branch.delete({ where: { id } });
  }

  private async countBranchReferences(id: string) {
    const [vacancyRequests, vacancies] = await Promise.all([
      this.prisma.vacancyRequest.count({ where: { branchId: id } }),
      this.prisma.vacancy.count({ where: { branchId: id } }),
    ]);
    return {
      total: vacancyRequests + vacancies,
      breakdown: { vacancyRequests, vacancies },
    };
  }

  // ─── Position ──────────────────────────────────────────────────

  async listPositions(organizationId: string): Promise<PositionRecord[]> {
    const records = await this.prisma.position.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(r => ({
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      title: r.title,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      status: r.status,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getPosition(organizationId: string, id: string): Promise<PositionRecord> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    return {
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      title: r.title,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      status: r.status,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async createPosition(organizationId: string, data: CreatePositionDto): Promise<PositionRecord> {
    const r = await this.prisma.$transaction((tx) => this.createPositionInTransaction(tx, organizationId, data));
    return {
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      title: r.title,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      status: r.status,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async archivePosition(organizationId: string, id: string): Promise<PositionRecord> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    if (r.status === 'Archived') throw new BadRequestException('Position is already archived.');
    const updated = await this.prisma.position.update({ where: { id }, data: { status: 'Archived', version: { increment: 1 } } });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      code: updated.code,
      title: updated.title,
      description: updated.description,
      metadata: (updated.metadata as Record<string, unknown> | null) ?? null,
      status: updated.status,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async restorePosition(organizationId: string, id: string): Promise<PositionRecord> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    if (r.status === 'Active') throw new BadRequestException('Position is already active.');
    const updated = await this.prisma.position.update({ where: { id }, data: { status: 'Active', version: { increment: 1 } } });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      code: updated.code,
      title: updated.title,
      description: updated.description,
      metadata: (updated.metadata as Record<string, unknown> | null) ?? null,
      status: updated.status,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deletePosition(organizationId: string, id: string): Promise<void> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    const refs = await this.countPositionReferences(id);
    if (refs.total > 0) {
      const details = Object.entries(refs.breakdown)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      throw new ConflictException(`Cannot delete position: referenced by ${details}. Archive it instead.`);
    }
    await this.prisma.position.delete({ where: { id } });
  }

  private async countPositionReferences(id: string) {
    const [vacancyRequests, vacancies] = await Promise.all([
      this.prisma.vacancyRequest.count({ where: { positionId: id } }),
      this.prisma.vacancy.count({ where: { positionId: id } }),
    ]);
    return {
      total: vacancyRequests + vacancies,
      breakdown: { vacancyRequests, vacancies },
    };
  }

  // ─── Transactional Create Helpers (used by BulkImportService) ──

  async createBranchInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: CreateBranchDto,
  ) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Branch name is required.');
    const country = this.normalizeBranchCountry(data.country);
    const code = await this.resolveCode(tx, organizationId, 'branch', 'BR', data.code);
    return tx.branch.create({
      data: {
        organizationId,
        code,
        name,
        country,
        city: data.city?.trim() || null,
        status: 'Active',
      },
    });
  }

  private normalizeBranchCountry(country?: string | null): 'EGY' | 'UAE' {
    const normalized = country?.trim().toUpperCase() || 'EGY';
    if (normalized !== 'EGY' && normalized !== 'UAE') {
      throw new BadRequestException('Branch country must be EGY or UAE.');
    }
    return normalized;
  }

  async createPositionInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: CreatePositionDto,
  ) {
    const title = data.title.trim();
    if (!title) throw new BadRequestException('Position title is required.');
    const code = await this.resolveCode(tx, organizationId, 'position', 'POS', data.code);
    return tx.position.create({
      data: {
        organizationId,
        code,
        title,
        description: data.description?.trim() || null,
        ...(data.metadata ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
        status: 'Active',
      },
    });
  }

  // ─── Code Generation ───────────────────────────────────────────

  private async resolveCode(
    tx: Prisma.TransactionClient,
    organizationId: string,
    entityType: 'branch' | 'position',
    prefix: string,
    requestedCode?: string,
  ): Promise<string> {
    const explicitCode = requestedCode?.trim();
    const lockKey = `master-data:${organizationId}:${entityType}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    if (explicitCode) {
      const duplicate = entityType === 'branch'
          ? await tx.branch.findFirst({ where: { organizationId, code: explicitCode }, select: { id: true } })
          : await tx.position.findFirst({ where: { organizationId, code: explicitCode }, select: { id: true } });
      if (duplicate) throw new ConflictException(`The code ${explicitCode} already exists in this organization.`);
      return explicitCode;
    }

    const records = entityType === 'branch'
        ? await tx.branch.findMany({ where: { organizationId }, select: { code: true } })
        : await tx.position.findMany({ where: { organizationId }, select: { code: true } });
    const highest = records.reduce((max, record) => {
      const match = record.code.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
  }
}
