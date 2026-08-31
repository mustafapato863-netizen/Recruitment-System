import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { ScreeningLog, ScreeningOutcome } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import type { CreateScreeningLogDto } from './screening.dto';

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listScreeningLogs(
    organizationId: string,
    applicationId: string,
  ): Promise<ScreeningLog[]> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${applicationId} was not found.`);
    }

    const logs = await this.prisma.screeningLog.findMany({
      where: { organizationId, applicationId },
      include: { screener: true },
      orderBy: { screenedAt: 'desc' },
    });

    return logs.map((log) => this.toScreeningLog(log));
  }

  async createScreeningLog(
    organizationId: string,
    screenerId: string,
    dto: CreateScreeningLogDto,
  ): Promise<ScreeningLog> {
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${dto.applicationId} was not found.`);
    }

    const created = await this.prisma.screeningLog.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        screenerId,
        outcome: dto.outcome,
        notes: dto.notes?.trim() ?? null,
      },
      include: { screener: true },
    });

    return this.toScreeningLog(created);
  }

  private toScreeningLog(
    record: Prisma.ScreeningLogGetPayload<{ include: { screener: true } }>,
  ): ScreeningLog {
    return {
      id: record.id,
      organizationId: record.organizationId,
      applicationId: record.applicationId,
      screenerId: record.screenerId,
      screenerName: record.screener?.displayName,
      outcome: record.outcome as ScreeningOutcome,
      notes: record.notes,
      screenedAt: record.screenedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
