/**
 * B4 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B4_TEST_DATABASE_URL is set. NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { VacancyCoreService } from '../../vacancy-core/vacancy-core.service';
import { PrismaVacancyCoreRepository } from '../../vacancy-core/prisma-vacancy-core.repository';
import { MyWorkService } from '../my-work.service';
import { sweepDueDateReminders, touchDueReminderHeartbeat } from '../../../../worker/src/due-reminders';

const url = process.env.B4_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);
// Frozen: far-future Cairo day so seed data never collides.
const NOW = new Date('2031-03-10T07:00:00Z'); // 09:00 Cairo
const TODAY = '2031-03-10';
const CONFIG = { enabled: true, leadDays: [3, 1], hour: 8 };

describe.skipIf(!url)('B4 My Work, target chip and reminders (scratch Postgres)', () => {
  let prisma: PrismaService;
  let vacancies: VacancyCoreService;
  let myWork: MyWorkService;
  const ids: Record<string, string> = {};
  const user = (userId: string) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] });

  async function activated(owner: string, due: string, extra: Record<string, unknown> = {}) {
    const branch = await prisma.branch.findFirstOrThrow({ where: { organizationId: ORG } });
    const position = await prisma.position.findFirstOrThrow({ where: { organizationId: ORG } });
    const id = randomUUID();
    await prisma.vacancyRequest.create({ data: {
      id, organizationId: ORG, branchId: branch.id, positionId: position.id, requesterId: ids.manager!, requestCode: `B4-${tag}-${id.slice(0, 4)}`,
      status: 'Approved', requestedHeadcount: 3, targetFillDate: new Date(`${due}T00:00:00Z`), assignedEmployeeId: owner, ...extra,
    } });
    const result = await vacancies.activateRequest(id, ORG, ids.manager!, {});
    return { requestId: id, job: result.vacancy! };
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    vacancies = new VacancyCoreService(new PrismaVacancyCoreRepository(prisma), prisma, { create: async () => undefined } as never);
    myWork = new MyWorkService(prisma);
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    for (const key of ['manager', 'a', 'b']) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: { id: ids[key], organizationId: ORG, email: `${key}-${tag}@b4.test`, emailNormalized: `${key}-${tag}@b4.test`, displayName: `B4 ${key}`, passwordHash: 'x', userRoles: { create: { roleId: recruiter.id } } } });
    }
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('target chip on job and requisition payloads: joined of requisition seats', async () => {
    const { requestId, job } = await activated(ids.a!, TODAY);
    ids.jobA = job.id; ids.reqA = requestId;
    await prisma.vacancy.update({ where: { id: job.id }, data: { joinedHeadcount: 1, status: 'Partially Filled' } });
    const fresh = await vacancies.getVacancy(ORG, job.id);
    expect(fresh.targetChip).toMatchObject({ filled: 1, target: 3, label: '1 of 3', dueDate: TODAY });
    const request = await vacancies.getRequest(ORG, requestId);
    expect(request.targetChip).toMatchObject({ filled: 1, target: 3, label: '1 of 3', dueDate: TODAY });
  });

  it('My Work is scoped to the caller: A sees own job, not B\'s job or file', async () => {
    const { job: jobB } = await activated(ids.b!, TODAY);
    ids.jobB = jobB.id;
    const cand = randomUUID();
    await prisma.candidate.create({ data: { id: cand, organizationId: ORG, candidateCode: `B4-${tag}`, firstName: 'B4', lastName: 'Cand' } });
    await prisma.application.create({ data: { organizationId: ORG, applicationCode: `B4-${tag}`, vacancyId: jobB.id, candidateId: cand, stage: 'Screening', primaryRecruiterId: ids.b } });
    await prisma.task.create({ data: { organizationId: ORG, assigneeUserId: ids.b!, createdById: ids.b!, type: 'FollowUp', title: `B task ${tag}`, dueAt: new Date('2031-03-09T10:00:00Z') } });
    await prisma.task.create({ data: { organizationId: ORG, assigneeUserId: ids.a!, createdById: ids.a!, type: 'FollowUp', title: `A task ${tag}`, dueAt: new Date('2031-03-09T10:00:00Z') } });

    const a = await myWork.getMyWork(user(ids.a!), NOW);
    expect(a.today).toBe(TODAY);
    expect(a.targets.map((t) => t.vacancyId)).toEqual([ids.jobA]);
    expect(a.dueToday.map((i) => i.id)).toEqual([ids.jobA]);
    expect(a.overdue.map((i) => i.title)).toEqual([`A task ${tag}`]);
    const all = JSON.stringify(a);
    expect(all).not.toContain(ids.jobB);
    expect(all).not.toContain(`B task ${tag}`);

    const b = await myWork.getMyWork(user(ids.b!), NOW);
    expect(b.targets.map((t) => t.vacancyId)).toEqual([ids.jobB]);
  });

  it('held jobs are off My Work; manager sees Pending Approval as waiting on others', async () => {
    await vacancies.holdVacancy(ids.jobB!, ORG, 'budget freeze', user(ids.b!));
    expect((await myWork.getMyWork(user(ids.b!), NOW)).targets).toEqual([]);
    const branch = await prisma.branch.findFirstOrThrow({ where: { organizationId: ORG } });
    const position = await prisma.position.findFirstOrThrow({ where: { organizationId: ORG } });
    const pending = randomUUID();
    await prisma.vacancyRequest.create({ data: { id: pending, organizationId: ORG, branchId: branch.id, positionId: position.id, requesterId: ids.manager!, requestCode: `B4P-${tag}`, status: 'Pending Approval', requestedHeadcount: 1, targetFillDate: new Date('2031-04-01') } });
    const m = await myWork.getMyWork(user(ids.manager!), NOW);
    expect(m.waitingOnOthers).toEqual([expect.objectContaining({ id: pending, waitingOn: 'approver' })]);
  });

  it('Approved, not activated: requester and the requester\'s manager see it (Today / Overdue, Activate)', async () => {
    const boss = randomUUID();
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    await prisma.user.create({ data: { id: boss, organizationId: ORG, email: `boss-${tag}@b4.test`, emailNormalized: `boss-${tag}@b4.test`, displayName: 'B4 boss', passwordHash: 'x', userRoles: { create: { roleId: recruiter.id } } } });
    await prisma.user.update({ where: { id: ids.manager }, data: { managerId: boss } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { organizationId: ORG } });
    const position = await prisma.position.findFirstOrThrow({ where: { organizationId: ORG } });
    const dueToday = randomUUID();
    const late = randomUUID();
    const draft = randomUUID();
    for (const [id, status, due] of [[dueToday, 'Approved', TODAY], [late, 'Approved', '2031-03-01'], [draft, 'Draft', TODAY]] as const) {
      await prisma.vacancyRequest.create({ data: { id, organizationId: ORG, branchId: branch.id, positionId: position.id, requesterId: ids.manager!, requestCode: `B4A-${tag}-${id.slice(0, 4)}`, status, requestedHeadcount: 1, targetFillDate: new Date(`${due}T00:00:00Z`) } });
    }
    for (const viewer of [ids.manager!, boss]) {
      const w = await myWork.getMyWork(user(viewer), NOW);
      expect(w.dueToday.find((i) => i.id === dueToday)?.nextAction).toEqual({ code: 'activate-requisition', label: 'Activate' });
      expect(w.overdue.find((i) => i.id === late)?.nextAction.label).toBe('Activate');
    }
    const bossWork = await myWork.getMyWork(user(boss), NOW);
    expect(JSON.stringify(bossWork)).not.toContain(draft); // drafts stay the requester's
    expect(JSON.stringify(await myWork.getMyWork(user(ids.a!), NOW))).not.toContain(dueToday);
  });

  it('E1 (DB): candidate/stage on file items, department/site/owner on targets, ?day=tomorrow, worker heartbeat', async () => {
    const { job } = await activated(ids.a!, '2031-04-30');
    const cand = randomUUID();
    await prisma.candidate.create({ data: { id: cand, organizationId: ORG, candidateCode: `E1-${tag}`, firstName: 'Ahmed', lastName: 'Embaby' } });
    const app = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `E1-${tag}`, vacancyId: job.id, candidateId: cand, stage: 'Interview', primaryRecruiterId: ids.a } });
    await prisma.interview.create({ data: {
      organizationId: ORG, interviewCode: `E1-${tag}`, applicationId: app.id, title: 'E1 interview', interviewType: 'Technical',
      scheduledStart: new Date('2031-03-11T08:00:00Z'), scheduledEnd: new Date('2031-03-11T09:00:00Z'), locationUrl: 'https://meet.google.com/e1',
      attendees: { create: [{ userId: ids.b! }, { userId: ids.a! }] },
    } });
    const tomorrow = await myWork.getMyWork(user(ids.a!), NOW, 'tomorrow');
    expect(tomorrow.date).toBe('2031-03-11');
    const item = tomorrow.dueToday.find((i) => i.type === 'interview')!;
    expect(item).toMatchObject({
      entity: { type: 'interview' }, applicationId: app.id, stage: 'Interview', candidate: { id: cand, name: 'Ahmed Embaby' },
      room: { url: 'https://meet.google.com/e1', name: null }, startAt: '2031-03-11T08:00:00.000Z',
    });
    expect(item.interviewers!.map((p) => p.id).sort()).toEqual([ids.a, ids.b].sort());
    expect(item.interviewer).toEqual(item.interviewers![0]);
    const today = await myWork.getMyWork(user(ids.a!), NOW);
    const target = today.targets.find((t) => t.vacancyId === job.id)!;
    expect(target.owner).toEqual({ id: ids.a, name: 'B4 a' });
    expect(target.site).toBeTruthy();
    expect(target).toHaveProperty('department');

    await prisma.serviceHeartbeat.deleteMany({ where: { service: 'due-reminders' } });
    expect((await myWork.getMyWork(user(ids.a!), NOW)).reminderWorkerHealthy).toBe(false);
    await touchDueReminderHeartbeat(prisma, new Date(NOW.getTime() - 60_000), 300_000, 0);
    expect((await myWork.getMyWork(user(ids.a!), NOW)).reminderWorkerHealthy).toBe(true);
    expect((await myWork.getMyWork(user(ids.a!), new Date(NOW.getTime() + 3_600_000))).reminderWorkerHealthy).toBe(false);
  });

  it('reminder worker: once per item/day, owner only, nothing for held/closed/cancelled', async () => {
    const { requestId: cancelledReq } = await activated(ids.a!, TODAY);
    await vacancies.cancelRequest(cancelledReq, ORG, ids.manager!, 'budget gone');

    await sweepDueDateReminders(prisma as never, NOW, CONFIG);
    await sweepDueDateReminders(prisma as never, new Date('2031-03-10T15:00:00Z'), CONFIG);
    const mine = await prisma.notification.findMany({ where: { type: 'DueDateReminder', recipientUserId: { in: [ids.a!, ids.b!] } } });
    expect(mine.map((n) => [n.recipientUserId, n.entityId, n.title.split(':')[0]])).toEqual([[ids.a, ids.jobA, 'Due today']]);
    expect(await prisma.dueDateReminder.count({ where: { entityId: ids.reqA, reminderDate: new Date(`${TODAY}T00:00:00Z`) } })).toBe(1);
    expect(await prisma.dueDateReminder.count({ where: { entityId: cancelledReq } })).toBe(0);

    await sweepDueDateReminders(prisma as never, new Date('2031-03-11T07:00:00Z'), CONFIG);
    expect(await prisma.notification.count({ where: { type: 'DueDateReminder', recipientUserId: ids.a!, title: { startsWith: 'Overdue' } } })).toBe(1);
  });
});
