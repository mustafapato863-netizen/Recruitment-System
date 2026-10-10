/**
 * B5 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B5_TEST_DATABASE_URL is set. NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { InterviewsService } from '../../interviews/interviews.service';
import { OffersService } from '../../offers/offers.service';
import { GATE_CODES, assertStageGate, resolveRejectionReason } from '../application-gates';
import { expireOverdueOffers } from '../../../../worker/src/offer-expiry';

const url = process.env.B5_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; return 'ok'; } catch (e) {
    const r = (e as { getResponse?: () => unknown }).getResponse?.();
    return (r as { code?: string })?.code ?? (e as Error).message;
  }
}

describe.skipIf(!url)('B5 application file: gates, scorecards, offers, interviewers (scratch Postgres)', () => {
  let prisma: PrismaService;
  let interviews: InterviewsService;
  let offers: OffersService;
  const ids: Record<string, string> = {};
  const access = { getApplicationVisibilityWhere: async (u: { organizationId: string }) => ({ organizationId: u.organizationId }) };
  const notifications = { create: async () => undefined };
  const user = (userId: string) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] });

  async function newApplication(stage: string) {
    const vacancy = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, status: 'Open' } });
    const cand = randomUUID();
    await prisma.candidate.create({ data: { id: cand, organizationId: ORG, candidateCode: `B5-${tag}-${cand.slice(0, 6)}`, firstName: 'B5', lastName: 'Cand' } });
    const app = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `B5-${tag}-${cand.slice(0, 6)}`, vacancyId: vacancy.id, candidateId: cand, stage, primaryRecruiterId: ids.rec } });
    return app;
  }
  const scheduled = (applicationId: string, extra: Record<string, unknown> = {}) => interviews.createInterview(ORG, {
    applicationId, interviewType: 'Technical', scheduledStart: '2031-01-01T08:00:00Z', scheduledEnd: '2031-01-01T09:00:00Z',
    attendeeUserIds: [ids.iv!], locationUrl: 'https://meet.google.com/abc-defg-hij', allowConflict: true, ...extra,
  } as never);
  const card = { overallRating: 4, recommendation: 'Hire' as const, notes: 'Solid' };

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    interviews = new InterviewsService(prisma, notifications as never, access as never);
    offers = new OffersService(prisma, notifications as never, access as never);
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    for (const key of ['rec', 'iv']) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: { id: ids[key], organizationId: ORG, email: `${key}-${tag}@b5.test`, emailNormalized: `${key}-${tag}@b5.test`, displayName: `B5 ${key} ${tag}`, passwordHash: 'x', userRoles: { create: { roleId: recruiter.id } } } });
    }
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('gate 1: Interview needs a saved screen note (409 GATE_SCREEN_NOTE_MISSING), then passes', async () => {
    const app = await newApplication('Screening');
    expect(await codeOf(assertStageGate(prisma, app, 'Interview'))).toBe(GATE_CODES.screenNote);
    await prisma.screeningLog.create({ data: { organizationId: ORG, applicationId: app.id, screenerId: ids.rec!, outcome: 'Passed', notes: '   ' } as never });
    expect(await codeOf(assertStageGate(prisma, app, 'Interview'))).toBe(GATE_CODES.screenNote);
    await prisma.screeningLog.create({ data: { organizationId: ORG, applicationId: app.id, screenerId: ids.rec!, outcome: 'Passed', notes: 'Good fit, licensed' } as never });
    expect(await codeOf(assertStageGate(prisma, app, 'Interview'))).toBe('ok');
  });

  it('gate 2: Offer needs a Submitted scorecard; a Draft does not count', async () => {
    const app = await newApplication('Interview');
    expect(await codeOf(assertStageGate(prisma, app, 'Offer'))).toBe(GATE_CODES.scorecard);
    const iv = await scheduled(app.id);
    await interviews.submitScorecard(ORG, iv.id, ids.iv!, { ...card, status: 'Draft' });
    expect(await codeOf(assertStageGate(prisma, app, 'Offer'))).toBe(GATE_CODES.scorecard);
    const sc = await interviews.submitScorecard(ORG, iv.id, ids.iv!, card);
    expect(sc).toMatchObject({ status: 'Submitted', revision: 1, isLocked: true });
    expect(await codeOf(assertStageGate(prisma, app, 'Offer'))).toBe('ok');
    ids.iv1 = iv.id;
  });

  it('scorecards: Submitted cannot be edited; a revision links the previous one and is what counts', async () => {
    expect(await codeOf(interviews.submitScorecard(ORG, ids.iv1!, ids.iv!, { ...card, notes: 'edit' }))).toBe('SCORECARD_ALREADY_SUBMITTED');
    expect(await codeOf(interviews.reviseScorecard(ORG, ids.iv1!, ids.iv!, { ...card, reason: '  ' } as never))).toBe('REVISION_REASON_REQUIRED');
    const first = await prisma.interviewScorecard.findFirstOrThrow({ where: { interviewId: ids.iv1!, revision: 1 } });
    const rev = await interviews.reviseScorecard(ORG, ids.iv1!, ids.iv!, { overallRating: 2, recommendation: 'No Hire', notes: 'Rechecked references', reason: 'Reference check failed' }, user(ids.rec!));
    expect(rev).toMatchObject({ revision: 2, previousRevisionId: first.id, revisedById: ids.rec, revisionReason: 'Reference check failed', status: 'Submitted' });
    const untouched = await prisma.interviewScorecard.findUniqueOrThrow({ where: { id: first.id } });
    expect(untouched).toMatchObject({ overallRating: 4, notes: 'Solid', status: 'Submitted' });
    const view = await interviews.getInterview(ORG, ids.iv1!);
    expect(view.scorecards.map((s) => [s.revision, s.overallRating])).toEqual([[2, 2]]);
  });

  it('interviewer must be a user: free-text name or unknown id -> 400', async () => {
    const app = await newApplication('Screening');
    expect(await codeOf(scheduled(app.id, { interviewerName: 'Dr. Somebody', attendeeUserIds: [] }))).toBe('INTERVIEWER_NOT_A_USER');
    expect(await codeOf(scheduled(app.id, { attendeeUserIds: [randomUUID()] }))).toBe('INTERVIEWER_NOT_A_USER');
    expect(await codeOf(scheduled(app.id, { attendeeUserIds: [] }))).toBe('INTERVIEWER_REQUIRED');
    const e = await (scheduled(app.id, { interviewerName: 'x' }).catch((err: { getStatus: () => number }) => err.getStatus()));
    expect(e).toBe(400);
  });

  it('room URL enforced on create and update; physical room accepted', async () => {
    const app = await newApplication('Screening');
    expect(await codeOf(scheduled(app.id, { locationUrl: 'http://meet.google.com/x' }))).toBe('ROOM_URL_NOT_HTTPS');
    expect(await codeOf(scheduled(app.id, { locationUrl: 'https://evil.example/x' }))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
    expect(await codeOf(scheduled(app.id, { locationUrl: null }))).toBe('ROOM_REQUIRED');
    const iv = await scheduled(app.id, { locationUrl: null, roomName: 'HR 2.14' });
    expect(iv).toMatchObject({ roomName: 'HR 2.14', locationUrl: null, interviewerName: `B5 iv ${tag}` });
    expect(await codeOf(interviews.updateInterview(ORG, iv.id, { locationUrl: 'https://bad.example/x' } as never))).toBe('ROOM_URL_HOST_NOT_ALLOWED');
  });

  async function offerFor(appId: string, status: string) {
    const offer = await prisma.offer.create({ data: { organizationId: ORG, applicationId: appId, offerCode: `OF-${tag}-${appId.slice(0, 6)}`, status } });
    const v = await prisma.offerVersion.create({ data: { offerId: offer.id, versionNumber: 1, approvalStatus: 'Approved', status: status === 'Approved' ? 'Approved' : status, offerExpiry: new Date('2030-01-01T00:00:00Z') } });
    await prisma.offer.update({ where: { id: offer.id }, data: { currentVersionId: v.id } });
    return { offer, version: v };
  }

  it('gate 3 + offer states: Approved -> Sent -> Accepted moves the file to Pre-Hire and the version carries the state', async () => {
    const app = await newApplication('Offer');
    expect(await codeOf(assertStageGate(prisma, app, 'Pre-Hire'))).toBe(GATE_CODES.offer);
    const { offer, version } = await offerFor(app.id, 'Approved');
    expect(await codeOf(offers.updateOfferStatus(user(ids.rec!), offer.id, { status: 'Accepted' } as never))).toMatch(/Cannot update status/);
    await offers.updateOfferStatus(user(ids.rec!), offer.id, { status: 'Sent' } as never);
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: version.id } })).status).toBe('Sent');
    await offers.updateOfferStatus(user(ids.rec!), offer.id, { status: 'Accepted' } as never);
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: version.id } })).status).toBe('Accepted');
    expect((await prisma.application.findUniqueOrThrow({ where: { id: app.id } })).stage).toBe('Pre-Hire');
    expect(await codeOf(assertStageGate(prisma, app, 'Pre-Hire'))).toBe('ok');
  });

  it('Declined offer -> application Rejected with reason "Declined offer" + history', async () => {
    const app = await newApplication('Offer');
    const { offer, version } = await offerFor(app.id, 'Sent');
    await offers.updateOfferStatus(user(ids.rec!), offer.id, { status: 'Declined' } as never);
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: version.id } })).status).toBe('Declined');
    expect(await prisma.application.findUniqueOrThrow({ where: { id: app.id } })).toMatchObject({ stage: 'Rejected', rejectionReason: 'Declined offer' });
    const h = await prisma.applicationStatusHistory.findFirstOrThrow({ where: { applicationId: app.id, toStage: 'Rejected' } });
    expect(h).toMatchObject({ fromStage: 'Offer', reason: 'Declined offer', changedById: ids.rec });
  });

  it('Expire: manual from Sent; time-based hook only when enabled', async () => {
    const appA = await newApplication('Offer');
    const a = await offerFor(appA.id, 'Sent');
    await offers.updateOfferStatus(user(ids.rec!), a.offer.id, { status: 'Expired' } as never);
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: a.version.id } })).status).toBe('Expired');
    const appB = await newApplication('Offer');
    const b = await offerFor(appB.id, 'Sent');
    const now = new Date('2030-06-01T00:00:00Z');
    expect(await expireOverdueOffers(prisma, now, false)).toBe(0);
    expect(await expireOverdueOffers(prisma, now, true)).toBeGreaterThanOrEqual(1);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: b.offer.id } })).status).toBe('Expired');
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: b.version.id } })).status).toBe('Expired');
  });

  it('gate 4: Joined needs ID, contract and SCFHS licence Verified', async () => {
    const app = await newApplication('Pre-Hire');
    const { offer } = await offerFor(app.id, 'Accepted');
    const hc = await prisma.hiringCase.create({ data: { organizationId: ORG, applicationId: app.id, offerId: offer.id } });
    const err = await assertStageGate(prisma, app, 'Joined').catch((e: { getResponse: () => { code: string; missing: string[] } }) => e.getResponse());
    expect(err).toMatchObject({ code: GATE_CODES.joining, missing: ['ID', 'contract', 'SCFHS licence'] });
    await prisma.complianceRequirement.createMany({ data: [
      { hiringCaseId: hc.id, type: 'Document', name: 'National ID', status: 'Verified' },
      { hiringCaseId: hc.id, type: 'Document', name: 'Employment contract', status: 'Verified' },
      { hiringCaseId: hc.id, type: 'License', name: 'SCFHS licence', status: 'Pending' },
    ] });
    const err2 = await assertStageGate(prisma, app, 'Joined').catch((e: { getResponse: () => { missing: string[] } }) => e.getResponse());
    expect(err2).toMatchObject({ missing: ['SCFHS licence'] });
    await prisma.complianceRequirement.updateMany({ where: { hiringCaseId: hc.id, type: 'License' }, data: { status: 'Verified' } });
    expect(await codeOf(assertStageGate(prisma, app, 'Joined'))).toBe('ok');
  });

  it('gate 5: Rejected requires a reason from the list (system reasons always valid)', async () => {
    expect(await codeOf(resolveRejectionReason(prisma, ORG, ''))).toBe(GATE_CODES.rejectReason);
    expect(await codeOf(resolveRejectionReason(prisma, ORG, 'because I said so'))).toBe(GATE_CODES.rejectReason);
    expect(await resolveRejectionReason(prisma, ORG, 'declined offer')).toBe('Declined offer');
    expect(await resolveRejectionReason(prisma, ORG, 'Requisition cancelled')).toBe('Requisition cancelled');
    expect(await resolveRejectionReason(prisma, ORG, 'NOT_QUALIFIED')).toBe('Not qualified');
    const seeded = await prisma.masterDataValue.findMany({ where: { organizationId: ORG, category: 'rejection-reasons' } });
    expect(seeded.map((v) => v.name)).toEqual(expect.arrayContaining(['Requisition cancelled', 'Declined offer']));
  });
});
