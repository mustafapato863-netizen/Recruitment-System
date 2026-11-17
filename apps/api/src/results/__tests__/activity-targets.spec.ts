import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResultsService } from '../results.service';
import { cairoCurrentWeek, cairoMidnight, cairoWeekRange, resolveTargetPeriod } from '../results.calc';

const ORG = '10000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-11-02T12:00:00.000Z');
const FORBIDDEN = /change|previous|activity|salary|compensation|packageTotal|monthlyPackage/i;

describe('Cairo target periods', () => {
  it('resolves ISO weeks, Monday-normalized dates, and months in Africa/Cairo', () => {
    expect(cairoCurrentWeek(NOW)).toBe('2026-W45');
    const current = cairoWeekRange(undefined, NOW)!;
    expect(current.periodKey).toBe('2026-W45');
    expect(current.firstDay).toBe('2026-11-02');
    expect(current.nextWeekFirstDay).toBe('2026-11-09');
    expect(current.from.toISOString()).toBe(cairoMidnight(2026, 11, 2).toISOString());
    expect(current.to.toISOString()).toBe(cairoMidnight(2026, 11, 9).toISOString());

    const first = cairoWeekRange('2026-W01')!;
    expect([first.firstDay, first.nextWeekFirstDay]).toEqual(['2025-12-29', '2026-01-05']);
    expect(first.from.toISOString()).toBe(cairoMidnight(2025, 12, 29).toISOString());

    const anchored = cairoWeekRange('2026-10-07')!;
    expect(anchored.periodKey).toBe('2026-10-05');
    expect(anchored.firstDay).toBe('2026-10-05');
    expect(anchored.to.toISOString()).toBe(cairoMidnight(2026, 10, 12).toISOString());

    expect(cairoWeekRange('2026-W54')).toBeNull();
    expect(cairoWeekRange('2026-W00')).toBeNull();
    expect(cairoWeekRange('2026-02-31')).toBeNull();
    expect(resolveTargetPeriod('monthly', '2026-11', NOW)?.periodKey).toBe('2026-11');
    expect(resolveTargetPeriod('monthly', '2026-13', NOW)).toBeNull();
    expect(resolveTargetPeriod('weekly', '2026-W45', NOW)?.from.toISOString()).toBe(current.from.toISOString());
  });
});

describe('employee activity targets', () => {
  const ids = {
    manager: randomUUID(),
    employee: randomUUID(),
    outsider: randomUUID(),
    admin: randomUUID(),
    other: randomUUID(),
  };
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  const manager = auth(ids.manager, ['HIRING_MANAGER']);
  const employee = auth(ids.employee, ['RECRUITER']);
  const outsider = auth(ids.outsider, ['HIRING_MANAGER']);
  const admin = auth(ids.admin, ['ADMINISTRATOR']);

  const users = [
    { id: ids.manager, organizationId: ORG, displayName: 'Dr. Hassan Ali', jobTitle: 'Hiring Manager', status: 'Active', managerId: null, userRoles: [{ role: { code: 'HIRING_MANAGER' } }] },
    { id: ids.employee, organizationId: ORG, displayName: 'Sarah Ahmed', jobTitle: 'Recruiter', status: 'Active', managerId: ids.manager, userRoles: [{ role: { code: 'RECRUITER' } }] },
    { id: ids.outsider, organizationId: ORG, displayName: 'Omar Hassan', jobTitle: 'Hiring Manager', status: 'Active', managerId: ids.other, userRoles: [{ role: { code: 'HIRING_MANAGER' } }] },
    { id: ids.admin, organizationId: ORG, displayName: 'System Administrator', jobTitle: 'Administrator', status: 'Active', managerId: null, userRoles: [{ role: { code: 'ADMINISTRATOR' } }] },
    { id: ids.other, organizationId: ORG, displayName: 'Mona El-Sayed', jobTitle: 'Talent Manager', status: 'Active', managerId: null, userRoles: [{ role: { code: 'TALENT_MANAGER' } }] },
  ];
  const mem: {
    targets: Array<Record<string, any>>;
    revisions: Array<Record<string, any>>;
    audits: Array<Record<string, any>>;
    screenings: Array<Record<string, any>>;
    interviews: Array<Record<string, any>>;
    scorecards: Array<Record<string, any>>;
    hiringCases: Array<Record<string, any>>;
    vacancies: Array<Record<string, any>>;
    calls: string[];
    screeningWhere: unknown;
  } = { targets: [], revisions: [], audits: [], screenings: [], interviews: [], scorecards: [], hiringCases: [], vacancies: [], calls: [], screeningWhere: null };

  function reset() {
    mem.targets = [];
    mem.revisions = [];
    mem.audits = [];
    mem.screenings = [];
    mem.interviews = [];
    mem.scorecards = [];
    mem.hiringCases = [];
    mem.vacancies = [];
    mem.calls = [];
    mem.screeningWhere = null;
  }

  function userMatches(row: (typeof users)[number], where: Record<string, any> | undefined): boolean {
    if (!where) return true;
    if (where.organizationId && row.organizationId !== where.organizationId) return false;
    if (where.status && row.status !== where.status) return false;
    if (where.managerId && row.managerId !== where.managerId) return false;
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    if (typeof where.id === 'string' && row.id !== where.id) return false;
    return true;
  }

  const prisma = {
    user: {
      findMany: async ({ where }: { where?: Record<string, any> } = {}) => users.filter((row) => userMatches(row, where)),
      findFirst: async ({ where }: { where: Record<string, any> }) => users.find((row) => row.id === where.id && (!where.organizationId || row.organizationId === where.organizationId)) ?? null,
    },
    vacancy: {
      findMany: async () => [],
      findFirst: async ({ where }: { where: Record<string, any> }) => mem.vacancies.find((row) => row.id === where.id && row.organizationId === where.organizationId) ?? null,
    },
    application: { findMany: async () => [] },
    offerVersion: { findMany: async () => [] },
    task: { findMany: async () => [] },
    screeningDraft: { findMany: async () => { mem.calls.push('screeningDraft'); return []; } },
    screeningLog: {
      findMany: async (args: { where?: Record<string, any> } = {}) => {
        mem.calls.push('screeningLog');
        mem.screeningWhere = args.where ?? null;
        if (args.where?.notes) return [];
        if (args.where?.outcome || args.where?.screenerId) return mem.screenings;
        return [];
      },
    },
    interview: { findMany: async () => mem.interviews },
    interviewScorecard: { findMany: async () => mem.scorecards },
    hiringCase: { findMany: async () => mem.hiringCases },
    employeeActivityTarget: {
      findMany: async () => mem.targets.filter((row) => row.isActive !== false),
      findFirst: async ({ where }: { where: Record<string, any> }) => mem.targets.find((row) => (
        (where.id === undefined || row.id === where.id)
        && (where.organizationId === undefined || row.organizationId === where.organizationId)
        && (typeof where.employeeId !== 'string' || row.employeeId === where.employeeId)
        && (where.metric === undefined || row.metric === where.metric)
        && (where.periodType === undefined || row.periodType === where.periodType)
        && (where.periodKey === undefined || row.periodKey === where.periodKey)
        && (where.scopeKey === undefined || row.scopeKey === where.scopeKey)
        && (where.isActive === undefined || row.isActive === where.isActive)
      )) ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: randomUUID(), version: 1, isActive: true, vacancyId: null, createdAt: NOW, updatedAt: NOW, ...data };
        mem.targets.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const row = mem.targets.find((item) => item.id === where.id && item.version === where.version && item.organizationId === where.organizationId);
        if (!row) return { count: 0 };
        row.targetQuantity = data.targetQuantity;
        row.version += 1;
        return { count: 1 };
      },
    },
    employeeActivityTargetRevision: {
      findMany: async ({ where }: { where?: { targetId?: { in?: string[] } } } = {}) => {
        const ids = where?.targetId?.in;
        return mem.revisions
          .filter((row) => !ids || ids.includes(row.targetId))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        mem.revisions.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, any> }) => {
        mem.audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  const access = {
    getApplicationVisibilityWhere: async () => ({ organizationId: ORG }),
    getVacancyVisibilityWhere: async () => ({ organizationId: ORG }),
  };
  const svc = new ResultsService(prisma as never, access as never);

  function application(applicationId: string, vacancyId = randomUUID()) {
    return {
      id: applicationId,
      vacancyId,
      primaryRecruiterId: ids.outsider,
      candidate: { firstName: 'Nour', lastName: 'Ali' },
      vacancy: { id: vacancyId, vacancyCode: 'VAC-1', branchId: randomUUID(), position: { title: 'Registered Nurse' }, primaryRecruiterId: ids.outsider },
    };
  }

  function screening(applicationId: string, extra: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      organizationId: ORG,
      applicationId,
      screenerId: ids.employee,
      outcome: 'Passed',
      screenedAt: NOW,
      application: application(applicationId),
      ...extra,
    };
  }

  beforeEach(() => { reset(); });

  it('counts 8 finalized screenings against a target of 20', async () => {
    const qualifying = Array.from({ length: 8 }, () => randomUUID());
    for (const applicationId of qualifying) mem.screenings.push(screening(applicationId));
    mem.screenings.push(screening(qualifying[0]!, { screenedAt: new Date(NOW.getTime() + 60_000) }));
    mem.screenings.push(screening(randomUUID(), { outcome: '__discarded__' }));
    mem.screenings.push(screening(randomUUID(), { screenerId: ids.outsider }));
    mem.screenings.push(screening(randomUUID(), { screenedAt: new Date('2026-08-15T12:00:00.000Z') }));
    mem.calls.push('draft-row-is-not-a-screening-log');

    const item = await svc.createTarget(manager, {
      employeeId: ids.employee,
      metric: 'screenings_completed',
      periodType: 'monthly',
      periodKey: '2026-11',
      targetQuantity: 20,
      notes: 'Initial target assigned',
    }, NOW);

    expect(item).toMatchObject({ target: 20, achieved: 8, remaining: 12, progressPercent: 40, metric: 'screenings_completed', metricLabel: 'Screenings completed' });
    expect(item.records).toHaveLength(8);
    expect(item.records.every((row) => row.counted && qualifying.includes(row.applicationId))).toBe(true);
    expect(new Set(item.records.map((row) => row.applicationId)).size).toBe(8);
    expect(mem.calls).not.toContain('screeningDraft');
    expect(mem.screeningWhere).toMatchObject({
      organizationId: ORG,
      screenerId: ids.employee,
      outcome: { not: '__discarded__' },
    });
    expect(mem.audits.map((row) => row.action)).toContain('TARGET_CREATED');
    expect(JSON.stringify(item)).not.toMatch(FORBIDDEN);
    expect(item.records[0]!.candidateName).toBe('Nour Ali');
  });

  it('keeps historical screening, interview, and feedback attribution after the file owner moves', async () => {
    const applicationId = randomUUID();
    const interviewId = randomUUID();
    mem.screenings.push(screening(applicationId));
    mem.interviews.push({
      id: interviewId,
      organizationId: ORG,
      status: 'Completed',
      interviewType: 'Video',
      applicationId,
      completedAt: NOW,
      scheduledEnd: new Date('2026-08-01T12:00:00.000Z'),
      attendees: [{ userId: ids.employee, response: 'Accepted' }],
      scorecards: [{ interviewerId: ids.employee, status: 'Submitted', revision: 1, submittedAt: NOW }],
      application: application(applicationId),
    });
    mem.scorecards.push({
      id: randomUUID(),
      interviewId,
      interviewerId: ids.employee,
      status: 'Submitted',
      revision: 1,
      submittedAt: NOW,
      interview: { id: interviewId, status: 'Completed', application: application(applicationId) },
    });
    const screen = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 4 }, NOW);
    const conducted = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'interviews_conducted', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 4 }, NOW);
    const feedback = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'feedback_submitted', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 4 }, NOW);
    expect(screen.achieved).toBe(1);
    expect(conducted.achieved).toBe(1);
    expect(feedback.achieved).toBe(1);
    expect(screen.records[0]!.applicationId).toBe(applicationId);
  });

  it('ignores drafts, unfinished interviews, reschedules, and scorecard revisions', async () => {
    const applicationId = randomUUID();
    const interviewId = randomUUID();
    const retryId = randomUUID();
    mem.interviews.push(
      { id: interviewId, organizationId: ORG, status: 'Completed', interviewType: 'Video', applicationId, completedAt: NOW, scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(applicationId) },
      { id: retryId, organizationId: ORG, status: 'Completed', interviewType: 'Video', applicationId, completedAt: new Date(NOW.getTime() + 86_400_000), scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(applicationId) },
      { id: randomUUID(), organizationId: ORG, status: 'Scheduled', interviewType: 'Video', applicationId: randomUUID(), completedAt: null, scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(randomUUID()) },
      { id: randomUUID(), organizationId: ORG, status: 'Rescheduled', interviewType: 'Phone', applicationId: randomUUID(), completedAt: null, scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(randomUUID()) },
      { id: randomUUID(), organizationId: ORG, status: 'Cancelled', interviewType: 'Video', applicationId: randomUUID(), completedAt: NOW, scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(randomUUID()) },
      { id: randomUUID(), organizationId: ORG, status: 'No-show', interviewType: 'Video', applicationId: randomUUID(), completedAt: NOW, scheduledEnd: NOW, attendees: [{ userId: ids.employee, response: 'Accepted' }], scorecards: [], application: application(randomUUID()) },
    );
    mem.scorecards.push(
      { id: randomUUID(), interviewId, interviewerId: ids.employee, status: 'Draft', revision: 1, submittedAt: null, interview: { id: interviewId, status: 'Completed', application: application(applicationId) } },
      { id: randomUUID(), interviewId: 'old', interviewerId: ids.employee, status: 'Submitted', revision: 1, submittedAt: new Date('2026-08-02T12:00:00.000Z'), interview: { id: 'old', status: 'Completed', application: application('old-app') } },
      { id: randomUUID(), interviewId: 'old', interviewerId: ids.employee, status: 'Submitted', revision: 2, submittedAt: NOW, interview: { id: 'old', status: 'Completed', application: application('old-app') } },
      { id: randomUUID(), interviewId: 'live', interviewerId: ids.employee, status: 'Submitted', revision: 1, submittedAt: NOW, interview: { id: 'live', status: 'Completed', application: application('live-app') } },
      { id: randomUUID(), interviewId: 'live', interviewerId: ids.employee, status: 'Submitted', revision: 2, submittedAt: new Date(NOW.getTime() + 3_600_000), interview: { id: 'live', status: 'Completed', application: application('live-app') } },
      { id: randomUUID(), interviewId: randomUUID(), interviewerId: ids.employee, status: 'Submitted', revision: 1, submittedAt: NOW, interview: { id: 'cancelled', status: 'Cancelled', application: application('cancelled-app') } },
      { id: randomUUID(), interviewId: randomUUID(), interviewerId: ids.employee, status: 'Submitted', revision: 1, submittedAt: NOW, interview: { id: 'noshow', status: 'No-show', application: application('noshow-app') } },
    );

    const conducted = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'interviews_conducted', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 5 }, NOW);
    const feedback = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'feedback_submitted', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 5 }, NOW);
    expect(conducted.achieved).toBe(1);
    expect(conducted.records.map((row) => row.id)).toEqual([interviewId]);
    expect(feedback.achieved).toBe(1);
    expect(feedback.records[0]!.applicationId).toBe('live-app');
  });

  it('rejects a duplicate target and keeps revision history when the quantity moves', async () => {
    const created = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'seats_joined', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 2 }, NOW);
    await expect(svc.createTarget(manager, { employeeId: ids.employee, metric: 'seats_joined', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 3 }, NOW)).rejects.toMatchObject({ status: 409 });
    await expect(svc.updateTarget(manager, created.id, { targetQuantity: 4, reason: ' ' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.updateTarget(manager, created.id, { targetQuantity: 4, reason: 'no' })).rejects.toMatchObject({ status: 400 });
    const updated = await svc.updateTarget(manager, created.id, { targetQuantity: 4, reason: 'Workload change for November', version: 1 });
    expect(updated.version).toBe(2);
    expect(updated.target).toBe(4);
    expect(updated.revisions.map((row) => [row.priorTarget, row.newTarget])).toEqual([[null, 2], [2, 4]]);
    expect(updated.revisions[1]!.reason).toBe('Workload update for November');
    expect(JSON.stringify(updated)).not.toMatch(FORBIDDEN);
    expect(mem.audits.map((row) => row.action)).toEqual(['TARGET_CREATED', 'TARGET_UPDATED']);
    await expect(svc.updateTarget(manager, created.id, { targetQuantity: 5, reason: 'Another adjustment', version: 1 })).rejects.toMatchObject({ status: 409 });
    const records = await svc.targetRecords(employee, created.id);
    expect(records.revisions).toHaveLength(2);
  });

  it('blocks employees and managers outside the reporting line', async () => {
    await expect(svc.createTarget(employee, { employeeId: ids.employee, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 1 }, NOW)).rejects.toMatchObject({ status: 403 });
    await expect(svc.createTarget(manager, { employeeId: ids.outsider, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 1 }, NOW)).rejects.toMatchObject({ status: 403 });
    const created = await svc.createTarget(manager, { employeeId: ids.employee, metric: 'feedback_submitted', periodType: 'weekly', periodKey: '2026-W45', targetQuantity: 1 }, NOW);
    await expect(svc.updateTarget(employee, created.id, { targetQuantity: 2, reason: 'Raise the weekly goal' })).rejects.toMatchObject({ status: 403 });
    await expect(svc.updateTarget(outsider, created.id, { targetQuantity: 2, reason: 'Raise the weekly goal' })).rejects.toMatchObject({ status: 403 });
    await expect(svc.targetRecords(outsider, created.id)).rejects.toMatchObject({ status: 403 });
    await expect(svc.createTarget(manager, { employeeId: ids.employee, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 0 }, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(svc.createTarget(manager, { employeeId: ids.employee, metric: 'calls_made', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 1 }, NOW)).rejects.toMatchObject({ status: 400 });
    const listed = await svc.listTargets(employee, { scope: 'me', periodType: 'weekly', periodKey: '2026-W45' }, NOW);
    expect(listed.targets.map((row) => row.id)).toEqual([created.id]);
    expect(JSON.stringify(listed)).not.toMatch(FORBIDDEN);
  });

  it('keeps target words out of the monthly results payload', async () => {
    mem.screenings.push(screening(randomUUID()));
    await svc.createTarget(manager, { employeeId: ids.employee, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 20, notes: 'Initial target assigned' }, NOW);
    const mine = await svc.results(employee, 'me', { month: '2026-11' }, NOW);
    const team = await svc.results(manager, 'team', { month: '2026-11' }, NOW);
    expect(mine.targets).toHaveLength(1);
    expect(mine.targets![0]).toMatchObject({ achieved: 1, target: 20, remaining: 19, progressPercent: 5 });
    expect(mine.jobOptions).toBeUndefined();
    expect(team.targets).toHaveLength(1);
    expect(team.jobOptions).toEqual([]);
    expect(JSON.stringify(mine)).not.toMatch(FORBIDDEN);
    expect(JSON.stringify(team)).not.toMatch(FORBIDDEN);
    expect(team.people.map((person) => person.id)).toEqual([ids.employee]);
  });

  it('includes reporting-line targets on team results while people stay direct reports', async () => {
    const grandchild = randomUUID();
    users.push({
      id: grandchild,
      organizationId: ORG,
      displayName: 'Sindu',
      jobTitle: 'Recruiter',
      status: 'Active',
      managerId: ids.employee,
      userRoles: [{ role: { code: 'RECRUITER' } }],
    });
    try {
      await svc.createTarget(manager, { employeeId: ids.employee, metric: 'screenings_completed', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 4 }, NOW);
      await svc.createTarget(manager, { employeeId: grandchild, metric: 'interviews_conducted', periodType: 'monthly', periodKey: '2026-11', targetQuantity: 3 }, NOW);
      const team = await svc.results(manager, 'team', { month: '2026-11' }, NOW);
      expect(team.people.map((person) => person.id)).toEqual([ids.employee]);
      expect(team.targets?.map((row) => row.employeeId).sort()).toEqual([grandchild, ids.employee].sort());
      const mine = await svc.results(employee, 'me', { month: '2026-11' }, NOW);
      expect(mine.targets?.map((row) => row.employeeId)).toEqual([ids.employee]);
      const narrowed = await svc.results(manager, 'team', { month: '2026-11', managerId: ids.employee }, NOW);
      expect(narrowed.people).toEqual([]);
      expect(narrowed.targets).toEqual([]);
    } finally {
      const index = users.findIndex((row) => row.id === grandchild);
      if (index >= 0) users.splice(index, 1);
    }
  });
});
