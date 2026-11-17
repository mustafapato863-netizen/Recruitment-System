import type { AuthUser } from '@recruitflow/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ResultsController } from '../results.controller';
import { ResultsService } from '../results.service';
import { cairoMidnight } from '../results.calc';

const manager: AuthUser = { userId: 'manager', organizationId: 'org', roleCodes: ['HIRING_MANAGER'], tokenVersion: 0 };
function setup() {
  const screenings = [
    { id: 'before', screenedAt: cairoMidnight(2026, 11, 2).getTime() - 1 },
    { id: 'inside', screenedAt: cairoMidnight(2026, 11, 2).getTime() },
    { id: 'after', screenedAt: cairoMidnight(2026, 11, 9).getTime() },
  ].map((item) => ({ ...item, screenedAt: new Date(item.screenedAt), applicationId: item.id, screenerId: 'employee', outcome: 'Passed', application: { id: item.id, vacancyId: 'job', vacancy: { id: 'job', branchId: 'branch' } } }));
  type Query = { where: Record<string, unknown>; select?: Record<string, unknown> };
  const empty = () => vi.fn(async (args: Query) => { void args; return []; });
  const prisma = {
    user: { findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.managerId && where.managerId !== 'manager' ? [] : [{ id: 'employee', displayName: 'Sample Employee', jobTitle: 'Recruiter' }])) },
    vacancy: { findMany: empty() },
    application: { findMany: empty() },
    screeningLog: { findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.notes ? [] : screenings)) },
    interview: { findMany: empty() }, interviewScorecard: { findMany: empty() },
    offerVersion: { findMany: empty() }, hiringCase: { findMany: empty() }, task: { findMany: empty() },
  };
  const visibility = { primaryRecruiterId: { in: ['employee'] } };
  const access = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue(visibility), getVacancyVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: 'org' }) };
  return { prisma, visibility, service: new ResultsService(prisma as never, access as never) };
}

describe('Manager period analytics', () => {
  it('counts actual work without any target rows and respects Cairo half-open week boundaries', async () => {
    const { service, prisma, visibility } = setup();
    const data = await service.results(manager, 'team', { periodType: 'weekly', periodKey: '2026-W45', vacancyId: 'job', branchId: 'branch' });
    expect(data).toMatchObject({ periodType: 'weekly', periodKey: '2026-W45', range: { from: cairoMidnight(2026, 11, 2).toISOString(), to: cairoMidnight(2026, 11, 9).toISOString() } });
    expect(data.targets).toBeUndefined();
    expect(data.rows?.[0]?.workCounts).toEqual({ screenings_completed: 1, interviews_conducted: 0, feedback_submitted: 0, seats_joined: 0 });
    const actualQuery = prisma.screeningLog.findMany.mock.calls.find(([args]) => args.where.outcome)?.[0].where;
    expect(actualQuery).toMatchObject({ organizationId: 'org', screenerId: 'employee', screenedAt: { gte: cairoMidnight(2026, 11, 2), lt: cairoMidnight(2026, 11, 9) }, application: { AND: [visibility], vacancyId: 'job', vacancy: { branchId: 'branch' } } });
    const funnelQuery = prisma.application.findMany.mock.calls.find(([args]) => args.select?.statusHistory)?.[0].where;
    expect(funnelQuery.AND).toContainEqual(visibility);
    expect(funnelQuery.AND).toContainEqual({ organizationId: 'org' });
    expect(funnelQuery.AND).toContainEqual({ primaryRecruiterId: { in: ['employee'] }, appliedAt: { gte: cairoMidnight(2026, 11, 2), lt: cairoMidnight(2026, 11, 9) } });
    expect(JSON.stringify(data)).not.toMatch(/salary|compensation|packageTotal/);
  });

  it('supports a week crossing the year and preserves the legacy monthly response', async () => {
    const { service, prisma } = setup();
    const weekly = await service.results(manager, 'team', { periodType: 'weekly', periodKey: '2026-W01' });
    expect(weekly.range).toEqual({ from: cairoMidnight(2025, 12, 29).toISOString(), to: cairoMidnight(2026, 1, 5).toISOString() });
    prisma.screeningLog.findMany.mockClear();
    const monthly = await service.results(manager, 'team', { month: '2026-10' });
    expect(monthly.month).toBe('2026-10');
    expect(monthly.range).toEqual({ from: cairoMidnight(2026, 10, 1).toISOString(), to: cairoMidnight(2026, 11, 1).toISOString() });
    expect(monthly.rows?.[0]?.workCounts).toBeUndefined();
    expect(prisma.screeningLog.findMany.mock.calls.every(([args]) => args.where.notes)).toBe(true);
  });

  it('rejects invalid periods, conflicting months, and out-of-scope callers', async () => {
    const { service } = setup();
    await expect(service.results(manager, 'team', { periodType: 'daily' })).rejects.toMatchObject({ status: 400 });
    await expect(service.results(manager, 'team', { periodType: 'weekly', periodKey: '2026-W54' })).rejects.toMatchObject({ status: 400 });
    await expect(service.results(manager, 'team', { month: '2026-10', periodType: 'monthly', periodKey: '2026-11' })).rejects.toMatchObject({ status: 400 });
    await expect(service.results({ ...manager, userId: 'outsider' }, 'team', { periodType: 'weekly', periodKey: '2026-W45' })).rejects.toMatchObject({ status: 403 });
  });

  it('forwards the period and site/job filters from the team endpoint', async () => {
    const { service } = setup();
    const spy = vi.spyOn(service, 'results').mockResolvedValue({} as never);
    await new ResultsController(service).team(manager, undefined, 'job', undefined, 'branch', 'weekly', '2026-W45');
    expect(spy).toHaveBeenCalledWith(manager, 'team', { vacancyId: 'job', branchId: 'branch', periodType: 'weekly', periodKey: '2026-W45' });
  });
});
