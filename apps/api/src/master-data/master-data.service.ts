import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreateOrganizationDto,
  CreateLegalEntityDto,
  CreateBranchDto,
  CreatePositionDto
} from './master-data.dto';
import type {
  OrganizationDetail,
  LegalEntityRecord,
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
  legalEntityId?: string | null;
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

  // ─── Legal Entity ──────────────────────────────────────────────

  async listLegalEntities(organizationId: string): Promise<LegalEntityRecord[]> {
    const records = await this.prisma.legalEntity.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  }

  async getLegalEntity(organizationId: string, id: string): Promise<LegalEntityRecord> {
    const r = await this.prisma.legalEntity.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Legal entity not found.');
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async createLegalEntity(organizationId: string, data: CreateLegalEntityDto): Promise<LegalEntityRecord> {
    const r = await this.prisma.$transaction((tx) => this.createLegalEntityInTransaction(tx, organizationId, data));
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async archiveLegalEntity(organizationId: string, id: string): Promise<LegalEntityRecord> {
    const r = await this.prisma.legalEntity.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Legal entity not found.');
    if (r.status === 'Archived') throw new BadRequestException('Legal entity is already archived.');
    const updated = await this.prisma.legalEntity.update({ where: { id }, data: { status: 'Archived' } });
    return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async restoreLegalEntity(organizationId: string, id: string): Promise<LegalEntityRecord> {
    const r = await this.prisma.legalEntity.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Legal entity not found.');
    if (r.status === 'Active') throw new BadRequestException('Legal entity is already active.');
    const updated = await this.prisma.legalEntity.update({ where: { id }, data: { status: 'Active' } });
    return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async deleteLegalEntity(organizationId: string, id: string): Promise<void> {
    const r = await this.prisma.legalEntity.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Legal entity not found.');
    const refs = await this.countLegalEntityReferences(id);
    if (refs.total > 0) {
      const details = Object.entries(refs.breakdown)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      throw new ConflictException(`Cannot delete legal entity: referenced by ${details}. Archive it instead.`);
    }
    await this.prisma.legalEntity.delete({ where: { id } });
  }

  private async countLegalEntityReferences(id: string) {
    const [branches, positions, vacancyRequests, vacancies] = await Promise.all([
      this.prisma.branch.count({ where: { legalEntityId: id } }),
      this.prisma.position.count({ where: { legalEntityId: id } }),
      this.prisma.vacancyRequest.count({ where: { legalEntityId: id } }),
      this.prisma.vacancy.count({ where: { legalEntityId: id } }),
    ]);
    return {
      total: branches + positions + vacancyRequests + vacancies,
      breakdown: { branches, positions, vacancyRequests, vacancies },
    };
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
        legalEntityId: branch.legalEntityId,
        metadata: { country: branch.country, legalEntityId: branch.legalEntityId },
        status: branch.status,
        version: branch.version,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      }));
    }
    if (category === 'job-titles') {
      const positions = await this.prisma.position.findMany({ where: { organizationId }, orderBy: { code: 'asc' } });
      return positions.map((position) => ({
        id: position.id,
        organizationId,
        category,
        code: position.code,
        name: position.title,
        metadata: {
          ...((position.metadata as Record<string, unknown> | null) ?? {}),
          legalEntityId: position.legalEntityId,
          description: position.description,
        },
        legalEntityId: position.legalEntityId,
        status: position.status,
        version: position.version,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
      }));
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
          if (row.legalEntityId) {
            const entity = await tx.legalEntity.findFirst({ where: { id: row.legalEntityId, organizationId } });
            if (!entity) throw new BadRequestException(`Legal entity for branch ${name} is not in this organization.`);
          }
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
              legalEntityId: row.legalEntityId || null,
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
              ...(row.legalEntityId ? { legalEntityId: row.legalEntityId } : {}),
            }));
          }
        } else if (category === 'job-titles') {
          const legalEntityId = row.legalEntityId || (row.metadata?.legalEntityId as string | undefined);
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
              ...(row.metadata ? { metadata: row.metadata as Prisma.InputJsonValue } : {}),
              legalEntityId: legalEntityId || null,
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
              ...(row.metadata ? { metadata: row.metadata } : {}),
              ...(legalEntityId ? { legalEntityId } : {}),
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

  async createLegalEntityInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: CreateLegalEntityDto,
  ) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Legal entity name is required.');
    const code = await this.resolveCode(tx, organizationId, 'legal-entity', 'LE', data.code);
    return tx.legalEntity.create({ data: { organizationId, code, name, status: 'Active' } });
  }

  async createBranchInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: CreateBranchDto,
  ) {
    if (data.legalEntityId) {
      const legalEntity = await tx.legalEntity.findFirst({ where: { id: data.legalEntityId, organizationId } });
      if (!legalEntity) throw new BadRequestException('Legal entity does not belong to this organization.');
    }
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Branch name is required.');
    const country = this.normalizeBranchCountry(data.country);
    const code = await this.resolveCode(tx, organizationId, 'branch', 'BR', data.code);
    return tx.branch.create({
      data: {
        organizationId,
        legalEntityId: data.legalEntityId || null,
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
    if (data.legalEntityId) {
      const legalEntity = await tx.legalEntity.findFirst({ where: { id: data.legalEntityId, organizationId } });
      if (!legalEntity) throw new BadRequestException('Legal entity does not belong to this organization.');
    }
    const code = await this.resolveCode(tx, organizationId, 'position', 'POS', data.code);
    return tx.position.create({
      data: {
        organizationId,
        legalEntityId: data.legalEntityId || null,
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
    entityType: 'legal-entity' | 'branch' | 'position',
    prefix: string,
    requestedCode?: string,
  ): Promise<string> {
    const explicitCode = requestedCode?.trim();
    const lockKey = `master-data:${organizationId}:${entityType}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    if (explicitCode) {
      const duplicate = entityType === 'legal-entity'
        ? await tx.legalEntity.findFirst({ where: { organizationId, code: explicitCode }, select: { id: true } })
        : entityType === 'branch'
          ? await tx.branch.findFirst({ where: { organizationId, code: explicitCode }, select: { id: true } })
          : await tx.position.findFirst({ where: { organizationId, code: explicitCode }, select: { id: true } });
      if (duplicate) throw new ConflictException(`The code ${explicitCode} already exists in this organization.`);
      return explicitCode;
    }

    const records = entityType === 'legal-entity'
      ? await tx.legalEntity.findMany({ where: { organizationId }, select: { code: true } })
      : entityType === 'branch'
        ? await tx.branch.findMany({ where: { organizationId }, select: { code: true } })
        : await tx.position.findMany({ where: { organizationId }, select: { code: true } });
    const highest = records.reduce((max, record) => {
      const match = record.code.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
  }
}
