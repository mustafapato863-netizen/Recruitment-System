import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import { ScreeningService } from '../screening.service';
import { UpsertScreeningDraftDto } from '../screening.dto';

const ORG = '10000000-0000-4000-8000-000000000001';
const APP = '20000000-0000-4000-8000-000000000001';
const USER_A = '30000000-0000-4000-8000-00000000000a';
const USER_B = '30000000-0000-4000-8000-00000000000b';
const SCREENED_AT = new Date('2026-10-15T09:00:00.000Z');

interface DraftRow {
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
}

interface DraftKey {
  organizationId: string;
  userId: string;
  applicationId: string;
}

function savedLog(data: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    organizationId: ORG,
    applicationId: APP,
    screenerId: USER_A,
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

function makeService() {
  const drafts: DraftRow[] = [];
  const now = new Date('2026-10-15T12:00:00.000Z');
  const materialize = (data: Record<string, unknown>, existing?: DraftRow): DraftRow => ({
    id: existing?.id ?? `draft-${drafts.length + 1}`,
    organizationId: String(data.organizationId ?? existing?.organizationId),
    userId: String(data.userId ?? existing?.userId),
    applicationId: String(data.applicationId ?? existing?.applicationId),
    outcome: String(data.outcome ?? existing?.outcome),
    notes: data.notes == null ? null : String(data.notes),
    noticePeriodDays: data.noticePeriodDays == null ? null : Number(data.noticePeriodDays),
    method: data.method == null ? null : String(data.method),
    evidenceSource: data.evidenceSource == null ? null : String(data.evidenceSource),
    nextStep: data.nextStep == null ? null : String(data.nextStep),
    moveToInterview: data.moveToInterview === undefined ? (existing?.moveToInterview ?? true) : data.moveToInterview !== false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  const matches = (row: DraftRow, key: DraftKey) => row.organizationId === key.organizationId && row.userId === key.userId && row.applicationId === key.applicationId;
  const prisma = {
    application: {
      findFirst: vi.fn().mockResolvedValue({ id: APP, organizationId: ORG }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    screeningLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => savedLog(args.data)),
    },
    screeningDraft: {
      findUnique: vi.fn(async ({ where }: { where: { organizationId_userId_applicationId: DraftKey } }) => {
        const key = where.organizationId_userId_applicationId;
        return drafts.find((row) => matches(row, key)) ?? null;
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { organizationId_userId_applicationId: DraftKey }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const key = where.organizationId_userId_applicationId;
        const index = drafts.findIndex((row) => matches(row, key));
        if (index === -1) {
          const row = materialize(create);
          drafts.push(row);
          return row;
        }
        const row = materialize({ ...drafts[index], ...update }, drafts[index]);
        drafts[index] = row;
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: DraftKey }) => {
        const before = drafts.length;
        for (let i = drafts.length - 1; i >= 0; i -= 1) {
          if (matches(drafts[i], where)) drafts.splice(i, 1);
        }
        return { count: before - drafts.length };
      }),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const accessControl = {
    getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
    assertApplicationAccess: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ScreeningService(prisma as unknown as PrismaService, accessControl as unknown as AccessControlService);
  return { service, prisma, drafts };
}

const privateScreen = {
  outcome: 'Passed' as const,
  notes: 'Reached them on the first call.',
  method: 'Phone',
  evidenceSource: 'Screening call',
  nextStep: 'Keep in screening',
  moveToInterview: true,
};

describe('Screening drafts', () => {
  it('saves method, evidence source, next step, and a note for user A, who reads them back', async () => {
    const { service } = makeService();
    const saved = await service.upsertScreeningDraft(ORG, USER_A, APP, privateScreen);
    const again = await service.getScreeningDraft(ORG, USER_A, APP);
    expect(saved).toMatchObject(privateScreen);
    expect(again).toMatchObject(privateScreen);
    expect(again?.id).toBe(saved.id);
  });

  it('returns null for another user in the same organization and does not let them delete or replace the draft', async () => {
    const { service } = makeService();
    await service.upsertScreeningDraft(ORG, USER_A, APP, privateScreen);
    expect(await service.getScreeningDraft(ORG, USER_B, APP)).toBeNull();
    await expect(service.deleteScreeningDraft(ORG, USER_B, APP)).resolves.toEqual({ deleted: false });
    await service.upsertScreeningDraft(ORG, USER_B, APP, {
      outcome: 'Failed',
      notes: 'A different person',
      method: 'Video',
      evidenceSource: 'Other notes',
      nextStep: 'Do not proceed',
      moveToInterview: false,
    });
    expect(await service.getScreeningDraft(ORG, USER_A, APP)).toMatchObject(privateScreen);
    expect(await service.getScreeningDraft(ORG, USER_B, APP)).toMatchObject({ notes: 'A different person' });
  });

  it('rejects a body that includes currentSalary and writes nothing', async () => {
    const { service, prisma, drafts } = makeService();
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const body = { outcome: 'Passed', notes: 'Pay mentioned', method: 'Phone', currentSalary: 15000 };
    await expect(pipe.transform(body, { type: 'body', metatype: UpsertScreeningDraftDto })).rejects.toThrow();
    await expect(service.upsertScreeningDraft(ORG, USER_A, APP, body as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.screeningDraft.upsert).not.toHaveBeenCalled();
    expect(prisma.screeningDraft.create).not.toHaveBeenCalled();
    expect(prisma.screeningDraft.update).not.toHaveBeenCalled();
    expect(prisma.screeningLog.create).not.toHaveBeenCalled();
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
    expect(drafts).toHaveLength(0);
  });

  it('rejects document, token, and secret keys and writes nothing', async () => {
    for (const key of ['documentId', 'accessToken', 'clientSecret']) {
      const { service, prisma, drafts } = makeService();
      await expect(service.upsertScreeningDraft(ORG, USER_A, APP, { outcome: 'Passed', [key]: 'nope' } as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.screeningDraft.upsert).not.toHaveBeenCalled();
      expect(drafts).toHaveLength(0);
    }
  });

  it('accepts the drawer body, including a null notice period, and turns blank text into null', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metatype = { type: 'body' as const, metatype: UpsertScreeningDraftDto };
    const dto = await pipe.transform({
      outcome: 'Passed',
      notes: '  Keep this call private.  ',
      noticePeriodDays: null,
      method: '  Phone  ',
      evidenceSource: '   ',
      nextStep: 'Keep in screening',
      moveToInterview: true,
    }, metatype);
    expect(dto).toMatchObject({
      outcome: 'Passed',
      notes: 'Keep this call private.',
      noticePeriodDays: null,
      method: 'Phone',
      evidenceSource: null,
      nextStep: 'Keep in screening',
      moveToInterview: true,
    });
    await expect(pipe.transform({
      outcome: 'Passed',
      notes: 'nope',
      expectedSalary: 1,
      salaryCurrency: 'AED',
      documentId: 'doc',
      accessToken: 't',
      clientSecret: 's',
    }, metatype)).rejects.toThrow();
  });

  it('stores blank text as null', async () => {
    const { service } = makeService();
    const saved = await service.upsertScreeningDraft(ORG, USER_A, APP, {
      outcome: 'On Hold',
      notes: '   ',
      method: '  ',
      evidenceSource: '\n\t',
      nextStep: ' ',
      moveToInterview: false,
    });
    expect(saved).toMatchObject({
      outcome: 'On Hold',
      notes: null,
      method: null,
      evidenceSource: null,
      nextStep: null,
      moveToInterview: false,
    });
  });

  it('createScreeningLog deletes that user draft and does not update the application', async () => {
    const { service, prisma } = makeService();
    await service.upsertScreeningDraft(ORG, USER_A, APP, privateScreen);
    await service.upsertScreeningDraft(ORG, USER_B, APP, {
      outcome: 'On Hold',
      notes: 'Leave mine',
      method: 'Video',
      evidenceSource: 'Panel',
      nextStep: 'Do not proceed',
    });
    await service.createScreeningLog(ORG, USER_A, {
      applicationId: APP,
      outcome: 'Passed',
      method: 'Phone',
      evidenceSource: 'Screening call',
      nextStep: 'Keep in screening',
    }, { viewSalary: false });
    expect(prisma.screeningDraft.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, userId: USER_A, applicationId: APP },
    });
    expect(await service.getScreeningDraft(ORG, USER_A, APP)).toBeNull();
    expect(await service.getScreeningDraft(ORG, USER_B, APP)).toMatchObject({ notes: 'Leave mine' });
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });
});
