/**
 * B1 follow-ups (Mustafa answers #1, #2, #5) against a real Postgres
 * (migrated + seeded scratch DB). Skipped unless B1_TEST_DATABASE_URL is set.
 * NEVER point this at production: it creates and deletes fixture rows.
 *
 * Uses the real controller handlers, so the decorators on each route
 * (permissions, @AllowInterviewAttendee, @AllowFileApprover, @RequireAdmin)
 * are what is being tested.
 */
import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { privateVacancy } from '../../testing/private-vacancy';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@recruitflow/database';
// Stack-merge guard: B5 replaces InterviewScorecard.isLocked with status. Fixtures work on both shapes.
const scorecardDone = (done: boolean) => ('isLocked' in Prisma.InterviewScorecardScalarFieldEnum
  ? { isLocked: done }
  : done ? { status: 'Submitted', submittedAt: new Date() } : { status: 'Draft' }) as never;

import { AccessControlService } from '../../../access-control/access-control.service';
import { TenantScopedGuard } from '../../guards/tenant-scoped.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { InterviewsService } from '../../../interviews/interviews.service';
import { InterviewsController } from '../../../interviews/interviews.controller';
import { MeInterviewsController, parseScope } from '../../../interviews/me-interviews.controller';
import { ApplicationsService } from '../../../applications/applications.service';
import { ApplicationsController } from '../../../applications/applications.controller';
import { OffersService } from '../../../offers/offers.service';
import { OffersController } from '../../../offers/offers.controller';
import { HiringService } from '../../../hiring/hiring.service';
import { HiringController } from '../../../hiring/hiring.controller';
import { DocumentsController } from '../../../documents/documents.controller';
import { EmailTemplatesController } from '../../../email-templates/email-templates.controller';
import { WhatsAppTemplatesController } from '../../../whatsapp-templates/whatsapp-templates.controller';
import type { NotificationsService } from '../../../notifications/notifications.service';
import type { AuditService } from '../../../audit/audit.service';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

type Handler = (...args: never[]) => unknown;
type Ctor = { prototype: object; name: string };

describe.skipIf(!url)('B1 follow-ups (scratch Postgres)', () => {
  let prisma: PrismaService;
  let access: AccessControlService;
  let interviews: InterviewsService;
  let applications: ApplicationsService;
  let offers: OffersService;
  let hiring: HiringService;
  const ids = {
    owner: randomUUID(), other: randomUUID(), interviewer: randomUUID(), offerApprover: randomUUID(),
    hireApprover: randomUUID(), admin: randomUUID(),
    candidate: randomUUID(), otherCandidate: randomUUID(), application: randomUUID(), otherApplication: randomUUID(),
    interview: randomUUID(), upcoming2: randomUUID(), past1: randomUUID(), past2: randomUUID(), pastOther: randomUUID(), cv: randomUUID(), otherCv: randomUUID(), passport: randomUUID(),
    offer: randomUUID(), offerVersion: randomUUID(), offerApproval: randomUUID(), hiringCase: randomUUID(), hiringApproval: randomUUID(),
  };
  const users = () => [ids.owner, ids.other, ids.interviewer, ids.offerApprover, ids.hireApprover, ids.admin];
  let vacancyId = '';
  let otherVacancyId = '';
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });

  function ctx(user: AuthUser, params: Record<string, string>, cls: Ctor, method: string): ExecutionContext {
    const handler = (cls.prototype as Record<string, Handler>)[method];
    if (!handler) throw new Error(`${cls.name}.${method} not found`);
    const req = { tenantId: ORG, user, params };
    return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => cls } as unknown as ExecutionContext;
  }
  /** Runs PermissionsGuard then TenantScopedGuard, as Nest does for the route. */
  async function call(user: AuthUser, cls: Ctor, method: string, params: Record<string, string> = {}): Promise<true> {
    const c = ctx(user, params, cls, method);
    await new PermissionsGuard(new Reflector(), prisma).canActivate(c);
    await new TenantScopedGuard(new Reflector(), prisma).canActivate(c);
    return true;
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    access = new AccessControlService(prisma);
    const notifications = { create: async () => undefined, createForUser: async () => undefined } as unknown as NotificationsService;
    interviews = new InterviewsService(prisma, notifications, access);
    applications = new ApplicationsService(prisma, {} as never, {} as never, access);
    offers = new OffersService(prisma, notifications, access);
    hiring = new HiringService(prisma, { log: async () => undefined } as unknown as AuditService, access);

    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'INTERVIEWER', 'ADMINISTRATOR', 'OFFER_APPROVER', 'FINAL_HIRING_APPROVER'] } } })).map((r) => [r.code, r.id]));
    const mkUser = (id: string, name: string, role: string) => prisma.user.create({
      data: { id, organizationId: ORG, email: `${name}-${tag}@b1f.test`, emailNormalized: `${name}-${tag}@b1f.test`, displayName: `B1F ${name}`, passwordHash: 'x', status: 'Active', userRoles: { create: { roleId: roles[role]! } } },
    });
    await mkUser(ids.owner, 'owner', 'RECRUITER');
    await mkUser(ids.other, 'other', 'RECRUITER');
    await mkUser(ids.interviewer, 'interviewer', 'INTERVIEWER');
    await mkUser(ids.offerApprover, 'offer-approver', 'OFFER_APPROVER');
    await mkUser(ids.hireApprover, 'hire-approver', 'FINAL_HIRING_APPROVER');
    await mkUser(ids.admin, 'admin', 'ADMINISTRATOR');

    // Private unowned jobs: seeded unowned jobs are few and other suites pick them concurrently.
    vacancyId = await privateVacancy(prisma, ORG, 'B1a'); otherVacancyId = await privateVacancy(prisma, ORG, 'B1b');
    for (const vid of [vacancyId, otherVacancyId]) {
      // Same shape as a PRIMARY assignment so the B1 backfill invariant holds.
      await prisma.$transaction([ // atomic for concurrent invariant checks
        prisma.vacancyAssignment.create({ data: { vacancyId: vid, userId: ids.owner, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } }),
        prisma.vacancy.update({ where: { id: vid }, data: { primaryRecruiterId: ids.owner } }),
      ]);
    }

    for (const [cid, code] of [[ids.candidate, 'A'], [ids.otherCandidate, 'B']] as const) {
      await prisma.candidate.create({ data: { id: cid, organizationId: ORG, candidateCode: `B1F-${code}-${tag}`, firstName: 'B1F', lastName: code, email: `cand-${code}-${tag}@b1f.test` } });
    }
    await prisma.application.create({ data: { id: ids.application, organizationId: ORG, applicationCode: `B1F-A-${tag}`, vacancyId, candidateId: ids.candidate, stage: 'Offer', primaryRecruiterId: ids.owner } });
    await prisma.application.create({ data: { id: ids.otherApplication, organizationId: ORG, applicationCode: `B1F-B-${tag}`, vacancyId: otherVacancyId, candidateId: ids.otherCandidate, stage: 'Offer', primaryRecruiterId: ids.owner } });
    for (const [docId, cid] of [[ids.cv, ids.candidate], [ids.otherCv, ids.otherCandidate]] as const) {
      await prisma.candidateDocument.create({ data: { id: docId, organizationId: ORG, candidateId: cid, documentType: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', fileSize: 1, storageKey: `b1f/${tag}/${docId}`, storageProvider: 'local' } });
    }

    await prisma.candidateDocument.create({ data: { id: ids.passport, organizationId: ORG, candidateId: ids.candidate, documentType: 'Passport', fileName: 'p.pdf', mimeType: 'application/pdf', fileSize: 1, storageKey: `b1f/${tag}/passport`, storageProvider: 'local' } });
    const start = new Date(Date.now() + 86_400_000);
    await prisma.interview.create({ data: { id: ids.interview, organizationId: ORG, applicationId: ids.application, interviewCode: `B1F-${tag}`, title: 'B1F', interviewType: 'Technical', scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3_600_000), attendees: { create: { userId: ids.interviewer } } } });

    await prisma.offer.create({ data: { id: ids.offer, organizationId: ORG, applicationId: ids.application, offerCode: `B1F-${tag}`, status: 'Pending Approval', versions: { create: { id: ids.offerVersion, versionNumber: 1, approvalStatus: 'Pending', approvals: { create: { id: ids.offerApproval, roleCode: 'OFFER_APPROVER', approverUserId: ids.offerApprover, status: 'Pending' } } } } } });
    await prisma.hiringCase.create({ data: { id: ids.hiringCase, organizationId: ORG, applicationId: ids.application, offerId: ids.offer, status: 'Pending Final Approval', approvals: { create: { id: ids.hiringApproval, roleCode: 'FINAL_HIRING_APPROVER', approverUserId: ids.hireApprover, status: 'Pending' } } } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.hiringCase.deleteMany({ where: { id: ids.hiringCase } });
    await prisma.offer.deleteMany({ where: { id: ids.offer } });
    await prisma.applicationNote.deleteMany({ where: { applicationId: { in: [ids.application, ids.otherApplication] } } });
    const ivIds = [ids.interview, ids.upcoming2, ids.past1, ids.past2, ids.pastOther];
    await prisma.interviewScorecard.deleteMany({ where: { interviewId: { in: ivIds } } });
    await prisma.interviewAttendee.deleteMany({ where: { interviewId: { in: ivIds } } });
    await prisma.interview.deleteMany({ where: { id: { in: ivIds } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [ids.candidate, ids.otherCandidate] } } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: [ids.application, ids.otherApplication] } } });
    await prisma.application.deleteMany({ where: { id: { in: [ids.application, ids.otherApplication] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [ids.candidate, ids.otherCandidate] } } });
    const touched = [vacancyId, otherVacancyId].filter(Boolean);
    await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: { in: touched }, userId: ids.owner } });
    await prisma.vacancy.updateMany({ where: { id: { in: touched } }, data: { primaryRecruiterId: null } });
    await prisma.notification.deleteMany({ where: { recipientUserId: { in: users() } } }).catch(() => undefined);
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users() } } }).catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: users() } } });
    // Rows written by other suites on the shared CI DB may still reference these users: fall back to deactivation.
    await prisma.user.deleteMany({ where: { id: { in: users() } } }).catch(() => prisma.user.updateMany({ where: { id: { in: users() } }, data: { status: 'Inactive' } }));
    await prisma.$disconnect();
  });

  describe('#1 interviewer RSVP and .ics', () => {
    it('attendee can RSVP and download the .ics; the detail stays 403 and the list does not include it', async () => {
      const iv = auth(ids.interviewer, ['INTERVIEWER']);
      await expect(call(iv, InterviewsController, 'getInterviewIcs', { id: ids.interview })).resolves.toBe(true);
      await expect(call(iv, InterviewsController, 'respondToInterview', { id: ids.interview })).resolves.toBe(true);
      await expect(call(iv, InterviewsController, 'getInterview', { id: ids.interview })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(iv, InterviewsController, 'updateInterview', { id: ids.interview })).rejects.toBeInstanceOf(ForbiddenException);

      const ics = await interviews.getInterviewIcs(ORG, ids.interview, iv);
      expect(ics).toContain('BEGIN:VCALENDAR');
      const receipt = await interviews.respondToInterview(ORG, ids.interview, ids.interviewer, { response: 'Confirmed' } as never, iv);
      expect(receipt).toEqual({ id: ids.interview, response: 'Confirmed', redacted: true });
      expect((await prisma.interviewAttendee.findFirstOrThrow({ where: { interviewId: ids.interview, userId: ids.interviewer } })).response).toBe('Confirmed');

      const list = await interviews.listInterviews(ORG, {} as never, iv);
      expect(list.map((i) => i.id)).not.toContain(ids.interview);
      await expect(interviews.getInterview(ORG, ids.interview, iv)).rejects.toThrow();
    });

    it('GET /me/interviews: shape, scope filter and order, only my interviews, no extra fields, no locked (QA BUG-4)', async () => {
      const day = 86_400_000;
      const mk = async (id: string, offsetDays: number, attendee: string) => {
        const start = new Date(Date.now() + offsetDays * day);
        await prisma.interview.create({ data: { id, organizationId: ORG, applicationId: ids.application, interviewCode: `B1F-${id.slice(0, 8)}`, title: `Panel ${id.slice(0, 4)}`, interviewType: 'HR', scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3_600_000), locationUrl: offsetDays === 2 ? 'https://meet.example/x' : null, attendees: { create: { userId: attendee } } } });
      };
      await mk(ids.upcoming2, 2, ids.interviewer);
      await mk(ids.past1, -3, ids.interviewer);
      await mk(ids.past2, -1, ids.interviewer);
      await mk(ids.pastOther, -2, ids.other);
      await prisma.interviewScorecard.create({ data: { interviewId: ids.upcoming2, interviewerId: ids.interviewer, overallRating: 4, recommendation: 'Hire', ...scorecardDone(true) } });
      await prisma.interviewScorecard.create({ data: { interviewId: ids.past1, interviewerId: ids.interviewer, overallRating: 3, recommendation: 'Neutral', ...scorecardDone(false) } });

      const upcoming = await interviews.listMyInterviews(ORG, ids.interviewer, 'upcoming');
      expect(Object.keys(upcoming)).toEqual(['data']);
      expect(upcoming.data.map((i) => i.id)).toEqual([ids.interview, ids.upcoming2]);
      const past = await interviews.listMyInterviews(ORG, ids.interviewer, 'past');
      expect(past.data.map((i) => i.id)).toEqual([ids.past2, ids.past1]);
      expect(past.data.map((i) => i.id)).not.toContain(ids.pastOther);

      const fields = ['candidateName', 'id', 'interviewType', 'locationUrl', 'myResponse', 'positionTitle', 'roomName', 'scheduledEnd', 'scheduledStart', 'scorecardStatus', 'status', 'timezone', 'title'];
      for (const item of [...upcoming.data, ...past.data]) {
        expect(Object.keys(item).sort()).toEqual(fields);
        expect(item).toMatchObject({ candidateName: 'B1F A', positionTitle: expect.any(String), roomName: null, interviewType: expect.any(String) });
      }
      expect(upcoming.data[1]).toMatchObject({ scorecardStatus: 'submitted', locationUrl: 'https://meet.example/x', title: `Panel ${ids.upcoming2.slice(0, 4)}` });
      expect(upcoming.data[0]!.scorecardStatus).toBe('missing');
      expect(past.data.find((i) => i.id === ids.past1)!.scorecardStatus).toBe('draft');
      expect(past.data.find((i) => i.id === ids.past2)!.scorecardStatus).toBe('missing');

      const blob = JSON.stringify([upcoming, past]);
      expect(blob).not.toMatch(/locked/i);
      expect(blob).not.toMatch(/cand-|@b1f\.test|applicationId|candidateId|cv\.pdf|notes|salary|stage/i);
      expect(await interviews.listMyInterviews(ORG, ids.offerApprover, 'upcoming')).toEqual({ data: [] });

      // scope: default upcoming, anything else 400.
      expect(parseScope(undefined)).toBe('upcoming');
      expect(parseScope('past')).toBe('past');
      for (const bad of ['all', 'UPCOMING', ['past'], '1']) expect(() => parseScope(bad)).toThrow(BadRequestException);
      // Sign-in only: no permission or file guard metadata on the route.
      const handler = MeInterviewsController.prototype.listMyInterviews;
      expect(Reflect.getMetadata('permissions', handler)).toBeUndefined();
      expect(Reflect.getMetadata('TENANT_RESOURCE', handler)).toBeUndefined();
      expect((InterviewsController.prototype as unknown as Record<string, unknown>).listMyInterviews).toBeUndefined();
    });

    it('non-attendees get 403 on RSVP and .ics; the owner keeps the full detail', async () => {
      const other = auth(ids.other, ['RECRUITER']);
      await expect(call(other, InterviewsController, 'getInterviewIcs', { id: ids.interview })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(other, InterviewsController, 'respondToInterview', { id: ids.interview })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(interviews.getInterviewIcs(ORG, ids.interview, other)).rejects.toThrow();
      const owner = auth(ids.owner, ['RECRUITER']);
      await expect(call(owner, InterviewsController, 'getInterview', { id: ids.interview })).resolves.toBe(true);
    });
  });

  describe('#2 approvers read only the file they are approving', () => {
    it('offer approver: application, offer and CV of the file under approval', async () => {
      const ap = auth(ids.offerApprover, ['OFFER_APPROVER']);
      await expect(call(ap, ApplicationsController, 'getApplication', { id: ids.application })).resolves.toBe(true);
      await expect(call(ap, OffersController, 'getOfferById', { id: ids.offer })).resolves.toBe(true);
      await expect(call(ap, DocumentsController, 'listCandidateDocuments', { candidateId: ids.candidate })).resolves.toBe(true);
      await expect(applications.getApplication(ORG, ids.application, ap)).resolves.toMatchObject({ id: ids.application });
      await expect(offers.getOfferById(ap, ids.offer, { viewSalary: false } as never)).resolves.toMatchObject({ id: ids.offer });
      const inbox = await offers.getApprovalInbox(ap, { viewSalary: false } as never);
      expect(inbox.map((i: { id: string }) => i.id)).toContain(ids.offerApproval);
    });

    it('final-hire approver: application, hiring case, offer and CV download of the file under approval', async () => {
      const ap = auth(ids.hireApprover, ['FINAL_HIRING_APPROVER']);
      await expect(call(ap, ApplicationsController, 'getApplication', { id: ids.application })).resolves.toBe(true);
      await expect(call(ap, HiringController, 'getHiringCase', { id: ids.hiringCase })).resolves.toBe(true);
      await expect(call(ap, OffersController, 'getOfferById', { id: ids.offer })).resolves.toBe(true);
      await expect(call(ap, DocumentsController, 'listCandidateDocuments', { candidateId: ids.candidate })).resolves.toBe(true);
      await expect(call(ap, DocumentsController, 'downloadFile', { id: ids.cv })).resolves.toBe(true);
      await expect(hiring.getHiringCase(ORG, ids.hiringCase, ap)).resolves.toMatchObject({ id: ids.hiringCase });
      const inbox = await hiring.getFinalApprovalInbox(ORG, ap);
      expect(inbox.map((c) => c.id)).toContain(ids.hiringCase);
    });

    it('approvers get 403 on other files and on writes', async () => {
      for (const ap of [auth(ids.offerApprover, ['OFFER_APPROVER']), auth(ids.hireApprover, ['FINAL_HIRING_APPROVER'])]) {
        await expect(call(ap, ApplicationsController, 'getApplication', { id: ids.otherApplication })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, DocumentsController, 'listCandidateDocuments', { candidateId: ids.otherCandidate })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, ApplicationsController, 'getWorkspace', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, ApplicationsController, 'updateApplication', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, ApplicationsController, 'updateStage', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, ApplicationsController, 'createNote', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, OffersController, 'createOfferRevision', { id: ids.offer })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, OffersController, 'updateOfferStatus', { id: ids.offer })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, HiringController, 'updateCompliance', { id: ids.hiringCase, reqId: randomUUID() })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, HiringController, 'submitForFinalApproval', { id: ids.hiringCase })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(call(ap, InterviewsController, 'getInterview', { id: ids.interview })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(applications.getApplication(ORG, ids.otherApplication, ap)).rejects.toThrow();
      }
      // A plain non-owner recruiter still gets 403 on the file (no widening).
      await expect(call(auth(ids.other, ['RECRUITER']), ApplicationsController, 'getApplication', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('access ends once the approval is no longer pending', async () => {
      await prisma.offerApproval.update({ where: { id: ids.offerApproval }, data: { status: 'Approved' } });
      const ap = auth(ids.offerApprover, ['OFFER_APPROVER']);
      await expect(call(ap, ApplicationsController, 'getApplication', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(ap, OffersController, 'getOfferById', { id: ids.offer })).rejects.toBeInstanceOf(ForbiddenException);
      await prisma.offerApproval.update({ where: { id: ids.offerApproval }, data: { status: 'Pending' } });
    });
  });

  describe('approver CV download while the approval is Pending', () => {
    const download = (u: AuthUser, docId: string) => call(u, DocumentsController, 'downloadFile', { id: docId });

    it('pending offer approver (no DOWNLOAD_DOCUMENTS) downloads the CV; 403 after the decision', async () => {
      const ap = auth(ids.offerApprover, ['OFFER_APPROVER']);
      const perms = await prisma.rolePermission.findMany({ where: { role: { code: 'OFFER_APPROVER' } }, select: { permission: { select: { code: true } } } });
      expect(perms.map((p) => p.permission.code)).not.toContain('DOWNLOAD_DOCUMENTS');
      await expect(download(ap, ids.cv)).resolves.toBe(true);
      await prisma.offerApproval.update({ where: { id: ids.offerApproval }, data: { status: 'Approved', decidedAt: new Date() } });
      try {
        await expect(download(ap, ids.cv)).rejects.toBeInstanceOf(ForbiddenException);
      } finally {
        await prisma.offerApproval.update({ where: { id: ids.offerApproval }, data: { status: 'Pending', decidedAt: null } });
      }
    });

    it('pending final-hire approver downloads the CV; 403 after the decision', async () => {
      const ap = auth(ids.hireApprover, ['FINAL_HIRING_APPROVER']);
      await expect(download(ap, ids.cv)).resolves.toBe(true);
      await prisma.hiringCaseApproval.update({ where: { id: ids.hiringApproval }, data: { status: 'Approved', decidedAt: new Date() } });
      try {
        await expect(download(ap, ids.cv)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(download(ap, ids.passport)).rejects.toBeInstanceOf(ForbiddenException);
      } finally {
        await prisma.hiringCaseApproval.update({ where: { id: ids.hiringApproval }, data: { status: 'Pending', decidedAt: null } });
      }
    });

    it('non-approvers get 403 on the CV', async () => {
      await expect(download(auth(ids.interviewer, ['INTERVIEWER']), ids.cv)).rejects.toBeInstanceOf(ForbiddenException);
      // An approver of one file cannot pull another candidate's CV.
      await expect(download(auth(ids.offerApprover, ['OFFER_APPROVER']), ids.otherCv)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(download(auth(ids.hireApprover, ['FINAL_HIRING_APPROVER']), ids.otherCv)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('other document types follow the current rules', async () => {
      // No DOWNLOAD_DOCUMENTS: CV only, even while pending.
      await expect(download(auth(ids.offerApprover, ['OFFER_APPROVER']), ids.passport)).rejects.toBeInstanceOf(ForbiddenException);
      // FINAL_HIRING_APPROVER holds DOWNLOAD_DOCUMENTS (seed), so the existing rule applies:
      // documents of the candidate whose file they are approving.
      await expect(download(auth(ids.hireApprover, ['FINAL_HIRING_APPROVER']), ids.passport)).resolves.toBe(true);
      // CANDIDATE_VIEW + DOWNLOAD_DOCUMENTS holders are unchanged; admins unchanged.
      await expect(download(auth(ids.admin, ['ADMINISTRATOR']), ids.passport)).resolves.toBe(true);
      const recruiterPerms = (await prisma.rolePermission.findMany({ where: { role: { code: 'RECRUITER' } }, select: { permission: { select: { code: true } } } })).map((p) => p.permission.code);
      const recruiter = auth(ids.other, ['RECRUITER']);
      if (recruiterPerms.includes('CANDIDATE_VIEW') && recruiterPerms.includes('DOWNLOAD_DOCUMENTS')) {
        await expect(download(recruiter, ids.passport)).resolves.toBe(true);
      } else {
        await expect(download(recruiter, ids.passport)).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  });

  describe('#5 templates are admin-only to manage', () => {
    const manage = ['createTemplate', 'updateTemplate', 'duplicateTemplate', 'archiveTemplate'];
    const waManage = ['createTemplate', 'updateTemplate', 'duplicateTemplate', 'archiveTemplate'];

    it('non-admins get 403 on create/edit/duplicate/deactivate; admins pass', async () => {
      const recruiter = auth(ids.owner, ['RECRUITER']);
      const admin = auth(ids.admin, ['ADMINISTRATOR']);
      const p = { id: randomUUID() };
      for (const [cls, methods] of [[EmailTemplatesController, manage], [WhatsAppTemplatesController, waManage]] as const) {
        for (const m of methods) {
          await expect(call(recruiter, cls, m, p), `${cls.name}.${m}`).rejects.toBeInstanceOf(ForbiddenException);
          await expect(call(admin, cls, m, p), `${cls.name}.${m}`).resolves.toBe(true);
        }
      }
    });

    it('reading and using templates to send still work for non-admins', async () => {
      const recruiter = auth(ids.owner, ['RECRUITER']);
      const p = { id: randomUUID() };
      await expect(call(recruiter, EmailTemplatesController, 'listTemplates')).resolves.toBe(true);
      await expect(call(recruiter, EmailTemplatesController, 'getTemplate', p)).resolves.toBe(true);
      await expect(call(recruiter, WhatsAppTemplatesController, 'listTemplates')).resolves.toBe(true);
      await expect(call(recruiter, WhatsAppTemplatesController, 'getTemplate', p)).resolves.toBe(true);
      await expect(call(recruiter, WhatsAppTemplatesController, 'listForSend')).resolves.toBe(true);
      await expect(call(recruiter, WhatsAppTemplatesController, 'preview', p)).resolves.toBe(true);
    });
  });
});
