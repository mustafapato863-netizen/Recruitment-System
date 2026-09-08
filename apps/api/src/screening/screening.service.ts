import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { ScreeningLog, ScreeningOutcome } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateScreeningLogDto } from './screening.dto';
import type { AuthUser } from '@recruitflow/contracts';

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async listScreeningLogs(
    organizationId: string,
    applicationId: string,
    options: { viewSalary: boolean } = { viewSalary: false },
    user?: AuthUser,
  ): Promise<ScreeningLog[]> {
    const visibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const app = await this.prisma.application.findFirst({ where: { id: applicationId, ...visibility } });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${applicationId} was not found.`);
    }

    const logs = await this.prisma.screeningLog.findMany({
      where: { organizationId, applicationId },
      include: { screener: true },
      orderBy: { screenedAt: 'desc' },
    });

    return logs.map((log) => this.toScreeningLog(log, options));
  }

  async createScreeningLog(
    organizationId: string,
    screenerId: string,
    dto: CreateScreeningLogDto,
    options: { viewSalary: boolean } = { viewSalary: false },
    user?: AuthUser,
  ): Promise<ScreeningLog> {
    const visibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const app = await this.prisma.application.findFirst({ where: { id: dto.applicationId, ...visibility } });

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
        noticePeriodDays: dto.noticePeriodDays ?? null,
        expectedSalary: options.viewSalary ? (dto.expectedSalary ?? null) : null,
        currentSalary: options.viewSalary ? (dto.currentSalary ?? null) : null,
        salaryCurrency: options.viewSalary ? (dto.salaryCurrency?.trim().toUpperCase() || 'SAR') : 'SAR',
      },
      include: { screener: true },
    });

    return this.toScreeningLog(created, options);
  }

  private toScreeningLog(
    record: Prisma.ScreeningLogGetPayload<{ include: { screener: true } }>,
    options: { viewSalary: boolean },
  ): ScreeningLog {
    return {
      id: record.id,
      organizationId: record.organizationId,
      applicationId: record.applicationId,
      screenerId: record.screenerId,
      screenerName: record.screener?.displayName,
      outcome: record.outcome as ScreeningOutcome,
      notes: record.notes,
      noticePeriodDays: record.noticePeriodDays,
      expectedSalary: options.viewSalary && record.expectedSalary !== null ? Number(record.expectedSalary) : null,
      currentSalary: options.viewSalary && record.currentSalary !== null ? Number(record.currentSalary) : null,
      salaryCurrency: record.salaryCurrency,
      screenedAt: record.screenedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
