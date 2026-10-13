import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import { levelAuditData, PositionLevelTargetsService, toLevelView } from '../position-level-targets.service';

const user = { userId: 'user-1', organizationId: 'org-1', roleCodes: ['ADMINISTRATOR'], email: 'a@recruitflow.local' } as AuthUser;

function harness() {
  const rows: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const prisma = {
    masterDataValue: {
      findMany: async ({ where }: { where: { organizationId: string; category: string; status?: string } }) =>
        rows.filter((row) => row.organizationId === where.organizationId && row.category === where.category && (!where.status || row.status === where.status)),
      findFirst: async ({ where }: { where: { organizationId: string; category: string; code: string } }) =>
        rows.find((row) => row.organizationId === where.organizationId && row.category === where.category && row.code === where.code) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `row-${data.code}`, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: { code: { notIn: string[] } }; data: { status: string } }) => {
        for (const row of rows) {
          if (!where.code.notIn.includes(String(row.code)) && row.status === 'Active') Object.assign(row, data);
        }
        return { count: 0 };
      },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return data; } },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { service: new PositionLevelTargetsService(prisma as unknown as PrismaService), rows, audits };
}

const level = (code: string, dailyCalls: number) => ({
  levelCode: code, levelName: `${code} name`, category: 'Digital & IT',
  dailyCalls, dailyScreenings: 1, monthlyInterviews: 1, monthlyOffers: 1, targetAcceptanceRate: 80, slaScorecardHours: 6,
});

describe('position level targets', () => {
  it('returns the activity defaults until a matrix is saved', async () => {
    const { service } = harness();
    const doc = await service.get('org-1');
    expect(doc.persisted).toBe(false);
    expect(doc.levels.map((item) => item.levelCode)).toEqual(['L1-CONSULTANT', 'L2-SPECIALIST', 'L3-NURSING', 'L4-TECH', 'L5-ADMIN']);
    expect(JSON.stringify(doc)).not.toMatch(/approvedHeadcount|joinedHeadcount|currentSalary|expectedSalary/);
  });

  it('saves activity quotas, audits them, and reads the same values back', async () => {
    const { service, audits } = harness();
    const saved = await service.save(user, { levels: [level('L4-TECH', 17), level('L5-ADMIN', 18)] });
    expect(saved.persisted).toBe(true);
    expect(saved.levels.find((item) => item.levelCode === 'L4-TECH')?.dailyCalls).toBe(17);
    const again = await service.get('org-1');
    expect(again.levels.find((item) => item.levelCode === 'L4-TECH')?.dailyCalls).toBe(17);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'POSITION_LEVEL_TARGETS_UPDATE', entityType: 'PositionLevelTarget', result: 'SUCCESS' });
    expect(JSON.stringify(audits[0]?.afterData)).not.toMatch(/approvedHeadcount|joinedHeadcount|currentSalary|expectedSalary|minMonthlyBase/);
    expect(levelAuditData(saved.levels)).not.toHaveProperty('approvedHeadcount');
  });

  it('rejects a repeated level code', async () => {
    const { service } = harness();
    await expect(service.save(user, { levels: [level('L4-TECH', 1), level('L4-TECH', 2)] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores inactive rows and does not treat them as seat targets', () => {
    expect(toLevelView({ id: '1', code: 'L4-TECH', name: 'Engineering', status: 'Inactive', metadata: { dailyCalls: 9, category: 'Digital & IT' } })).toBeNull();
  });
});
