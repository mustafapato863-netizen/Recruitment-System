import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { UpdateIntegrationDto } from './integrations.dto';
import type { IntegrationItem } from '@recruitflow/contracts';

const DEFAULT_INTEGRATIONS = [
  { name: 'Microsoft 365', provider: 'microsoft', category: 'Authentication' },
  { name: 'Google Workspace', provider: 'google', category: 'Authentication' },
  { name: 'S3 Storage', provider: 'aws', category: 'Storage' },
  { name: 'HRIS Payroll', provider: 'hris', category: 'HRIS' },
  { name: 'LinkedIn Recruiter', provider: 'linkedin', category: 'Sourcing' },
  { name: 'Email Provider', provider: 'smtp', category: 'Communication' },
  { name: 'Job Boards', provider: 'job_boards', category: 'Sourcing' },
  { name: 'Webhooks', provider: 'webhooks', category: 'Developer' }
];

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listIntegrations(organizationId: string): Promise<IntegrationItem[]> {
    let integrations = await this.prisma.integration.findMany({
      where: { organizationId }
    });

    if (integrations.length === 0) {
      // Seed default set
      const dataToInsert = DEFAULT_INTEGRATIONS.map(i => ({
        organizationId,
        name: i.name,
        provider: i.provider,
        category: i.category,
        status: 'Available',
      }));

      await this.prisma.integration.createMany({
        data: dataToInsert
      });

      integrations = await this.prisma.integration.findMany({
        where: { organizationId }
      });
    }

    return integrations.map(i => ({
      id: i.id,
      name: i.name,
      provider: i.provider,
      category: i.category,
      status: i.status,
      lastSyncAt: i.lastSyncAt ? i.lastSyncAt.toISOString() : null
    }));
  }

  async getIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId }
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return {
      id: integration.id,
      name: integration.name,
      provider: integration.provider,
      category: integration.category,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
    } satisfies IntegrationItem;
  }

  async updateIntegration(organizationId: string, id: string, dto: UpdateIntegrationDto) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId }
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const data: Prisma.IntegrationUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.configJson !== undefined) {
      data.configJson = dto.configJson as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.integration.update({
      where: { id },
      data,
    });
    return {
      id: updated.id,
      name: updated.name,
      provider: updated.provider,
      category: updated.category,
      status: updated.status,
      lastSyncAt: updated.lastSyncAt ? updated.lastSyncAt.toISOString() : null,
    } satisfies IntegrationItem;
  }

  async testIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId }
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return {
      success: false,
      message: `Connection test is not configured for the ${integration.provider} provider`,
    };
  }
}
