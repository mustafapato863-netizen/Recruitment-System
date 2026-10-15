import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { ScreeningDraft, ScreeningLog, ScreeningOutcome } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateScreeningLogDto, UpsertScreeningDraftDto } from './screening.dto';
import type { AuthUser } from '@recruitflow/contracts';

function blankToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const UNSTORABLE_DRAFT_KEY = /salary|document|token|secret/i;

function rejectUnstorableDraftKeys(body: object): void {
  const forbidden = Object.keys(body).filter((key) => UNSTORABLE_DRAFT_KEY.test(key));
  if (forbidden.length === 0) return;
  const fields = Object.fromEntries(forbidden.map((key) => [key, [`${key} cannot be stored on a screening draft.`]]));
  throw new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Please correct the highlighted fields.',
    fields,
    field: forbidden[0],
  });
}

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
    const app = await this.prisma.application.findFirst({ where: { AND: [visibility, { id: applicationId }] } });

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
    if (user) await this.accessControl.assertApplicationAccess(user, dto.applicationId);
    const visibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const app = await this.prisma.application.findFirst({ where: { AND: [visibility, { id: dto.applicationId }] } });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${dto.applicationId} was not found.`);
    }

    const rawCurrency = dto.salaryCurrency?.trim().toUpperCase();
    const normalizedCurrency = rawCurrency === 'EGP' || rawCurrency === 'EGY' ? 'EGP' : 'AED';

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
        salaryCurrency: options.viewSalary ? normalizedCurrency : 'AED',
        method: blankToNull(dto.method),
        evidenceSource: blankToNull(dto.evidenceSource),
        nextStep: blankToNull(dto.nextStep),
      },
      include: { screener: true },
    });

    // A saved screen replaces only this user's draft. The stage stays where it is.
    if (this.prisma.screeningDraft) {
      await this.prisma.screeningDraft.deleteMany({
        where: { organizationId, userId: screenerId, applicationId: dto.applicationId },
      });
    }

    return this.toScreeningLog(created, options);
  }

  async getScreeningDraft(
    organizationId: string,
    userId: string,
    applicationId: string,
    user?: AuthUser,
  ): Promise<ScreeningDraft | null> {
    await this.requireApplication(organizationId, applicationId, user);
    const row = await this.prisma.screeningDraft.findUnique({
      where: { organizationId_userId_applicationId: { organizationId, userId, applicationId } },
    });
    return row ? this.toScreeningDraft(row) : null;
  }

  async upsertScreeningDraft(
    organizationId: string,
    userId: string,
    applicationId: string,
    dto: UpsertScreeningDraftDto,
    user?: AuthUser,
  ): Promise<ScreeningDraft> {
    rejectUnstorableDraftKeys(dto);
    await this.requireApplication(organizationId, applicationId, user);
    const data = {
      outcome: dto.outcome,
      notes: blankToNull(dto.notes),
      noticePeriodDays: dto.noticePeriodDays ?? null,
      method: blankToNull(dto.method),
      evidenceSource: blankToNull(dto.evidenceSource),
      nextStep: blankToNull(dto.nextStep),
      moveToInterview: dto.moveToInterview ?? true,
    };
    const saved = await this.prisma.screeningDraft.upsert({
      where: { organizationId_userId_applicationId: { organizationId, userId, applicationId } },
      create: { organizationId, userId, applicationId, ...data },
      update: data,
    });
    return this.toScreeningDraft(saved);
  }

  async deleteScreeningDraft(
    organizationId: string,
    userId: string,
    applicationId: string,
    user?: AuthUser,
  ): Promise<{ deleted: boolean }> {
    await this.requireApplication(organizationId, applicationId, user);
    const result = await this.prisma.screeningDraft.deleteMany({
      where: { organizationId, userId, applicationId },
    });
    return { deleted: result.count > 0 };
  }

  private async requireApplication(organizationId: string, applicationId: string, user?: AuthUser): Promise<void> {
    if (user) await this.accessControl.assertApplicationAccess(user, applicationId);
    const visibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const app = await this.prisma.application.findFirst({ where: { AND: [visibility, { id: applicationId }] } });
    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${applicationId} was not found.`);
    }
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
      // Compensation keys are omitted entirely (not null) for callers without
      // VIEW_CURRENT_SALARY (canSeeCurrentSalary, common/access/pay-visibility) so Employee payloads never carry the fields.
      ...(options.viewSalary
        ? {
            expectedSalary: record.expectedSalary !== null ? Number(record.expectedSalary) : null,
            currentSalary: record.currentSalary !== null ? Number(record.currentSalary) : null,
            salaryCurrency: record.salaryCurrency,
          }
        : {}),
      // How the person was screened, where the evidence came from, and the intended
      // next step are stored text. They are not pay and stay on the payload when salary is hidden.
      method: record.method ?? null,
      evidenceSource: record.evidenceSource ?? null,
      nextStep: record.nextStep ?? null,
      screenedAt: record.screenedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private toScreeningDraft(record: {
    id: string;
    organizationId: string;
    userId: string;
    applicationId: string;
    outcome: string;
    notes: string | null;
    noticePeriodDays: number | null;
    method: string | null;
    evidenceSource: string | null;
    nextStep: string | null;
    moveToInterview: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ScreeningDraft {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      applicationId: record.applicationId,
      outcome: record.outcome as ScreeningOutcome,
      notes: record.notes,
      noticePeriodDays: record.noticePeriodDays,
      method: record.method,
      evidenceSource: record.evidenceSource,
      nextStep: record.nextStep,
      moveToInterview: record.moveToInterview,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
