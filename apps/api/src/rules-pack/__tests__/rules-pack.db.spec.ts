/**
 * B11 — integration pack for the seven v2 rules and the five gates.
 * Runs against a migrated + seeded Postgres (CI: .github/workflows/rules-pack.yml, service container).
 * Env: RULES_TEST_DATABASE_URL. Without it the DB parts are skipped (static parts still run).
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../../access-control/access-control.service';
import { SearchService } from '../../search/search.service';
import { InterviewsController } from '../../interviews/interviews.controller';
import { InterviewsService } from '../../interviews/interviews.service';
import { ALLOW_INTERVIEW_ATTENDEE } from '../../common/decorators/tenant-resource.decorator';
import { assertEligibleOwner } from '../../common/access/file-access';
import { redactVacancy } from '../../vacancy-core/vacancy-core.service';
import { JOB_STATUSES, JOB_TRANSITIONS, assertJobAcceptsApplications } from '../../vacancy-core/vacancy-lifecycle';
import { GATE_CODES, assertStageGate, resolveRejectionReason } from '../../applications/application-gates';
import { scorecardState } from '../../interviews/interview-rules';import { HAS_VACANCY_OWNER } from '../../common/schema-features';


const url = process.env.RULES_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__') sourceFiles(p, out); }
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}
const code = (e: unknown) => (e as { response?: { code?: string } }).response?.code;

describe('B11 rules pack — static', () => {
  it('R1 no LOCKED: scorecard state is Draft/Submitted; isLocked is only a derived, deprecated mirror of Submitted', () => {
    const base = { revision: 1, previousRevisionId: null, revisedById: null, revisionReason: null, submittedAt: new Date(), createdAt: new Date() };
    expect(scorecardState({ ...base, status: 'Submitted' })).toMatchObject({ status: 'Submitted', isLocked: true });
    expect(scorecardState({ ...base, status: 'Draft' })).toMatchObject({ status: 'Draft', isLocked: false });
  });

  it('R2 no delete: no hard delete of business records anywhere in API source', () => {
    const re = /\.(candidate|application|vacancy|vacancyRequest|user|offer|offerVersion|interview|interviewScorecard|candidateDocument|role|permission)\.delete(Many)?\(/;
    const hits = sourceFiles(SRC).filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('R3 hold lives on the job: On Hold is a job status, held jobs take no applications', () => {
    expect(JOB_STATUSES).toContain('On Hold');
    expect(JOB_TRANSITIONS.Open).toContain('On Hold');
    expect(() => assertJobAcceptsApplications({ status: 'On Hold', vacancyCode: 'X' })).toThrow();
    expect(() => assertJobAcceptsApplications({ status: 'Open', vacancyCode: 'X' })).not.toThrow();
  });

  it('R4 Cancelled lives on the requisition only: not a job status', () => {
    expect(JOB_STATUSES as readonly string[]).not.toContain('Cancelled');
    expect(JOB_STATUSES as readonly string[]).not.toContain('Pending Activation');
  });

  it('R6 interviewer exception: only CV, own scorecard (read/submit/revise), plus RSVP/.ics of the interview itself', () => {
    const proto = InterviewsController.prototype as unknown as Record<string, unknown>;
    const allowed = Object.getOwnPropertyNames(proto)
      .filter((m) => typeof proto[m] === 'function' && Reflect.getMetadata(ALLOW_INTERVIEW_ATTENDEE, proto[m] as object) === true)
      .sort();
    expect(allowed).toEqual(['getInterviewIcs', 'getCandidateCv', 'getScorecards', 'respondToInterview', 'reviseScorecard', 'submitScorecard'].sort());
  });

  it('R7 another owner\'s job is title / site / seats only', () => {
    const r = redactVacancy({ id: 'v', position: { title: 'ICU Nurse' }, branch: { id: 'b', name: 'Riyadh' }, approvedHeadcount: 3, joinedHeadcount: 1, vacancyCode: 'VR-1', salaryMax: 9 } as never);
    expect(Object.keys(r).sort()).toEqual(['id', 'redacted', 'seats', 'site', 'title']);
    expect(r).toEqual({ id: 'v', redacted: true, title: 'ICU Nurse', site: { id: 'b', name: 'Riyadh' }, seats: { filled: 1, target: 3 } });
  });
});

describe.skipIf(!url)('B11 rules pack — Postgres', () => {
  let prisma: PrismaService;
  const u = { owner: randomUUID(), other: randomUUID(), interviewer: randomUUID(), admin: randomUUID(), inactive: randomUUID() };
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  let jobA = ''; let jobB = ''; let appId = ''; let interviewId = '';

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'ADMINISTRATOR', 'INTERVIEWER'] } } })).map((r) => [r.code, r.id]));
    const mk = (id: string, n: string, role: string, status = 'Active') => prisma.user.create({ data: { id, organizationId: ORG, email: `rp-${n}-${tag}@t.test`, emailNormalized: `rp-${n}-${tag}@t.test`, displayName: `RP ${n}`, passwordHash: 'x', status, emailNotifications: false, userRoles: { create: { roleId: (roles[role] ?? roles.RECRUITER)! } } } });
    await mk(u.owner, 'owner', 'RECRUITER'); await mk(u.other, 'other', 'RECRUITER'); await mk(u.interviewer, 'iv', 'INTERVIEWER'); await mk(u.admin, 'admin', 'ADMINISTRATOR'); await mk(u.inactive, 'inactive', 'RECRUITER', 'Inactive');
    // Private job copies: picking "the last Open jobs" re-owned jobs other suites (b3-lifecycle) had just activated.
    const { privateVacancy } = await import('../../common/testing/private-vacancy');
    jobA = await privateVacancy(prisma, ORG, 'RPA'); jobB = await privateVacancy(prisma, ORG, 'RPB');
    for (const [job, owner] of [[jobA, u.owner], [jobB, u.other]] as const) {
      // Same shape the API writes: one active PRIMARY assignment mirrored in Vacancy.primaryRecruiterId.
      await prisma.$transaction([ // atomic: other suites check the single-PRIMARY invariant concurrently
        prisma.vacancyAssignment.updateMany({ where: { vacancyId: job, assignmentKind: 'PRIMARY', isActive: true }, data: { isActive: false } }),
        prisma.vacancyAssignment.create({ data: { vacancyId: job, userId: owner, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } }),
        prisma.vacancy.update({ where: { id: job }, data: { primaryRecruiterId: owner } }),
      ]);
    }
    const cand = await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `RP-${tag}`, firstName: `Rp${tag}`, lastName: 'Cand', email: `rp-c-${tag}@t.test` } });
    appId = (await prisma.application.create({ data: { organizationId: ORG, applicationCode: `RP-${tag}`, vacancyId: jobA, candidateId: cand.id, stage: 'Screening', primaryRecruiterId: u.owner } })).id;
    interviewId = (await prisma.interview.create({ data: { organizationId: ORG, applicationId: appId, interviewCode: `RP-${tag}`, title: 'RP', interviewType: 'Technical', scheduledStart: new Date('2031-01-01T08:00:00Z'), scheduledEnd: new Date('2031-01-01T09:00:00Z'), attendees: { create: { userId: u.interviewer } } } as never })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('R1 no LOCKED rows: no locked column anywhere, no Locked status', async () => {
    const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (column_name ILIKE 'is_locked' OR column_name ILIKE 'islocked' OR column_name ILIKE 'locked')`;
    expect(cols).toEqual([]);
    expect(await prisma.interviewScorecard.count({ where: { status: { equals: 'Locked', mode: 'insensitive' } } })).toBe(0);
    expect(await prisma.offerVersion.count({ where: { status: { equals: 'Locked', mode: 'insensitive' } } })).toBe(0);
  });

  it('R2 no delete: CANDIDATE_DELETE is retired and granted to nobody', async () => {
    const p = await prisma.permission.findFirst({ where: { code: 'CANDIDATE_DELETE' } });
    if (p) {
      expect(p.status).not.toBe('Active');
      expect(await prisma.rolePermission.count({ where: { permissionId: p.id, role: { status: 'Active' } } })).toBe(0);
    }
  });

  it('R3/R4 data: no job is Cancelled or Pending Activation; no requisition is On Hold', async () => {
    expect(await prisma.vacancy.count({ where: { status: { in: ['Cancelled', 'Pending Activation'] } } })).toBe(0);
    expect(await prisma.vacancyRequest.count({ where: { status: 'On Hold' } })).toBe(0);
  });

  it('R5 owner = Vacancy.primaryRecruiterId, never an admin or inactive user', async () => {
    await expect(assertEligibleOwner(prisma, ORG, u.admin)).rejects.toMatchObject({ status: 400 });
    await expect(assertEligibleOwner(prisma, ORG, u.inactive)).rejects.toMatchObject({ status: 400 });
    await expect(assertEligibleOwner(prisma, ORG, u.owner)).resolves.toBeUndefined();
    const bad = await prisma.vacancy.count({ where: { primaryRecruiter: { OR: [{ status: { not: 'Active' } }, { userRoles: { some: { role: { code: 'ADMINISTRATOR' } } } }] } } });
    expect(bad).toBe(0);
  });

  it('R6 interviewer sees only their own scorecard on the interview', async () => {
    await prisma.interviewScorecard.create({ data: { interviewId, interviewerId: u.interviewer, overallRating: 4, recommendation: 'Hire', notes: 'ok', status: 'Submitted', submittedAt: new Date() } as never });
    await prisma.interviewScorecard.create({ data: { interviewId, interviewerId: u.owner, overallRating: 3, recommendation: 'Hire', notes: 'owner', status: 'Submitted', submittedAt: new Date() } as never });
    const svc = new InterviewsService(prisma, {} as never, new AccessControlService(prisma));
    const mine = await svc.getScorecards(ORG, interviewId, auth(u.interviewer, ['INTERVIEWER']));
    expect(mine.map((s) => s.interviewerId)).toEqual([u.interviewer]);
    const owner = await svc.getScorecards(ORG, interviewId, auth(u.owner, ['RECRUITER']));
    expect(owner.map((s) => s.interviewerId).sort()).toEqual([u.interviewer, u.owner].sort());
  });

  it('R7 search: another owner\'s job is redacted, their files excluded, no contact fields', async () => {
    const search = new SearchService(prisma, new AccessControlService(prisma));
    const res = await search.search(auth(u.other, ['RECRUITER']), `Rp${tag}`, 10);
    const items = res.groups.flatMap((g) => g.items);
    expect(items.find((i) => i.entityId === appId)).toBeUndefined();
    expect(JSON.stringify(items)).not.toContain(`rp-c-${tag}`);
    const job = await prisma.vacancy.findUniqueOrThrow({ where: { id: jobA }, include: { position: true } });
    const v = (await search.search(auth(u.other, ['RECRUITER']), job.position.title, 25)).groups.find((g) => g.entityType === 'vacancy')?.items.find((i) => i.entityId === jobA);
    if (v) expect(v).toMatchObject({ redacted: true });
  });

  describe('five gates (409 with the gate code, then pass once met)', () => {
    const app = async () => prisma.application.findUniqueOrThrow({ where: { id: appId }, select: { id: true, stage: true } });
    const expectBlocked = async (to: string, gate: string) => {
      const err = await assertStageGate(prisma as never, await app(), to).then(() => null, (e: unknown) => e);
      expect(err).toMatchObject({ status: 409 });
      expect(code(err)).toBe(gate);
    };

    it('gate 1 screen note → Interview', async () => {
      await expectBlocked('Interview', GATE_CODES.screenNote);
      await prisma.screeningLog.create({ data: { organizationId: ORG, applicationId: appId, screenerId: u.owner, outcome: 'Passed', notes: 'fit' } });
      await expect(assertStageGate(prisma as never, await app(), 'Interview')).resolves.toBeUndefined();
    });
    it('gate 2 submitted scorecard → Offer', async () => {
      const other = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `RP2-${tag}`, vacancyId: jobB, candidateId: (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `RP2-${tag}`, firstName: 'R', lastName: 'P' } })).id, stage: 'Interview', primaryRecruiterId: u.other } });
      const err = await assertStageGate(prisma as never, { id: other.id, stage: 'Interview' }, 'Offer').then(() => null, (e: unknown) => e);
      expect(code(err)).toBe(GATE_CODES.scorecard);
      await expect(assertStageGate(prisma as never, { id: appId, stage: 'Interview' }, 'Offer')).resolves.toBeUndefined(); // R6 created Submitted scorecards
    });
    it('gate 3 accepted offer → Pre-Hire', async () => {
      await expectBlocked('Pre-Hire', GATE_CODES.offer);
      const offer = await prisma.offer.create({ data: { organizationId: ORG, applicationId: appId, offerCode: `OFF-RP-${tag}`, status: 'Draft' } });
      await prisma.offerVersion.create({ data: { offerId: offer.id, versionNumber: 1, status: 'Accepted' } as never });
      await expect(assertStageGate(prisma as never, await app(), 'Pre-Hire')).resolves.toBeUndefined();
    });
    it('gate 4 joining checks (ID, contract, SCFHS licence) → Joined', async () => {
      await expectBlocked('Joined', GATE_CODES.joining);
      for (const type of ['ID', 'CONTRACT', 'SCFHS_LICENCE']) await prisma.joiningCheck.create({ data: { applicationId: appId, type, verified: true, verifiedAt: new Date() } });
      await expect(assertStageGate(prisma as never, await app(), 'Joined')).resolves.toBeUndefined();
    });
    it('gate 5 Rejected needs a listed reason', async () => {
      for (const r of ['', 'because']) {
        const err = await resolveRejectionReason(prisma as never, ORG, r).then(() => null, (e: unknown) => e);
        expect(code(err)).toBe(GATE_CODES.rejectReason);
      }
      await expect(resolveRejectionReason(prisma as never, ORG, 'Declined offer')).resolves.toBe('Declined offer');
    });
  });
});

describe('stack-merge guards are live on the integrated stack', () => {
  it('HAS_VACANCY_OWNER is on (B1 under B3/B8): activation and B8 counting use Vacancy.primaryRecruiterId', () => {
    expect(HAS_VACANCY_OWNER).toBe(true);
  });
});
