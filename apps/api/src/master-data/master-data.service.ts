import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class MasterDataService {
  constructor(private prisma: PrismaService) {}

  async listOrganizations(organizationId: string): Promise<OrganizationDetail[]> {
    return this.prisma.organization.findMany({
      where: { id: organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async getOrganization(id: string): Promise<OrganizationDetail | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async listLegalEntities(organizationId: string): Promise<LegalEntityRecord[]> {
    const records = await this.prisma.legalEntity.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  }

  async listBranches(organizationId: string): Promise<BranchRecord[]> {
    const records = await this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  }

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

  async createOrganization(data: CreateOrganizationDto): Promise<OrganizationDetail> {
    return this.prisma.organization.create({
      data: {
        code: data.code,
        name: data.name,
        status: 'Active',
      },
    });
  }

  async createLegalEntity(organizationId: string, data: CreateLegalEntityDto): Promise<LegalEntityRecord> {
    const r = await this.prisma.legalEntity.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        status: 'Active',
      },
    });
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async createBranch(organizationId: string, data: CreateBranchDto): Promise<BranchRecord> {
    const legalEntity = await this.prisma.legalEntity.findFirst({
      where: { id: data.legalEntityId, organizationId },
    });
    if (!legalEntity) {
      throw new BadRequestException('Legal entity does not belong to this organization.');
    }

    const r = await this.prisma.branch.create({
      data: {
        organizationId,
        legalEntityId: data.legalEntityId,
        code: data.code,
        name: data.name,
        city: data.city ?? null,
        status: 'Active',
      },
    });
    return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async createPosition(organizationId: string, data: CreatePositionDto): Promise<PositionRecord> {
    const r = await this.prisma.position.create({
      data: {
        organizationId,
        code: data.code,
        title: data.title,
        description: data.description ?? null,
        status: 'Active',
      },
    });
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
}
