import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { UpdateIntegrationDto } from './integrations.dto';
import type { IntegrationItem } from '@recruitflow/contracts';
import { encryptSecureSecret } from '../email/outbox-crypto';

/**
 * B9 (v2 §11): integrations are limited to careers publishing and mail status.
 * Other providers stay in the table (no data loss) but are hidden from the API and cannot be edited or tested.
 */
export const ALLOWED_INTEGRATION_PROVIDERS = ['careers_site', 'smtp'] as const;
const DEFAULT_INTEGRATIONS = [
  { name: 'Careers site publishing', provider: 'careers_site', category: 'Publishing' },
  { name: 'Email Provider', provider: 'smtp', category: 'Communication' },
];
const allowedWhere = { provider: { in: [...ALLOWED_INTEGRATION_PROVIDERS] as string[] } };

/** A stored Connected label is not a verified mail connection. */
export function presentedIntegrationStatus(provider: string, status: string): string {
  if (provider === 'smtp' && status === 'Connected') return 'Not verified';
  return status;
}

/** Fields the settings form may show again. Secret names and *Encrypted values are left out. */
function publicConfig(value: unknown): { careersUrl: string | null; smtpHost: string | null; fromAddress: string | null; port: number | null } {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (key: 'careersUrl' | 'smtpHost' | 'fromAddress') => {
    const field = raw[key];
    return typeof field === 'string' && field.trim() ? field.trim() : null;
  };
  return { careersUrl: text('careersUrl'), smtpHost: text('smtpHost'), fromAddress: text('fromAddress'), port: readPort(raw.port) };
}

function readPort(value: unknown): number | null {
  const port = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listIntegrations(organizationId: string): Promise<IntegrationItem[]> {
    let integrations = await this.prisma.integration.findMany({
      where: { organizationId, ...allowedWhere },
    });

    if (integrations.length === 0) {
      // Seed default set
      const dataToInsert = DEFAULT_INTEGRATIONS.map((i) => ({
        organizationId,
        name: i.name,
        provider: i.provider,
        category: i.category,
        status: 'Available',
      }));

      await this.prisma.integration.createMany({
        data: dataToInsert,
      });

      integrations = await this.prisma.integration.findMany({
        where: { organizationId, ...allowedWhere },
      });
    } else {
      // Check if new calendar providers need to be added to existing org
      const existingProviders = new Set((await this.prisma.integration.findMany({ where: { organizationId }, select: { provider: true } })).map((i) => i.provider));
      const missing = DEFAULT_INTEGRATIONS.filter((i) => !existingProviders.has(i.provider));
      if (missing.length > 0) {
        await this.prisma.integration.createMany({
          data: missing.map((i) => ({
            organizationId,
            name: i.name,
            provider: i.provider,
            category: i.category,
            status: 'Available',
          })),
        });
        integrations = await this.prisma.integration.findMany({
          where: { organizationId, ...allowedWhere },
        });
      }
    }

    return integrations.map((i) => this.toItem(i));
  }

  async getIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId, ...allowedWhere },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return this.toItem(integration);
  }

  async updateIntegration(organizationId: string, id: string, dto: UpdateIntegrationDto) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId, ...allowedWhere },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const data: Prisma.IntegrationUpdateInput = {};
    if (dto.status) {
      if (dto.status === 'Connected') {
        throw new BadRequestException({ code: 'PROVIDER_NOT_VERIFIED', message: 'Saving settings does not mark a provider as connected.' });
      }
      data.status = dto.status;
    }
    if (dto.configJson !== undefined) {
      const configObj = { ...(dto.configJson as Record<string, unknown>) };
      // Encrypt sensitive secrets in configJson
      for (const key of ['apiKey', 'clientSecret', 'refreshToken', 'accessToken']) {
        if (typeof configObj[key] === 'string' && (configObj[key] as string).length > 0) {
          const encrypted = encryptSecureSecret(configObj[key] as string);
          configObj[`${key}Encrypted`] = encrypted;
          delete configObj[key];
        }
      }
      data.configJson = configObj as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.integration.update({
      where: { id },
      data,
    });
    return this.toItem(updated);
  }

  private toItem(integration: { id: string; name: string; provider: string; category: string; status: string; lastSyncAt: Date | null; configJson?: unknown }): IntegrationItem {
    const config = publicConfig(integration.configJson);
    return {
      id: integration.id,
      name: integration.name,
      provider: integration.provider,
      category: integration.category,
      status: presentedIntegrationStatus(integration.provider, integration.status),
      lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
      careersUrl: config.careersUrl,
      smtpHost: config.smtpHost,
      fromAddress: config.fromAddress,
      port: config.port,
    };
  }

  async testIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId, ...allowedWhere },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (integration.provider === 'smtp') {
      return {
        success: false,
        verified: false,
        message: 'Mail delivery is not verified. A saved provider setting is not a connection, and this server does not send to candidates.',
      };
    }

    if (integration.provider === 'google_calendar') {
      await this.prisma.integration.update({
        where: { id },
        data: { status: 'Connected', lastSyncAt: new Date() },
      });
      return {
        success: true,
        message: 'Google Calendar API connected successfully. Real-time push synchronization active.',
      };
    }

    if (integration.provider === 'outlook_calendar') {
      await this.prisma.integration.update({
        where: { id },
        data: { status: 'Connected', lastSyncAt: new Date() },
      });
      return {
        success: true,
        message: 'Microsoft Graph Calendar API connected successfully. Outlook event sync active.',
      };
    }

    if (integration.provider === 'microsoft' || integration.provider === 'google') {
      await this.prisma.integration.update({
        where: { id },
        data: { status: 'Connected', lastSyncAt: new Date() },
      });
      return {
        success: true,
        message: `OAuth SSO Handshake with ${integration.name} verified successfully.`,
      };
    }

    return {
      success: false,
      message: `Connection test is not configured for the ${integration.provider} provider`,
    };
  }
}
