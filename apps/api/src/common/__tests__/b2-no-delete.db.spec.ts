/**
 * B2 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B2_TEST_DATABASE_URL is set. NEVER point this at production: it creates and
 * then archives/anonymizes fixture rows in the seed organization.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { CandidatesService } from '../../candidates/candidates.service';
import { DocumentStorageService } from '../../documents/document-storage.service';
import { TalentPoolService } from '../../talent-pool/talent-pool.service';
import { UsersService } from '../../users/users.service';
import { privateVacancy } from '../testing/private-vacancy';
import { UserPermissionsService } from '../user-permissions.service';

const url = process.env.B2_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);
const EMAIL = `b2-${tag}@pii.test`;
const PHONE = '+971500000000';

describe.skipIf(!url)('B2 no delete, deactivate, anonymize (scratch Postgres)', () => {
  let prisma: PrismaService;
  let candidates: CandidatesService;
  let storage: DocumentStorageService;
  const ids: Record<string, string> = { candidate: randomUUID(), application: randomUUID(), doc: randomUUID(), note: randomUUID(), screening: randomUUID(), interview: randomUUID(), owner: randomUUID() };
  let storageKey = '';
  let adminId = '';
  const admin = () => ({ userId: adminId, organizationId: ORG, tokenVersion: 0, roleCodes: ['ADMINISTRATOR'] });

  beforeAll(async () => {
    process.env.RECRUITFLOW_DOCUMENT_STORAGE_PATH = mkdtempSync(path.join(tmpdir(), 'b2-docs-'));
    prisma = new PrismaService({ datasources: { db: { url } } });
    storage = new DocumentStorageService();
    candidates = new CandidatesService(prisma, storage);
    adminId = (await prisma.user.findFirstOrThrow({ where: { organizationId: ORG, status: 'Active', userRoles: { some: { role: { code: 'ADMINISTRATOR' } } } }, orderBy: { createdAt: 'asc' } })).id; // the seeded admin, not another suite's temporary one
    const recruiterRole = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    await prisma.user.create({ data: { id: ids.owner, organizationId: ORG, email: `owner-${tag}@b2.test`, emailNormalized: `owner-${tag}@b2.test`, displayName: 'B2 Owner', passwordHash: 'x', userRoles: { create: { roleId: recruiterRole.id } } } });
    const vacancy = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG }, orderBy: { vacancyCode: 'asc' } });

    await prisma.candidate.create({ data: {
      id: ids.candidate, organizationId: ORG, candidateCode: `B2-${tag}`, firstName: 'Fatima', lastName: 'Zahra', email: EMAIL, phone: PHONE,
      currentTitle: 'Nurse', currentCompany: 'Clinic X', summary: `Lives at 12 Palm St, DOB 1990-01-01, national id 784-1990-1234567, ${EMAIL}`,
      location: 'Dubai Marina', metadata: { nationalId: '784-1990-1234567', dateOfBirth: '1990-01-01', address: '12 Palm St' }, skills: ['ICU'],
    } });
    await prisma.application.create({ data: { id: ids.application, organizationId: ORG, applicationCode: `B2-${tag}`, vacancyId: vacancy.id, candidateId: ids.candidate, stage: 'Screening', primaryRecruiterId: ids.owner } });
    await prisma.applicationStatusHistory.create({ data: { applicationId: ids.application, fromStage: 'Applied', toStage: 'Screening', reason: 'moved' } });
    await prisma.applicationNote.create({ data: { id: ids.note, organizationId: ORG, applicationId: ids.application, authorId: adminId, content: `Called Fatima on ${PHONE}` } });
    await prisma.screeningLog.create({ data: { id: ids.screening, organizationId: ORG, applicationId: ids.application, screenerId: adminId, outcome: 'Pass', notes: `Fatima lives in Dubai Marina` } });
    const start = new Date(Date.now() + 86_400_000);
    await prisma.interview.create({ data: { id: ids.interview, organizationId: ORG, applicationId: ids.application, interviewCode: `B2-${tag}`, title: 'Interview with Fatima Zahra', interviewType: 'HR', scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3_600_000) } });
    await prisma.task.create({ data: { organizationId: ORG, assigneeUserId: adminId, createdById: adminId, type: 'FollowUp', title: 'Call Fatima Zahra', description: PHONE, entityType: 'Candidate', entityId: ids.candidate } });
    const job = await prisma.candidateImportJob.create({ data: { organizationId: ORG, fileName: `import-${tag}.xlsx` } });
    ids.importJob = job.id;
    await prisma.candidateImportRow.create({ data: { jobId: job.id, rowNumber: 1, rawData: { name: 'Fatima Zahra', email: EMAIL, cvText: 'Fatima Zahra CV text 784-1990-1234567' }, firstName: 'Fatima', lastName: 'Zahra', email: EMAIL.toUpperCase(), phone: PHONE } });
    await prisma.candidateImportRow.create({ data: { jobId: job.id, rowNumber: 2, rawData: { name: 'Someone Else' }, firstName: 'Someone', lastName: 'Else', email: `other-${tag}@x.test` } });
    await prisma.emailOutbox.create({ data: { organizationId: ORG, toEmail: EMAIL, subject: 'Your interview', template: 'interview', payload: { candidateName: 'Fatima Zahra' } } });
    await prisma.emailOutbox.create({ data: { organizationId: ORG, toEmail: 'recruiter@b2.test', subject: 'New applicant Fatima Zahra', template: 'staff', payload: { candidateName: 'Fatima Zahra', applicationId: ids.application } } });
    // QA BUG-5: notifications with no entity link that still name the candidate.
    const unlinked = [
      ['Fatima Zahra offer for Nurse approved by Finance.', 'Offer approved'],
      [`Reply from ${EMAIL.toUpperCase()}`, 'Inbound email'],
      [`Missed call from ${PHONE}`, 'Missed call'],
      ['FATIMA ZAHRA missing: Nursing License Verification.', 'Compliance'],
      [`Unrelated notification ${tag}`, 'Other'],
    ];
    for (const [message, title] of unlinked) {
      await prisma.notification.create({ data: { organizationId: ORG, recipientUserId: adminId, type: 'Legacy', title: `${title} ${tag}`, message } });
    }
    const put = await storage.put(ORG, ids.candidate, 'cv.pdf', Buffer.from('%PDF secret CV for Fatima'));
    storageKey = put.storageKey;
    await prisma.candidateDocument.create({ data: { id: ids.doc, organizationId: ORG, candidateId: ids.candidate, documentType: 'CV', fileName: 'Fatima_Zahra_CV.pdf', fileSize: 10, mimeType: 'application/pdf', storageKey, storageProvider: 'local-private', extractionText: `Fatima Zahra ${EMAIL}` } });
  });

  afterAll(async () => {
    // Fixtures are intentionally NOT hard-deleted (B2). The owner user is set Inactive after its file closes.
    await prisma?.$disconnect();
  });

  it('blocks deactivating a user who owns open work with a 409 and counts', async () => {
    const users = new UsersService(prisma, {} as never, new UserPermissionsService(prisma));
    const error = await users.update(ORG, ids.owner, { status: 'Inactive' } as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'USER_OWNS_OPEN_WORK', counts: { openApplicationsPrimary: 1 } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.owner } })).status).toBe('Active');
    await prisma.application.update({ where: { id: ids.application }, data: { primaryRecruiterId: null } });
    await users.update(ORG, ids.owner, { status: 'Inactive' } as never);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.owner } })).status).toBe('Inactive');
  });

  it('owner block also counts Vacancy.primaryRecruiterId (B1 column) without any assignment', async () => {
    // Uses its own DB (B2_TEST_DATABASE_URL); a job owner with no PRIMARY
    // assignment would trip the B1 backfill invariant test if both suites
    // shared one database at the same time.
    const users = new UsersService(prisma, {} as never, new UserPermissionsService(prisma));
    const recruiterRole = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    const jobOwner = randomUUID();
    await prisma.user.create({ data: { id: jobOwner, organizationId: ORG, email: `jobowner-${tag}@b2.test`, emailNormalized: `jobowner-${tag}@b2.test`, displayName: 'B2 Job Owner', passwordHash: 'x', userRoles: { create: { roleId: recruiterRole.id } } } });
    // A private job (not a shared seeded one another suite may close meanwhile).
    const job = { id: await privateVacancy(prisma, ORG, 'B2OWN') };
    await prisma.vacancy.update({ where: { id: job.id }, data: { status: 'Open' } });
    await prisma.vacancy.update({ where: { id: job.id }, data: { primaryRecruiterId: jobOwner } });
    try {
      expect(await prisma.vacancyAssignment.count({ where: { userId: jobOwner } })).toBe(0);
      const error = await users.update(ORG, jobOwner, { status: 'Inactive' } as never).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'USER_OWNS_OPEN_WORK', counts: { openJobsPrimary: 1 } });
    } finally {
      await prisma.vacancy.update({ where: { id: job.id }, data: { primaryRecruiterId: null } });
    }
    await users.update(ORG, jobOwner, { status: 'Inactive' } as never);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: jobOwner } })).status).toBe('Inactive');
  });

  it('soft-unlinks talent pool membership and can restore it', async () => {
    const pools = new TalentPoolService(prisma);
    const pool = await prisma.talentPool.findFirstOrThrow({ where: { organizationId: ORG } });
    await pools.addCandidate(ORG, pool.id, { candidateId: ids.candidate } as never);
    await pools.removeCandidate(ORG, pool.id, ids.candidate);
    const link = await prisma.talentPoolCandidate.findUniqueOrThrow({ where: { talentPoolId_candidateId: { talentPoolId: pool.id, candidateId: ids.candidate } } });
    expect(link.removedAt).not.toBeNull();
    const detail = await pools.getPoolDetail(ORG, pool.id, 1, 500);
    expect(detail.candidates.map((c) => c.candidateId)).not.toContain(ids.candidate);
    await pools.addCandidate(ORG, pool.id, { candidateId: ids.candidate } as never);
    expect((await prisma.talentPoolCandidate.findUniqueOrThrow({ where: { id: link.id } })).removedAt).toBeNull();
  });

  it('archives a candidate: hidden from default lists, still readable by id and status filter', async () => {
    await candidates.archiveCandidate(ORG, ids.candidate);
    const list = await candidates.listCandidates(ORG, { pageSize: 500 } as never, { viewPii: true });
    expect(list.data.map((c) => c.id)).not.toContain(ids.candidate);
    const archived = await candidates.listCandidates(ORG, { pageSize: 500, status: 'Archived' } as never, { viewPii: true });
    expect(archived.data.map((c) => c.id)).toContain(ids.candidate);
    expect((await candidates.getCandidate(ORG, ids.candidate, { viewPii: true })).id).toBe(ids.candidate);
    expect(await prisma.application.count({ where: { candidateId: ids.candidate } })).toBe(1);
  });

  it('anonymize removes PII and the file, keeps ids/history, audits without PII, and is idempotent', async () => {
    const reason = 'Legal erasure request ticket 4711';
    const before = await prisma.applicationStatusHistory.count({ where: { applicationId: ids.application } });
    const result = await candidates.anonymizeCandidate(ORG, ids.candidate, reason, admin());
    expect(result.status).toBe('anonymized');

    const c = await prisma.candidate.findUniqueOrThrow({ where: { id: ids.candidate } });
    expect(c).toMatchObject({ id: ids.candidate, candidateCode: `B2-${tag}`, firstName: 'Anonymized', lastName: 'candidate', email: null, phone: null, currentTitle: null, currentCompany: null, summary: null, location: null, metadata: null, status: 'Archived', skills: ['ICU'] });
    expect(c.anonymizedAt).not.toBeNull();

    const doc = await prisma.candidateDocument.findUniqueOrThrow({ where: { id: ids.doc } });
    expect(doc).toMatchObject({ fileName: 'anonymized-document', storageKey: 'anonymized', storageProvider: 'anonymized', extractionText: null, sha256: null, documentType: 'CV' });
    expect(existsSync(path.join(process.env.RECRUITFLOW_DOCUMENT_STORAGE_PATH!, storageKey))).toBe(false);

    expect((await prisma.applicationNote.findUniqueOrThrow({ where: { id: ids.note } })).content).toBe('[Anonymized]');
    expect((await prisma.screeningLog.findUniqueOrThrow({ where: { id: ids.screening } })).notes).toBeNull();
    expect((await prisma.interview.findUniqueOrThrow({ where: { id: ids.interview } })).title).not.toContain('Fatima');
    const task = await prisma.task.findFirstOrThrow({ where: { entityType: 'Candidate', entityId: ids.candidate } });
    expect(`${task.title} ${task.description}`).not.toMatch(/Fatima|\+971/);

    // ids, stages and history kept
    const app = await prisma.application.findUniqueOrThrow({ where: { id: ids.application } });
    expect(app).toMatchObject({ id: ids.application, stage: 'Screening', candidateId: ids.candidate });
    expect(await prisma.applicationStatusHistory.count({ where: { applicationId: ids.application } })).toBe(before);

    // no PII left anywhere we touched
    const blob = JSON.stringify(await prisma.candidate.findUniqueOrThrow({ where: { id: ids.candidate }, include: { documents: true, applications: { include: { notes: true, screeningLogs: true, interviews: true } } } }));
    for (const pii of ['Fatima', 'Zahra', EMAIL, PHONE, '784-1990', 'Palm St', '1990-01-01', 'Dubai Marina']) expect(blob).not.toContain(pii);

    // notifications without an entity link are scrubbed by full name / email / phone (QA BUG-5)
    const notes = await prisma.notification.findMany({ where: { organizationId: ORG, type: 'Legacy', title: { contains: tag } } });
    const stillNamed = await prisma.notification.count({ where: { organizationId: ORG, OR: [{ message: { contains: 'Fatima Zahra', mode: 'insensitive' } }, { message: { contains: EMAIL, mode: 'insensitive' } }, { message: { contains: PHONE } }] } });
    expect(stillNamed).toBe(0);
    expect(notes.filter((n) => n.message.includes('Unrelated'))).toHaveLength(1);
    expect(await prisma.notification.count({ where: { organizationId: ORG, type: 'Legacy', title: 'Notification about an anonymized candidate', recipientUserId: adminId, message: { not: { contains: 'Unrelated' } } } })).toBeGreaterThanOrEqual(4);

    // cached / queued / imported CV and candidate text (B2 fix c)
    const rows = await prisma.candidateImportRow.findMany({ where: { jobId: ids.importJob }, orderBy: { rowNumber: 'asc' } });
    expect(rows[0]).toMatchObject({ rawData: {}, firstName: null, lastName: null, email: null, phone: null });
    expect(rows[1]).toMatchObject({ firstName: 'Someone' });
    const outbox = await prisma.emailOutbox.findMany({ where: { organizationId: ORG, OR: [{ toEmail: 'anonymized@invalid.local' }, { toEmail: 'recruiter@b2.test' }] } });
    expect(outbox.length).toBeGreaterThanOrEqual(2);
    for (const row of outbox) {
      expect(JSON.stringify(row)).not.toMatch(/Fatima|pii\.test/);
      expect(row.status).toBe('Dead');
    }

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'CANDIDATE_ANONYMIZE', entityId: ids.candidate } });
    expect(audit).toMatchObject({ actorUserId: adminId, organizationId: ORG, entityType: 'Candidate', reason, result: 'SUCCESS' });
    expect(JSON.stringify(audit)).not.toMatch(/Fatima|Zahra|pii\.test|\+971/);

    const again = await candidates.anonymizeCandidate(ORG, ids.candidate, reason, admin());
    expect(again).toEqual({ id: ids.candidate, status: 'already_anonymized', anonymizedAt: c.anonymizedAt!.toISOString() });
    expect(await prisma.auditLog.count({ where: { action: 'CANDIDATE_ANONYMIZE', entityId: ids.candidate } })).toBe(1);
  });

  it('only an active Administrator passes the anonymize check; an inactive permission grants nothing', async () => {
    await expect(candidates.assertAdministrator(ORG, adminId)).resolves.toBeUndefined();
    await expect(candidates.assertAdministrator(ORG, ids.owner)).rejects.toThrow();
    const holders = await prisma.rolePermission.findMany({ where: { permission: { code: 'CANDIDATE_ANONYMIZE' } }, select: { role: { select: { code: true } } } });
    expect(holders.map((h) => h.role.code)).toEqual(['ADMINISTRATOR']);
    const retired = await prisma.permission.findUniqueOrThrow({ where: { code: 'CANDIDATE_DELETE' } });
    expect(retired.status).toBe('Retired');
    // seed grants are fresh here; on upgraded DBs the old grant row stays but is not effective
    const perms = await new UserPermissionsService(prisma).getPermissionSet(adminId, ORG);
    expect(perms.has('CANDIDATE_DELETE')).toBe(false);
    expect(perms.has('CANDIDATE_ANONYMIZE')).toBe(true);
  });
});
