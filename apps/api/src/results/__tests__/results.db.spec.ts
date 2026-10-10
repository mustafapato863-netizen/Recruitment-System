import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../../access-control/access-control.service';
import { ResultsService } from '../results.service';

const url = process.env.B8_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);
const NOW = new Date('2026-10-10T09:00:00Z');
const SEPT = (d: number) => new Date(Date.UTC(2026, 8, d, 9));

describe.skipIf(!url)('B8 /results (scratch Postgres)', () => {
  let prisma: PrismaService;
  let svc: ResultsService;
  const u = { mgr: randomUUID(), r1: randomUUID(), r2: randomUUID(), admin: randomUUID() };
  let job = ''; let otherJob = '';
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  const run = (who: AuthUser, scope: 'me' | 'team' | 'org', q: Record<string, string> = {}) => svc.results(who, scope, { month: '2026-09', ...q }, NOW);

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    svc = new ResultsService(prisma, new AccessControlService(prisma));
    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'ADMINISTRATOR'] } } })).map((r) => [r.code, r.id]));
    const mk = (id: string, n: string, role: string, managerId?: string) => prisma.user.create({ data: { id, organizationId: ORG, email: `r8-${n}-${tag}@t.test`, emailNormalized: `r8-${n}-${tag}@t.test`, displayName: `R8 ${n}`, passwordHash: 'x', managerId: managerId ?? null, userRoles: { create: { roleId: roles[role]! } } } });
    await mk(u.mgr, 'mgr', 'RECRUITER'); await mk(u.r1, 'r1', 'RECRUITER', u.mgr); await mk(u.r2, 'r2', 'RECRUITER'); await mk(u.admin, 'admin', 'ADMINISTRATOR');
    const jobs = await prisma.vacancy.findMany({ where: { organizationId: ORG, status: { not: 'Closed' } }, take: 2, orderBy: { vacancyCode: 'asc' } });
    job = jobs[0]!.id; otherJob = jobs[1]!.id;
    await prisma.vacancy.update({ where: { id: job }, data: { approvedHeadcount: 3 } });
    await prisma.vacancyAssignment.updateMany({ where: { vacancyId: job, assignmentKind: 'PRIMARY', isActive: true }, data: { isActive: false } });
    await prisma.vacancyAssignment.create({ data: { vacancyId: job, userId: u.r1, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } });
    await prisma.vacancy.update({ where: { id: job }, data: { primaryRecruiterId: u.r1 } as never });
    const mkCand = async (i: number | string) => (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `R8-${tag}-${i}`, firstName: 'R8', lastName: `C${i}` } })).id;
    const apps: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const a = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `R8-${tag}-${i}`, vacancyId: job, candidateId: await mkCand(i), stage: i < 2 ? 'Interview' : 'Screening', primaryRecruiterId: u.r1, followUpDate: new Date(`2026-09-${10 + i}T00:00:00Z`) } as never });
      apps.push(a.id);
      await prisma.screeningLog.create({ data: { organizationId: ORG, applicationId: a.id, screenerId: u.r1, outcome: 'Passed', notes: i === 5 ? '  ' : 'note', screenedAt: SEPT(5) } });
    }
    // follow-ups: app 0/1 acted on (a note after the date), the rest overdue.
    await prisma.applicationNote.create({ data: { organizationId: ORG, applicationId: apps[0]!, content: 'called', createdAt: SEPT(20) } as never });
    await prisma.applicationNote.create({ data: { organizationId: ORG, applicationId: apps[1]!, content: 'called', createdAt: SEPT(20) } as never });
    // a screened file that reached Interview earlier and was later rejected still counts.
    await prisma.application.update({ where: { id: apps[2]! }, data: { stage: 'Rejected' } });
    await prisma.applicationStatusHistory.create({ data: { applicationId: apps[2]!, fromStage: 'Screening', toStage: 'Interview', createdAt: SEPT(7) } as never });
    await prisma.applicationStatusHistory.create({ data: { applicationId: apps[3]!, fromStage: 'Pre-Hire', toStage: 'Joined', createdAt: SEPT(25) } as never });
    // offers: 5 versions sent in Sept, 2 accepted; one sent in Aug (excluded).
    const offer = await prisma.offer.create({ data: { organizationId: ORG, applicationId: apps[4]!, offerCode: `OFF-R8-${tag}`, status: 'Draft' } });
    for (let v = 1; v <= 6; v += 1) {
      await prisma.offerVersion.create({ data: { offerId: offer.id, versionNumber: v, status: v <= 2 ? 'Accepted' : 'Declined', sentAt: v === 6 ? new Date('2026-08-20T09:00:00Z') : SEPT(10 + v) } as never });
    }
    // someone else's file on another job: never counted for r1/team.
    await prisma.application.create({ data: { organizationId: ORG, applicationCode: `R8-${tag}-x`, vacancyId: otherJob, candidateId: await mkCand('x'), stage: 'Screening', primaryRecruiterId: u.r2, followUpDate: new Date('2026-09-12T00:00:00Z') } as never });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('me: the four tiles with value/of/sampleSize/detail/tooFewToJudge', async () => {
    const res = await run(auth(u.r1, ['RECRUITER']), 'me');
    expect(res.month).toBe('2026-09');
    expect(res.range).toEqual({ from: '2026-08-31T21:00:00.000Z', to: '2026-09-30T21:00:00.000Z' });
    const t = res.tiles;
    expect(t.seats).toMatchObject({ of: 3, sampleSize: 1, tooFewToJudge: false });
    expect(t.seats.value).toBeGreaterThanOrEqual(1); // joins on the job this month (shared scratch DB may add more)
    expect(t.overdueFollowUps).toMatchObject({ value: 2, of: 6, sampleSize: 6, tooFewToJudge: false }); // 0,1 noted; 2 closed; 3 stage change after the date; 4,5 overdue
    expect(t.screensReachedInterview).toMatchObject({ value: 4, // 0,1 in Interview; 2 via history; 3 joined
      of: 5, sampleSize: 5, tooFewToJudge: false });
    expect(t.offersAccepted).toMatchObject({ value: 2, of: 5, sampleSize: 5, tooFewToJudge: false });
    for (const k of Object.values(t)) expect(typeof k.detail).toBe('string');
    expect(Object.keys(res.tiles).sort()).toEqual(['offersAccepted', 'overdueFollowUps', 'screensReachedInterview', 'seats']);
    expect(JSON.stringify(res)).not.toMatch(/change|previous|activity/i);
  });

  it('too few to judge under 5, numbers still shown; seats exempt', async () => {
    const res = await run(auth(u.r2, ['RECRUITER']), 'me');
    expect(res.tiles.overdueFollowUps).toMatchObject({ value: 1, sampleSize: 1, tooFewToJudge: true });
    expect(res.tiles.offersAccepted).toMatchObject({ sampleSize: 0, tooFewToJudge: true });
    expect(res.tiles.seats.tooFewToJudge).toBe(false);
  });

  it('vacancyId narrows (never widens); a month without data is empty', async () => {
    const other = await run(auth(u.r1, ['RECRUITER']), 'me', { vacancyId: otherJob });
    expect([other.tiles.overdueFollowUps.of, other.tiles.offersAccepted.of, other.tiles.seats.sampleSize]).toEqual([0, 0, 0]);
    const aug = await svc.results(auth(u.r1, ['RECRUITER']), 'me', { month: '2026-08' }, NOW);
    expect(aug.tiles.offersAccepted).toMatchObject({ value: 0, of: 1 });
  });

  it('team: manager sees direct reports; non-managers 403; managerId filter only narrows', async () => {
    const team = await run(auth(u.mgr, ['RECRUITER']), 'team');
    expect(team.people.map((p) => p.id)).toEqual([u.r1]);
    expect(team.tiles.offersAccepted.of).toBe(5);
    await expect(run(auth(u.r2, ['RECRUITER']), 'team')).rejects.toMatchObject({ status: 403 });
    const narrowed = await run(auth(u.mgr, ['RECRUITER']), 'team', { managerId: u.r2 });
    expect(narrowed.people).toEqual([]);
    expect(narrowed.tiles.offersAccepted.of).toBe(0);
  });

  it('org: admin only; managerId filter selects that manager\'s reports', async () => {
    await expect(run(auth(u.mgr, ['RECRUITER']), 'org')).rejects.toMatchObject({ status: 403 });
    const org = await run(auth(u.admin, ['ADMINISTRATOR']), 'org', { managerId: u.mgr });
    expect(org.people.map((p) => p.id)).toEqual([u.r1]);
    expect(org.tiles.offersAccepted).toMatchObject({ value: 2, of: 5 });
    await expect(run(auth(u.r1, ['RECRUITER']), 'me', { managerId: u.mgr })).rejects.toMatchObject({ status: 400 });
    await expect(svc.results(auth(u.r1, ['RECRUITER']), 'me', { month: '2026-9' }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});
