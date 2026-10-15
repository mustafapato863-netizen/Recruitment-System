import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import { ScreeningService } from '../screening.service';
import { CreateScreeningLogDto } from '../screening.dto';

const ORG = '10000000-0000-4000-8000-000000000001';
const APP = '20000000-0000-4000-8000-000000000001';
const SCREENED_AT = new Date('2026-10-15T09:00:00.000Z');
const SALARY_KEYS = ['currentSalary', 'expectedSalary', 'salaryCurrency'] as const;
const EVIDENCE_KEYS = ['method', 'evidenceSource', 'nextStep'] as const;

function savedLog(data: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    organizationId: ORG,
    applicationId: APP,
    screenerId: 'u1',
    screener: { displayName: 'Mariam' },
    outcome: 'Passed',
    notes: null,
    noticePeriodDays: null,
    expectedSalary: null,
    currentSalary: null,
    salaryCurrency: 'AED',
    method: null,
    evidenceSource: null,
    nextStep: null,
    screenedAt: SCREENED_AT,
    createdAt: SCREENED_AT,
    ...data,
  };
}

function makeService(listRecord = savedLog({
  method: 'Phone',
  evidenceSource: 'Screening call',
  nextStep: 'Move to interview',
  expectedSalary: 18000,
  currentSalary: 15000,
  salaryCurrency: 'AED',
})) {
  const prisma = {
    application: {
      findFirst: vi.fn().mockResolvedValue({ id: APP, organizationId: ORG }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    screeningLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => savedLog(args.data)),
      findMany: vi.fn().mockResolvedValue([listRecord]),
    },
  };
  const accessControl = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }) };
  const service = new ScreeningService(prisma as unknown as PrismaService, accessControl as unknown as AccessControlService);
  return { service, prisma };
}

describe('Screening evidence fields', () => {
  it('sends method, evidence source, and next step to screeningLog.create and returns them', async () => {
    const { service, prisma } = makeService();
    const created = await service.createScreeningLog(ORG, 'u1', {
      applicationId: APP,
      outcome: 'Passed',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Move to interview',
    }, { viewSalary: false });

    expect(prisma.screeningLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: 'Phone',
        evidenceSource: 'Screening call',
        nextStep: 'Move to interview',
      }),
      include: { screener: true },
    });
    expect(created).toMatchObject({
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Move to interview',
      screenedAt: SCREENED_AT.toISOString(),
    });
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });

  it('stores null and returns null when the evidence fields are omitted', async () => {
    const { service, prisma } = makeService();
    const created = await service.createScreeningLog(ORG, 'u1', {
      applicationId: APP,
      outcome: 'Passed',
    }, { viewSalary: false });

    expect(prisma.screeningLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: null,
        evidenceSource: null,
        nextStep: null,
      }),
      include: { screener: true },
    });
    expect(created.method).toBeNull();
    expect(created.evidenceSource).toBeNull();
    expect(created.nextStep).toBeNull();
    expect(created.screenedAt).toBe(SCREENED_AT.toISOString());
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it('stores null when evidence text is blank or whitespace', async () => {
    const { service, prisma } = makeService();
    const created = await service.createScreeningLog(ORG, 'u1', {
      applicationId: APP,
      outcome: 'On Hold',
      method: '   ',
      evidenceSource: '\n\t',
      nextStep: '  ',
    }, { viewSalary: false });

    expect(prisma.screeningLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ method: null, evidenceSource: null, nextStep: null }),
    }));
    expect(created).toMatchObject({ method: null, evidenceSource: null, nextStep: null });
  });

  it('keeps the evidence fields when salary visibility is off and does not update the application', async () => {
    const { service, prisma } = makeService();
    const [log] = await service.listScreeningLogs(ORG, APP, { viewSalary: false });
    const created = await service.createScreeningLog(ORG, 'u1', {
      applicationId: APP,
      outcome: 'Passed',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Move to interview',
      currentSalary: 15000,
      expectedSalary: 18000,
      salaryCurrency: 'AED',
    }, { viewSalary: false });

    for (const payload of [log, created]) {
      for (const key of SALARY_KEYS) expect(payload).not.toHaveProperty(key);
      for (const key of EVIDENCE_KEYS) expect(payload).toHaveProperty(key);
      expect(payload?.screenedAt).toBe(SCREENED_AT.toISOString());
    }
    expect(log).toMatchObject({
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Move to interview',
    });
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
});

describe('CreateScreeningLogDto evidence validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const body = { type: 'body' as const, metatype: CreateScreeningLogDto };

  it('turns blank evidence into null and trims the rest within the length limits', async () => {
    const dto = await pipe.transform({
      applicationId: APP,
      outcome: 'Passed',
      method: '  Phone  ',
      evidenceSource: '  Screening call  ',
      nextStep: '   ',
    }, body);
    expect(dto).toMatchObject({ method: 'Phone', evidenceSource: 'Screening call', nextStep: null });
  });

  it('rejects evidence longer than method 80, source 500, and next step 200', async () => {
    await expect(pipe.transform({ applicationId: APP, outcome: 'Passed', method: 'P'.repeat(81) }, body)).rejects.toThrow();
    await expect(pipe.transform({ applicationId: APP, outcome: 'Passed', evidenceSource: 'E'.repeat(501) }, body)).rejects.toThrow();
    await expect(pipe.transform({ applicationId: APP, outcome: 'Passed', nextStep: 'N'.repeat(201) }, body)).rejects.toThrow();
  });
});
