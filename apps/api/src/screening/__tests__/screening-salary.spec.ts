import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import { ScreeningService } from '../screening.service';

const ORG = '10000000-0000-4000-8000-000000000001';
const APP = '20000000-0000-4000-8000-000000000001';
const SALARY_KEYS = ['currentSalary', 'expectedSalary', 'salaryCurrency'];

function makeService() {
  const record = {
    id: 'log-1', organizationId: ORG, applicationId: APP, screenerId: 'u1', screener: { displayName: 'Mariam' },
    outcome: 'Passed', notes: 'Good fit', noticePeriodDays: 30,
    expectedSalary: 18000, currentSalary: 15000, salaryCurrency: 'AED',
    screenedAt: new Date('2026-10-01T10:00:00Z'), createdAt: new Date('2026-10-01T10:00:00Z'),
  };
  const prisma = {
    application: { findFirst: vi.fn().mockResolvedValue({ id: APP, organizationId: ORG }) },
    screeningLog: { findMany: vi.fn().mockResolvedValue([record]), create: vi.fn().mockResolvedValue(record) },
  };
  const accessControl = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }) };
  return new ScreeningService(prisma as unknown as PrismaService, accessControl as unknown as AccessControlService);
}

describe('Screening salary disclosure', () => {
  it('omits salary keys entirely (not null) for users without VIEW_CURRENT_SALARY', async () => {
    const service = makeService();
    const [log] = await service.listScreeningLogs(ORG, APP, { viewSalary: false });
    const created = await service.createScreeningLog(ORG, 'u1', { applicationId: APP, outcome: 'Passed' } as never, { viewSalary: false });
    for (const payload of [log, created]) {
      for (const key of SALARY_KEYS) expect(payload).not.toHaveProperty(key);
      expect(JSON.stringify(payload)).not.toMatch(/salary/i);
      expect(payload).toMatchObject({ outcome: 'Passed', notes: 'Good fit', noticePeriodDays: 30 });
    }
  });

  it('keeps salary for users with VIEW_CURRENT_SALARY', async () => {
    const service = makeService();
    const [log] = await service.listScreeningLogs(ORG, APP, { viewSalary: true });
    expect(log).toMatchObject({ currentSalary: 15000, expectedSalary: 18000, salaryCurrency: 'AED' });
  });
});
