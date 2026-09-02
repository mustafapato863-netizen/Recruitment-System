import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
import type { Prisma } from '@recruitflow/database';

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
    const updated = await this.prisma.branch.update({ where: { id }, data: { status: 'Archived' } });
    return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async restoreBranch(organizationId: string, id: string): Promise<BranchRecord> {
    const r = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Branch not found.');
    if (r.status === 'Active') throw new BadRequestException('Branch is already active.');
    const updated = await this.prisma.branch.update({ where: { id }, data: { status: 'Active' } });
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
      status: r.status,
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
      status: r.status,
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
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async archivePosition(organizationId: string, id: string): Promise<PositionRecord> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    if (r.status === 'Archived') throw new BadRequestException('Position is already archived.');
    const updated = await this.prisma.position.update({ where: { id }, data: { status: 'Archived' } });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      code: updated.code,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async restorePosition(organizationId: string, id: string): Promise<PositionRecord> {
    const r = await this.prisma.position.findFirst({ where: { id, organizationId } });
    if (!r) throw new NotFoundException('Position not found.');
    if (r.status === 'Active') throw new BadRequestException('Position is already active.');
    const updated = await this.prisma.position.update({ where: { id }, data: { status: 'Active' } });
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      code: updated.code,
      title: updated.title,
      description: updated.description,
      status: updated.status,
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
    const legalEntity = await tx.legalEntity.findFirst({ where: { id: data.legalEntityId, organizationId } });
    if (!legalEntity) throw new BadRequestException('Legal entity does not belong to this organization.');
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Branch name is required.');
    const code = await this.resolveCode(tx, organizationId, 'branch', 'BR', data.code);
    return tx.branch.create({
      data: {
        organizationId,
        legalEntityId: data.legalEntityId,
        code,
        name,
        city: data.city?.trim() || null,
        status: 'Active',
      },
    });
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
