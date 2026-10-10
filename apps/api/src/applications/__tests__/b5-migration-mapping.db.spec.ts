/**
 * B5 migration mapping, checked on the upgraded scratch DB built by the B5
 * cycle (B4 seed + legacy fixtures, then 20261010_b5_application_file_gates).
 * Skipped unless B5_UPGRADE_DATABASE_URL is set. NEVER point this at production.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';

const url = process.env.B5_UPGRADE_DATABASE_URL;

describe.skipIf(!url)('B5 migration: stage remap and backfills', () => {
  let prisma: PrismaService;
  const stage = async (code: string) => prisma.application.findFirstOrThrow({ where: { applicationCode: code } });
  beforeAll(() => { prisma = new PrismaService({ datasources: { db: { url } } }); });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('Scorecard -> Interview; New -> Applied; no legacy stages left', async () => {
    expect((await stage('APP-100185')).stage).toBe('Interview');
    expect((await stage('APP-100192')).stage).toBe('Applied');
    expect(await prisma.application.count({ where: { stage: { in: ['Scorecard', 'Hired', 'New', 'Withdrawn'] } } })).toBe(0);
  });
  it('Hired -> Joined only with ID, contract and licence checked; otherwise Pre-Hire', async () => {
    expect((await stage('APP-100184')).stage).toBe('Joined');
    expect((await stage('APP-100200')).stage).toBe('Pre-Hire');
    expect((await stage('APP-100201')).stage).toBe('Pre-Hire');
  });
  it('Withdrawn -> Rejected with reason "Withdrawn by candidate", history keeps the original', async () => {
    const app = await stage('APP-100186');
    expect(app).toMatchObject({ stage: 'Rejected', rejectionReason: 'Withdrawn by candidate' });
    const h = await prisma.applicationStatusHistory.findFirstOrThrow({ where: { applicationId: app.id, fromStage: 'Withdrawn' } });
    expect(h.toStage).toBe('Rejected');
  });
  it('isLocked backfilled into statuses; no locked columns left', async () => {
    expect(await prisma.interviewScorecard.count({ where: { status: 'Submitted' } })).toBeGreaterThan(0);
    const cols = await prisma.$queryRawUnsafe<Array<{ c: number }>>(`SELECT count(*)::int c FROM information_schema.columns WHERE column_name='isLocked' AND table_name IN ('interview_scorecards','offer_versions')`);
    expect(cols[0]!.c).toBe(0);
    expect(await prisma.offerVersion.count({ where: { status: 'Approved' } })).toBeGreaterThan(0);
  });
  it('free-text interviewers: matched by name or email become attendees; unmatched kept as legacy text only', async () => {
    const byName = await prisma.interview.findFirstOrThrow({ where: { interviewCode: 'INT-300789' }, include: { attendees: { include: { user: true } } } });
    expect(byName.legacyInterviewerName).toBe('Sarah Ahmed');
    expect(byName.attendees.map((a) => a.user.displayName)).toContain('Sarah Ahmed');
    const byEmail = await prisma.interview.findFirstOrThrow({ where: { interviewCode: 'INT-B5-EMAIL' }, include: { attendees: { include: { user: true } } } });
    expect(byEmail.attendees.map((a) => a.user.email)).toEqual(['omar.nasser@recruitflow.local']);
    const none = await prisma.interview.findFirstOrThrow({ where: { interviewCode: 'INT-B5-NOUSER' }, include: { attendees: true } });
    expect(none).toMatchObject({ legacyInterviewerName: 'Dr. Unknown Panelist' });
    expect(none.attendees).toEqual([]);
  });
  it('legacy offer status "Sent to Candidate" normalized to "Sent", with an audit marker per offer', async () => {
    expect(await prisma.offer.count({ where: { status: 'Sent to Candidate' } })).toBe(0);
    const marked = await prisma.auditLog.findMany({ where: { action: 'B5_MIGRATION_OFFER_STATUS_NORMALIZED' } });
    expect(marked.length).toBeGreaterThan(0);
    for (const m of marked) expect((await prisma.offer.findUniqueOrThrow({ where: { id: m.entityId } })).status).toBe('Sent');
  });

  it('rejection reasons seeded per organization', async () => {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    for (const o of orgs) {
      const names = (await prisma.masterDataValue.findMany({ where: { organizationId: o.id, category: 'rejection-reasons' } })).map((v) => v.name);
      expect(names).toEqual(expect.arrayContaining(['Requisition cancelled', 'Declined offer', 'Withdrawn by candidate']));
    }
  });
});
