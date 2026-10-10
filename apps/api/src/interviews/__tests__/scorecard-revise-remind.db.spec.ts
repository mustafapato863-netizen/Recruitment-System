import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { InterviewsService } from '../interviews.service';

const url = process.env.B5_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('interviewer revisions + owner scorecard reminder (scratch Postgres)', () => {
  let prisma: PrismaService;
  let svc: InterviewsService;
  const sent: Array<{ recipientUserId: string; type: string }> = [];
  const u = { owner: randomUUID(), iv: randomUUID(), iv2: randomUUID(), other: randomUUID() };
  let interviewId = '';
  const auth = (userId: string) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] });
  const card = { overallRating: 4, recommendation: 'Hire' as const, notes: 'Solid' };

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    // Access stub hides every file: interviewers must not need file visibility for their own card.
    svc = new InterviewsService(prisma, { create: async (n: { recipientUserId: string; type: string }) => { sent.push(n); } } as never, { getApplicationVisibilityWhere: async () => ({ id: '00000000-0000-0000-0000-000000000000' }) } as never);
    const role = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    for (const [n, id] of Object.entries(u)) await prisma.user.create({ data: { id, organizationId: ORG, email: `sr-${id}@t.test`, emailNormalized: `sr-${id}@t.test`, displayName: `SR ${n}`, passwordHash: 'x', emailNotifications: false, userRoles: { create: { roleId: role.id } } } });
    const job = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, status: 'Open' } });
    const cand = await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `SR-${tag}`, firstName: 'S', lastName: 'R' } });
    const app = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `SR-${tag}`, vacancyId: job.id, candidateId: cand.id, stage: 'Interview', primaryRecruiterId: u.owner } });
    interviewId = (await prisma.interview.create({ data: { organizationId: ORG, applicationId: app.id, interviewCode: `SR-${tag}`, title: `SR ${tag}`, interviewType: 'Technical', scheduledStart: new Date('2026-10-01T08:00:00Z'), scheduledEnd: new Date('2026-10-01T09:00:00Z'), attendees: { create: [{ userId: u.iv }, { userId: u.iv2 }] } } as never })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('interviewer revises their own submitted card: new revision, reason required, never in place', async () => {
    const first = await svc.submitScorecard(ORG, interviewId, u.iv, card as never);
    await expect(svc.submitScorecard(ORG, interviewId, u.iv, { ...card, notes: 'edit' } as never)).rejects.toMatchObject({ status: 409 });
    await expect(svc.reviseScorecard(ORG, interviewId, u.iv, { ...card, notes: 'x', reason: '  ' } as never, auth(u.iv) as never)).rejects.toMatchObject({ status: 400 });
    const r2 = await svc.reviseScorecard(ORG, interviewId, u.iv, { ...card, overallRating: 5, notes: 'Better', reason: 'Re-checked references' } as never, auth(u.iv) as never);
    expect(r2).toMatchObject({ revision: 2, previousRevisionId: first.id, revisionReason: 'Re-checked references', status: 'Submitted', overallRating: 5 });
    const rows = await prisma.interviewScorecard.findMany({ where: { interviewId, interviewerId: u.iv }, orderBy: { revision: 'asc' } });
    expect(rows.map((r) => [r.revision, r.notes, r.overallRating])).toEqual([[1, 'Solid', 4], [2, 'Better', 5]]);
  });

  it('nobody revises someone else\'s card; a non-attendee gets 403', async () => {
    await expect(svc.reviseScorecard(ORG, interviewId, u.other, { ...card, reason: 'Because reasons' } as never, auth(u.other) as never)).rejects.toMatchObject({ status: 403 });
    await expect(svc.reviseScorecard(ORG, interviewId, u.iv2, { ...card, reason: 'Nothing submitted yet' } as never, auth(u.iv2) as never)).rejects.toMatchObject({ status: 409 });
  });

  it('scorecard reminder: owner only, one per interview per day (409), only missing interviewers', async () => {
    await expect(svc.sendScorecardReminder(ORG, interviewId, auth(u.other) as never)).rejects.toMatchObject({ status: 403 });
    await expect(svc.sendScorecardReminder(ORG, interviewId, auth(u.iv) as never)).rejects.toMatchObject({ status: 403 });
    const now = new Date('2026-10-02T06:00:00Z');
    const res = await svc.sendScorecardReminder(ORG, interviewId, auth(u.owner) as never, now);
    expect(res).toMatchObject({ sent: 1, recipients: [u.iv2], reminderDate: '2026-10-02' });
    expect(sent.filter((n) => n.type === 'ScorecardReminder').map((n) => n.recipientUserId)).toEqual([u.iv2]);
    await expect(svc.sendScorecardReminder(ORG, interviewId, auth(u.owner) as never, new Date('2026-10-02T20:00:00Z'))).rejects.toMatchObject({ status: 409, response: { code: 'SCORECARD_REMINDER_ALREADY_SENT' } });
    expect((await svc.sendScorecardReminder(ORG, interviewId, auth(u.owner) as never, new Date('2026-10-03T06:00:00Z'))).sent).toBe(1);
    expect(await prisma.dueDateReminder.count({ where: { entityId: interviewId, kind: 'scorecard-nudge' } })).toBe(2);
  });
});
