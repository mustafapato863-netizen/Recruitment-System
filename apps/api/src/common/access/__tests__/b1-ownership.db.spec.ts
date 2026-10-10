/**
 * B1 ownership and scope, against a real Postgres (migrated + seeded scratch DB).
 * Skipped unless B1_TEST_DATABASE_URL is set. NEVER point this at production:
 * it creates and then deletes fixture rows in the seed organization.
 *
 *   B1_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/recruitflow_b1 pnpm test:api
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../database/prisma.service';
import { AccessControlService } from '../../../access-control/access-control.service';
import { TenantScopedGuard } from '../../guards/tenant-scoped.guard';
import { ALLOW_INTERVIEW_ATTENDEE } from '../../decorators/tenant-resource.decorator';
import { VacancyCoreService } from '../../../vacancy-core/vacancy-core.service';
import { PrismaVacancyCoreRepository } from '../../../vacancy-core/prisma-vacancy-core.repository';
import { InterviewsService } from '../../../interviews/interviews.service';
import { ApplicationsService } from '../../../applications/applications.service';
import type { NotificationsService } from '../../../notifications/notifications.service';
import type { DocumentsService } from '../../../documents/documents.service';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B1 ownership and scope (scratch Postgres)', () => {
  let prisma: PrismaService;
  let access: AccessControlService;
  let vacancies: VacancyCoreService;
  let interviews: InterviewsService;
  let applications: ApplicationsService;
  const ids = {
    owner: randomUUID(), other: randomUUID(), manager: randomUUID(), interviewer: randomUUID(),
    inactive: randomUUID(), admin: randomUUID(), candidate: randomUUID(), application: randomUUID(),
    interview: randomUUID(), otherInterview: randomUUID(), cv: randomUUID(), otherDoc: randomUUID(),
    scorecardOther: randomUUID(),
  };
  let vacancyId = '';
  let otherVacancyId = '';
  const cvRequests: string[] = [];
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });

  function guardContext(user: AuthUser, params: Record<string, string>, handler: () => void): ExecutionContext {
    const req = { tenantId: ORG, user, params };
    return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler } as unknown as ExecutionContext;
  }
  function handler(resource: string, allowAttendee = false) {
    const fn = function route() {};
    Reflect.defineMetadata('TENANT_RESOURCE', { resource, param: 'id' }, fn);
    if (allowAttendee) Reflect.defineMetadata(ALLOW_INTERVIEW_ATTENDEE, true, fn);
    return fn;
  }
  const guard = () => new TenantScopedGuard(new Reflector(), prisma);

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    access = new AccessControlService(prisma);
    vacancies = new VacancyCoreService(new PrismaVacancyCoreRepository(prisma), prisma, {} as NotificationsService, access);
    const documents = { getFile: async (_org: string, id: string) => { cvRequests.push(id); return { path: '/dev/null', fileName: 'cv.pdf', mimeType: 'application/pdf' }; } };
    interviews = new InterviewsService(prisma, { createForUser: async () => undefined } as unknown as NotificationsService, access, documents as unknown as DocumentsService);
    applications = new ApplicationsService(prisma, {} as never, {} as never, access);

    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'INTERVIEWER', 'ADMINISTRATOR'] } } })).map((r) => [r.code, r.id]));
    const mkUser = (id: string, name: string, role: string, extra: Record<string, unknown> = {}) => prisma.user.create({
      data: { id, organizationId: ORG, email: `${name}-${tag}@b1.test`, emailNormalized: `${name}-${tag}@b1.test`, displayName: `B1 ${name}`, passwordHash: 'x', status: 'Active', ...extra, userRoles: { create: { roleId: roles[role]! } } },
    });
    await mkUser(ids.manager, 'manager', 'RECRUITER');
    await mkUser(ids.owner, 'owner', 'RECRUITER', { managerId: ids.manager });
    await mkUser(ids.other, 'other', 'RECRUITER');
    await mkUser(ids.interviewer, 'interviewer', 'INTERVIEWER');
    await mkUser(ids.inactive, 'inactive', 'RECRUITER', { status: 'Inactive' });
    await mkUser(ids.admin, 'admin', 'ADMINISTRATOR');

    const [v, w] = await prisma.vacancy.findMany({ where: { organizationId: ORG, primaryRecruiterId: null, assignments: { none: {} } }, orderBy: { vacancyCode: 'asc' }, take: 2 });
    vacancyId = v!.id; otherVacancyId = w!.id;
    await vacancies.assignTeamMember(vacancyId, ORG, { userId: ids.owner, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' });
    await vacancies.assignTeamMember(otherVacancyId, ORG, { userId: ids.other, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' });

    await prisma.candidate.create({ data: { id: ids.candidate, organizationId: ORG, candidateCode: `B1-${tag}`, firstName: 'B1', lastName: 'Candidate', email: `cand-${tag}@b1.test` } });
    await prisma.application.create({ data: { id: ids.application, organizationId: ORG, applicationCode: `B1-${tag}`, vacancyId, candidateId: ids.candidate, stage: 'Interview', primaryRecruiterId: ids.owner } });
    const start = new Date(Date.now() + 86_400_000);
    for (const [id, attendee] of [[ids.interview, ids.interviewer], [ids.otherInterview, ids.other]] as const) {
      await prisma.interview.create({ data: { id, organizationId: ORG, applicationId: ids.application, interviewCode: `B1-${id.slice(0, 8)}`, title: 'B1', interviewType: 'Technical', scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3_600_000), attendees: { create: { userId: attendee } } } });
    }
    await prisma.interviewScorecard.create({ data: { id: ids.scorecardOther, interviewId: ids.interview, interviewerId: ids.owner, overallRating: 4, recommendation: 'Hire', notes: 'owner notes', status: 'Submitted', submittedAt: new Date() } });
    await prisma.candidateDocument.create({ data: { id: ids.otherDoc, organizationId: ORG, candidateId: ids.candidate, documentType: 'Passport', fileName: 'p.pdf', mimeType: 'application/pdf', fileSize: 1, storageKey: `b1/${tag}/p`, storageProvider: 'local' } });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.candidateDocument.create({ data: { id: ids.cv, organizationId: ORG, candidateId: ids.candidate, documentType: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', fileSize: 1, storageKey: `b1/${tag}/cv`, storageProvider: 'local' } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.candidateDocument.deleteMany({ where: { candidateId: ids.candidate } });
    await prisma.interviewScorecard.deleteMany({ where: { interviewId: { in: [ids.interview, ids.otherInterview] } } });
    await prisma.interviewAttendee.deleteMany({ where: { interviewId: { in: [ids.interview, ids.otherInterview] } } });
    await prisma.interview.deleteMany({ where: { id: { in: [ids.interview, ids.otherInterview] } } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: ids.application } });
    await prisma.application.deleteMany({ where: { id: ids.application } });
    await prisma.candidate.deleteMany({ where: { id: ids.candidate } });
    const touched = [vacancyId, otherVacancyId].filter(Boolean);
    await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: { in: touched } } });
    await prisma.vacancy.updateMany({ where: { id: { in: touched } }, data: { primaryRecruiterId: null } });
    const users = [ids.owner, ids.other, ids.manager, ids.interviewer, ids.inactive, ids.admin];
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users } } }).catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.updateMany({ where: { id: { in: users } }, data: { managerId: null } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it('stores the single owner on the vacancy when a PRIMARY is assigned', async () => {
    const v = await prisma.vacancy.findUniqueOrThrow({ where: { id: vacancyId } });
    expect(v.primaryRecruiterId).toBe(ids.owner);
  });

  it('rejects admin and inactive users as owner (assign, create, update)', async () => {
    await expect(vacancies.assignTeamMember(vacancyId, ORG, { userId: ids.admin, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(vacancies.assignTeamMember(vacancyId, ORG, { userId: ids.inactive, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' })).rejects.toThrow();
    await expect(applications.updateApplication(ORG, ids.application, ids.owner, { primaryRecruiterId: ids.admin }, auth(ids.owner, ['RECRUITER']))).rejects.toBeInstanceOf(BadRequestException);
    await expect(applications.updateApplication(ORG, ids.application, ids.owner, { taskOwnerId: ids.inactive }, auth(ids.owner, ['RECRUITER']))).rejects.toBeInstanceOf(BadRequestException);
    expect((await prisma.vacancy.findUniqueOrThrow({ where: { id: vacancyId } })).primaryRecruiterId).toBe(ids.owner);
  });

  it('inactive job owner gets OWNER_NOT_ELIGIBLE, not "not in this organization" (QA BUG-2)', async () => {
    const err = await vacancies.assignTeamMember(vacancyId, ORG, { userId: ids.inactive, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'OWNER_NOT_ELIGIBLE', message: 'An inactive user cannot own a job or file.' });
  });

  it('does not let an administrator reassign a job or file owner', async () => {
    await expect(vacancies.assignTeamMember(vacancyId, ORG, { userId: ids.other, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' }, auth(ids.admin, ['ADMINISTRATOR']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(applications.updateApplication(ORG, ids.application, ids.admin, { primaryRecruiterId: ids.other }, auth(ids.admin, ['ADMINISTRATOR']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns 403 on another owner's file (reads and writes) and allows owner, manager and admin", async () => {
    const app = handler('application');
    await expect(guard().canActivate(guardContext(auth(ids.other, ['RECRUITER']), { id: ids.application }, app))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard().canActivate(guardContext(auth(ids.owner, ['RECRUITER']), { id: ids.application }, app))).resolves.toBe(true);
    await expect(guard().canActivate(guardContext(auth(ids.manager, ['RECRUITER']), { id: ids.application }, app))).resolves.toBe(true);
    await expect(guard().canActivate(guardContext(auth(ids.admin, ['ADMINISTRATOR']), { id: ids.application }, app))).resolves.toBe(true);
    // body-addressed write path
    await expect(access.assertApplicationAccess(auth(ids.other, ['RECRUITER']), ids.application)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access.assertApplicationAccess(auth(ids.other, ['RECRUITER']), randomUUID())).rejects.toBeInstanceOf(NotFoundException);
    // lists drop the file
    const list = await applications.listApplications(ORG, { pageSize: 500 } as never, auth(ids.other, ['RECRUITER']));
    expect(list.data.map((a: { id: string }) => a.id)).not.toContain(ids.application);
    const own = await applications.listApplications(ORG, { pageSize: 500 } as never, auth(ids.owner, ['RECRUITER']));
    expect(own.data.map((a: { id: string }) => a.id)).toContain(ids.application);
  });

  it("redacts another owner's job in list, work queue and detail to title, site and seats", async () => {
    const other = auth(ids.other, ['RECRUITER']);
    const list = await vacancies.listVacancies(ORG, other);
    const item = list.find((v) => v.id === vacancyId)!;
    expect(Object.keys(item).sort()).toEqual(['id', 'redacted', 'seats', 'site', 'title']);
    expect(item).toMatchObject({ redacted: true, seats: { filled: expect.any(Number), target: expect.any(Number) }, site: { id: expect.any(String), name: expect.any(String) } });
    expect(list.find((v) => v.id === otherVacancyId)).toHaveProperty('vacancyCode');

    const queue = await vacancies.getWorkQueue(ORG, { pageSize: 200 } as never, other);
    expect(Object.keys(queue.data.find((v) => v.id === vacancyId)!).sort()).toEqual(['id', 'redacted', 'seats', 'site', 'title']);

    const detail = await vacancies.getVacancyDetail(ORG, vacancyId, other);
    expect(Object.keys(detail!).sort()).toEqual(['id', 'redacted', 'seats', 'site', 'title']);
    const full = await vacancies.getVacancyDetail(ORG, vacancyId, auth(ids.owner, ['RECRUITER']));
    expect(full).toHaveProperty('vacancyCode');
    const managerView = await vacancies.getVacancyDetail(ORG, vacancyId, auth(ids.manager, ['RECRUITER']));
    expect(managerView).toHaveProperty('vacancyCode');
  });

  it('interviewer: CV and own scorecard only; 403 for the rest of the file and other interviews', async () => {
    const iv = auth(ids.interviewer, ['INTERVIEWER']);
    const g = guard();
    await expect(g.canActivate(guardContext(iv, { id: ids.interview }, handler('interview', true)))).resolves.toBe(true);
    await expect(g.canActivate(guardContext(iv, { id: ids.interview }, handler('interview')))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(g.canActivate(guardContext(iv, { id: ids.otherInterview }, handler('interview', true)))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(g.canActivate(guardContext(iv, { id: ids.application }, handler('application')))).rejects.toBeInstanceOf(ForbiddenException);

    await interviews.getCandidateCvFile(ORG, ids.interview);
    expect(cvRequests).toEqual([ids.cv]);

    const before = await interviews.getScorecards(ORG, ids.interview, iv);
    expect(before).toEqual([]);
    await interviews.submitScorecard(ORG, ids.interview, ids.interviewer, { overallRating: 5, recommendation: 'Strong Hire', notes: 'great' } as never, iv);
    const mine = await interviews.getScorecards(ORG, ids.interview, iv);
    expect(mine.map((s) => s.interviewerId)).toEqual([ids.interviewer]);
    const ownerView = await interviews.getScorecards(ORG, ids.interview, auth(ids.owner, ['RECRUITER']));
    expect(ownerView.map((s) => s.interviewerId).sort()).toEqual([ids.interviewer, ids.owner].sort());

    // Other documents: the INTERVIEWER role holds neither CANDIDATE_VIEW nor DOWNLOAD_DOCUMENTS,
    // which /documents/:id/download requires, so PermissionsGuard returns 403 there.
    const perms = await prisma.rolePermission.findMany({ where: { role: { code: 'INTERVIEWER' } }, select: { permission: { select: { code: true } } } });
    const codes = perms.map((p) => p.permission.code);
    expect(codes).not.toContain('CANDIDATE_VIEW');
    expect(codes).not.toContain('DOWNLOAD_DOCUMENTS');
  });

  it('backfill: every owner is an active non-admin with a single active PRIMARY; every NULL is explained', async () => {
    const requireCjs = createRequire(import.meta.url);
    const { classify } = requireCjs(path.resolve(__dirname, '../../../../../../scripts/b1-backfill-report.cjs')) as { classify: (v: unknown) => { outcome: string; reason: string } };
    const rows = await prisma.vacancy.findMany({
      where: { organizationId: ORG, id: { notIn: [vacancyId, otherVacancyId] } },
      select: {
        id: true, organizationId: true, primaryRecruiterId: true,
        assignments: { select: { isActive: true, assignmentKind: true, user: { select: { id: true, displayName: true, email: true, status: true, organizationId: true, userRoles: { select: { role: { select: { code: true } } } } } } } },
      },
    });
    for (const row of rows) {
      const result = classify(row);
      if (row.primaryRecruiterId) {
        const primaries = row.assignments.filter((a) => a.isActive && a.assignmentKind === 'PRIMARY');
        expect(new Set(primaries.map((a) => a.user.id))).toEqual(new Set([row.primaryRecruiterId]));
        expect(primaries[0]!.user.status).toBe('Active');
        expect(primaries[0]!.user.userRoles.map((r) => r.role.code)).not.toContain('ADMINISTRATOR');
      } else {
        expect(result.outcome).toBe('NULL');
        expect(result.reason).not.toBe('NOT_BACKFILLED_UNKNOWN');
      }
    }
  });
});
