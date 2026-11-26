import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../reports.service';
import type { PrismaService } from '../../database/prisma.service';

// Meeting notes 2026-11-25 (item 5): per-entity (per-branch) report — ENTITY = BRANCH.
// One row per branch: applications, hires in range, funnel, time-to-fill, open
// vacancies, approved/joined headcount; a branchId filter narrows to one branch.
const ORG = 'org-1';

const BRANCHES = [
  { id: 'branch-1', name: 'Cairo Branch', code: 'CAI' },
  { id: 'branch-2', name: 'Giza Branch', code: 'GIZ' },
];
const APPLICATIONS = [
  { stage: 'Applied', vacancy: { branchId: 'branch-1' } },
  { stage: 'Applied', vacancy: { branchId: 'branch-1' } },
  { stage: 'Screening', vacancy: { branchId: 'branch-1' } },
  { stage: 'Interview', vacancy: { branchId: 'branch-2' } },
];
const JOINED = [
  {
    actualJoiningDate: new Date('2026-10-21T00:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    application: { vacancy: { branchId: 'branch-1' } },
  },
  {
    actualJoiningDate: new Date('2026-10-15T00:00:00.000Z'),
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
    application: { vacancy: { branchId: 'branch-1' } },
  },
  {
    actualJoiningDate: new Date('2026-10-10T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    application: { vacancy: { branchId: 'branch-2' } },
  },
];
const VACANCIES = [
  { branchId: 'branch-1', status: 'Open', approvedHeadcount: 2, joinedHeadcount: 1 },
  { branchId: 'branch-1', status: 'Filled', approvedHeadcount: 1, joinedHeadcount: 1 },
  { branchId: 'branch-2', status: 'Partially Filled', approvedHeadcount: 3, joinedHeadcount: 1 },
];

function serviceFor() {
  const prisma = {
    branch: {
      findMany: vi.fn().mockImplementation(async (args: { where: { id?: string } }) =>
        args.where.id ? BRANCHES.filter((b) => b.id === args.where.id) : BRANCHES),
    },
    application: { findMany: vi.fn().mockResolvedValue(APPLICATIONS) },
    hiringCase: { findMany: vi.fn().mockResolvedValue(JOINED) },
    vacancy: {
      findMany: vi.fn().mockImplementation(async (args: { where: { branchId?: string } }) =>
        args.where.branchId ? VACANCIES.filter((v) => v.branchId === args.where.branchId) : VACANCIES),
    },
  };
  const service = new ReportsService(prisma as unknown as PrismaService, undefined);
  return { service, prisma };
}

const RANGE = { from: '2026-10-01', to: '2026-11-30' };

describe('meeting notes item 5 — per-entity (per-branch) report', () => {
  it('returns one row per branch with hires, funnel, time-to-fill and headcount', async () => {
    const { service } = serviceFor();
    const rows = await service.getByEntity(ORG, RANGE);
    expect(rows).toHaveLength(2);
    const cairo = rows.find((r) => r.entityId === 'branch-1')!;
    expect(cairo).toMatchObject({
      entityName: 'Cairo Branch', entityCode: 'CAI', applications: 3, hires: 2,
      timeToFillDays: 15, openVacancies: 1, approvedHeadcount: 3, joinedHeadcount: 2,
    });
    const funnel = Object.fromEntries(cairo.funnel.map((s) => [s.name, s]));
    expect(funnel.Applied).toMatchObject({ count: 2, percent: 100 });
    expect(funnel.Screening).toMatchObject({ count: 1, percent: 50 });
    const giza = rows.find((r) => r.entityId === 'branch-2')!;
    expect(giza).toMatchObject({
      applications: 1, hires: 1, timeToFillDays: 39, openVacancies: 1,
      approvedHeadcount: 3, joinedHeadcount: 1,
    });
  });

  it('narrows to a single branch when branchId is given', async () => {
    const { service, prisma } = serviceFor();
    const rows = await service.getByEntity(ORG, { ...RANGE, branchId: 'branch-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityId).toBe('branch-1');
    expect(prisma.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'branch-1' }),
    }));
    expect(prisma.vacancy.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: 'branch-1' }),
    }));
  });

  it('reports no time-to-fill when a branch has no hires in range', async () => {
    const { service } = serviceFor();
    const rows = await service.getByEntity(ORG, { from: '2026-11-01', to: '2026-11-30' });
    expect(rows.find((r) => r.entityId === 'branch-1')).toMatchObject({ hires: 0, timeToFillDays: null });
  });
});
