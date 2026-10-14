import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { buildErrorEnvelope, normalizeError } from '../../common/errors/error-normalizer';
import { validationExceptionFactory } from '../../common/errors/validation-exception';
import type { PrismaService } from '../../database/prisma.service';
import { buildWorkflowImpact } from '../workflow-rule-impact';
import { WorkflowRulesController } from '../workflow-rules.controller';
import { ApplyWorkflowRuleDto, WorkflowRuleDto, WORKFLOW_RULE_REASON_MAX } from '../workflow-rules.dto';
import { WorkflowRulesService } from '../workflow-rules.service';

describe('workflow rule impact', () => {
  it('keeps a preview when the position holds a protected job and leaves snapshots in place', () => {
    const impact = buildWorkflowImpact({
      positionId: 'p1',
      positionTitle: 'Registered Nurse',
      currentProfile: 'clinical',
      proposedProfile: 'technical',
      vacancies: [
        { id: 'v1', code: 'VAC-2026-011', status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1 },
        { id: 'v2', code: 'VAC-2026-099', status: 'Open', approvedHeadcount: 1, joinedHeadcount: 0 },
      ],
      applications: [
        { id: 'a1', code: 'APP-1', stage: 'Joined', vacancyCode: 'VAC-2026-011', hasSnapshot: true },
        { id: 'a2', code: 'APP-2', stage: 'Applied', vacancyCode: 'VAC-2026-011', hasSnapshot: false },
      ],
    });
    expect(impact.applyAllowed).toBe(false);
    expect(impact.protectedVacancyCodes).toEqual(['VAC-2026-011']);
    expect(impact.preservedSnapshots).toBe(1);
    expect(impact.openCasesAdoptingProfile.map((row) => row.code)).toEqual(['APP-2']);
    expect(impact.vacancies.find((row) => row.code === 'VAC-2026-011')).toMatchObject({ status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1 });
    expect(impact.message).toMatch(/preview/);
  });

  it('allows a profile only when none of the protected jobs are on the position', () => {
    const impact = buildWorkflowImpact({
      positionId: 'p2',
      positionTitle: 'Reception',
      currentProfile: null,
      proposedProfile: 'technical',
      vacancies: [{ id: 'v3', code: 'VAC-2026-100', status: 'Open', approvedHeadcount: 1, joinedHeadcount: 0 }],
      applications: [],
    });
    expect(impact.applyAllowed).toBe(true);
    expect(impact.protectedVacancyCodes).toEqual([]);
  });

  it('does not write a profile when the preview is blocked', async () => {
    const updates: string[] = [];
    const prisma = {
      position: {
        findFirst: async () => ({ id: 'p1', title: 'Registered Nurse', metadata: { requirementProfile: 'clinical' } }),
        update: async () => { updates.push('position'); },
      },
      vacancy: {
        findMany: async () => [{
          id: 'v1', vacancyCode: 'VAC-2026-011', status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1,
          applications: [{ id: 'a1', applicationCode: 'APP-2026-021', stage: 'Applied', hiringCase: null }],
        }],
      },
      auditLog: { create: async () => { updates.push('audit'); } },
      $transaction: async () => { updates.push('tx'); },
    };
    const service = new WorkflowRulesService(prisma as unknown as PrismaService);
    const user = { userId: 'admin', organizationId: 'org', roleCodes: ['ADMINISTRATOR'], email: 'a@recruitflow.local' } as AuthUser;
    await expect(service.apply(user, 'p1', 'technical', 'Change the checklist')).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toEqual([]);
  });
});

const actor = { userId: 'admin', organizationId: 'org', roleCodes: ['ADMINISTRATOR'], email: 'a@recruitflow.local' } as AuthUser;
const POSITION_ID = '6b1c1c3a-1a2b-4c3d-8e9f-112233445566';

function allowedService(tx: {
  findFirst?: () => Promise<{ id: string; metadata: Record<string, unknown> } | null>;
  update?: (args: unknown) => Promise<void>;
  audit?: (args: unknown) => Promise<void>;
} = {}) {
  const writes: string[] = [];
  const captured: { position?: unknown; audit?: unknown } = {};
  const prisma = {
    position: {
      findFirst: async () => ({ id: 'p2', title: 'Reception', metadata: { requirementProfile: 'technical', site: 'Cairo' } }),
      update: async () => { writes.push('root-position'); },
    },
    vacancy: { findMany: async () => [] },
    auditLog: { create: async () => { writes.push('root-audit'); } },
    $transaction: async (fn: (client: unknown) => Promise<void>) => {
      writes.push('tx');
      const client = {
        position: {
          findFirst: tx.findFirst ?? (async () => ({ id: 'p2', metadata: { requirementProfile: 'technical', site: 'Cairo' } })),
          update: tx.update ?? (async (args: unknown) => { writes.push('tx-position'); captured.position = args; }),
        },
        auditLog: {
          create: tx.audit ?? (async (args: unknown) => { writes.push('tx-audit'); captured.audit = args; }),
        },
      };
      await fn(client);
    },
  };
  return { service: new WorkflowRulesService(prisma as unknown as PrismaService), writes, captured };
}

describe('workflow rule apply', () => {
  it('refuses a blank reason before any write when the position could change', async () => {
    const { service, writes } = allowedService();
    await expect(service.apply(actor, 'p2', 'clinical', '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(writes).toEqual([]);
  });

  it('stores the trimmed reason with the profile in one transaction and leaves other metadata', async () => {
    const { service, writes, captured } = allowedService();
    const impact = await service.apply(actor, 'p2', 'clinical', '  Confirm licence-required profile.  ');
    expect(impact.applyAllowed).toBe(true);
    expect(writes).toEqual(['tx', 'tx-position', 'tx-audit']);
    expect(captured.position).toMatchObject({ data: { metadata: { requirementProfile: 'clinical', site: 'Cairo' } } });
    expect(captured.audit).toMatchObject({
      data: {
        action: 'WORKFLOW_RULE_APPLY',
        reason: 'Confirm licence-required profile.',
        beforeData: { requirementProfile: 'technical' },
        afterData: { requirementProfile: 'clinical', applyAllowed: true },
      },
    });
  });

  it('does not write when the reason is longer than the audit bound', async () => {
    const { service, writes } = allowedService();
    await expect(service.apply(actor, 'p2', 'clinical', 'x'.repeat(WORKFLOW_RULE_REASON_MAX + 1))).rejects.toBeInstanceOf(BadRequestException);
    expect(writes).toEqual([]);
  });

  it('does not audit when the profile update fails inside the transaction', async () => {
    const { service, writes } = allowedService({
      update: async () => { writes.push('tx-position'); throw new Error('update failed'); },
    });
    await expect(service.apply(actor, 'p2', 'clinical', 'A real reason')).rejects.toThrow('update failed');
    expect(writes).toEqual(['tx', 'tx-position']);
  });

  it('does not write when the position disappears before the transaction commits', async () => {
    const { service, writes } = allowedService({ findFirst: async () => null });
    await expect(service.apply(actor, 'p2', 'clinical', 'A real reason')).rejects.toBeInstanceOf(NotFoundException);
    expect(writes).toEqual(['tx']);
  });

  it('preview stays on view and apply stays on master-data manage', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WorkflowRulesController.prototype.preview)).toEqual(['MASTER_DATA_VIEW']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WorkflowRulesController.prototype.apply)).toEqual(['MASTER_DATA_MANAGE']);
  });
});

describe('workflow rule bodies', () => {
  const run = (metatype: new () => object, body: unknown) => new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: validationExceptionFactory,
  }).transform(body, { type: 'body', metatype });

  async function envelope(metatype: new () => object, body: unknown) {
    try {
      await run(metatype, body);
    } catch (error) {
      return buildErrorEnvelope(normalizeError(error), 'req-1');
    }
    throw new Error('expected validation to fail');
  }

  it('preview accepts a profile without a reason and rejects a reason field', async () => {
    await expect(run(WorkflowRuleDto, { positionId: POSITION_ID, profile: 'technical' })).resolves.toMatchObject({ positionId: POSITION_ID, profile: 'technical' });
    const extra = await envelope(WorkflowRuleDto, { positionId: POSITION_ID, profile: 'technical', reason: 'not on preview' });
    expect(extra).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('apply trims a bounded reason and rejects an empty one', async () => {
    await expect(run(ApplyWorkflowRuleDto, { positionId: POSITION_ID, profile: 'clinical', reason: '  Keep the licence check.  ' })).resolves.toMatchObject({ reason: 'Keep the licence check.' });
    await expect(run(ApplyWorkflowRuleDto, { positionId: POSITION_ID, profile: 'clinical', reason: 'a'.repeat(WORKFLOW_RULE_REASON_MAX) })).resolves.toMatchObject({ reason: 'a'.repeat(WORKFLOW_RULE_REASON_MAX) });
    expect(await envelope(ApplyWorkflowRuleDto, { positionId: POSITION_ID, profile: 'clinical' })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'reason' });
    expect(await envelope(ApplyWorkflowRuleDto, { positionId: POSITION_ID, profile: 'clinical', reason: '   ' })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'reason' });
    expect(await envelope(ApplyWorkflowRuleDto, { positionId: POSITION_ID, profile: 'clinical', reason: 'b'.repeat(WORKFLOW_RULE_REASON_MAX + 1) })).toMatchObject({ code: 'VALIDATION_ERROR', field: 'reason' });
  });
});
