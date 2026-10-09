/**
 * B3 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B3_TEST_DATABASE_URL is set. NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { VacancyCoreService } from '../vacancy-core.service';
import { PrismaVacancyCoreRepository } from '../prisma-vacancy-core.repository';
import { ApplicationsService } from '../../applications/applications.service';
import { PublicJobsService } from '../../public-jobs/public-jobs.service';

const url = process.env.B3_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B3 requisition and job lifecycle (scratch Postgres)', () => {
  let prisma: PrismaService;
  let service: VacancyCoreService;
  let applications: ApplicationsService;
  const ids: Record<string, string> = {};
  const as = (userId: string) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] });

  async function makeRequest(status = 'Approved', extra: Record<string, unknown> = {}) {
    const branch = await prisma.branch.findFirstOrThrow({ where: { organizationId: ORG } });
    const position = await prisma.position.findFirstOrThrow({ where: { organizationId: ORG } });
    const id = randomUUID();
    await prisma.vacancyRequest.create({ data: {
      id, organizationId: ORG, branchId: branch.id, positionId: position.id, requesterId: ids.manager,
      requestCode: `B3-${tag}-${id.slice(0, 4)}`, status, requestedHeadcount: 2, targetFillDate: new Date('2026-10-19'),
      jobSummary: 'HRIS developer', ...extra,
    } });
    return id;
  }
  async function makeCandidate() {
    const id = randomUUID();
    await prisma.candidate.create({ data: { id, organizationId: ORG, candidateCode: `B3-${tag}-${id.slice(0, 4)}`, firstName: 'B3', lastName: 'Candidate', email: `${id}@b3.test` } });
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    const repo = new PrismaVacancyCoreRepository(prisma);
    service = new VacancyCoreService(repo, prisma, { create: async () => undefined } as never);
    applications = new ApplicationsService(prisma, {} as never, {} as never, {} as never);
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    const adminRole = await prisma.role.findFirstOrThrow({ where: { code: 'ADMINISTRATOR' } });
    for (const [key, extra] of [['manager', {}], ['owner', {}], ['other', {}], ['inactive', { status: 'Inactive' }], ['admin', {}]] as const) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: {
        id: ids[key], organizationId: ORG, email: `${key}-${tag}@b3.test`, emailNormalized: `${key}-${tag}@b3.test`, displayName: `B3 ${key}`, passwordHash: 'x', ...extra,
        userRoles: { create: { roleId: key === 'admin' ? adminRole.id : recruiter.id } },
      } });
    }
    await prisma.user.update({ where: { id: ids.owner }, data: { managerId: ids.manager } });
    ids.grade = (await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'grades', code: `G-${tag}`, name: `Grade ${tag}` } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('requisition takes grade (master data) and an active, non-admin assigned employee', async () => {
    const id = await makeRequest('Draft');
    await expect(service.updateRequest(id, ORG, { gradeId: ids.admin })).rejects.toThrow(BadRequestException);
    await expect(service.updateRequest(id, ORG, { assignedEmployeeId: ids.admin })).rejects.toThrow(/administrator/);
    await expect(service.updateRequest(id, ORG, { assignedEmployeeId: ids.inactive })).rejects.toThrow(/active/);
    const saved = await service.updateRequest(id, ORG, { gradeId: ids.grade, assignedEmployeeId: ids.owner, dueDate: '2026-10-19' });
    expect(saved).toMatchObject({ gradeId: ids.grade, assignedEmployeeId: ids.owner, dueDate: '2026-10-19' });
  });

  it('activating an approved requisition creates its Open job, assigns the employee, writes history; idempotent', async () => {
    const id = await makeRequest('Approved', { assignedEmployeeId: ids.owner });
    const result = await service.activateRequest(id, ORG, ids.manager, {});
    expect(result.vacancy?.status).toBe('Open');
    expect(result.request.status).toBe('Converted to Vacancy');
    expect(result.request.activatedAt).toBeTruthy();
    const job = result.vacancy!;
    ids.job = job.id;
    expect(await prisma.vacancyAssignment.count({ where: { vacancyId: job.id, userId: ids.owner, assignmentKind: 'PRIMARY', isActive: true } })).toBe(1);
    expect(await prisma.vacancyStatusHistory.findMany({ where: { vacancyId: job.id } })).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'Open', reason: 'Requisition activated' })]);
    const again = await service.activateRequest(id, ORG, ids.manager, {});
    expect(again.idempotent).toBe(true);
    ids.jobRequest = id;
  });

  it('activation needs a due date and an eligible assignee', async () => {
    const noDate = await makeRequest('Approved', { targetFillDate: null, assignedEmployeeId: ids.owner });
    await expect(service.activateRequest(noDate, ORG, ids.manager, {})).rejects.toThrow(/due date/);
    const noOwner = await makeRequest('Approved');
    await expect(service.activateRequest(noOwner, ORG, ids.manager, {})).rejects.toThrow(/assigned employee/);
    await expect(service.activateRequest(noOwner, ORG, ids.manager, { assignedEmployeeId: ids.admin })).rejects.toThrow(/administrator/);
  });

  it('a Cancelled requisition cannot activate (409)', async () => {
    const id = await makeRequest('Cancelled', { assignedEmployeeId: ids.owner });
    await expect(service.activateRequest(id, ORG, ids.manager, {})).rejects.toThrow(ConflictException);
  });

  it('an administrator can never hold, reopen or close a job (even as requester)', async () => {
    const id = await makeRequest('Approved', { assignedEmployeeId: ids.owner, requesterId: ids.admin });
    const job = (await service.activateRequest(id, ORG, ids.manager, {})).vacancy!;
    const admin = { userId: ids.admin!, organizationId: ORG, tokenVersion: 0, roleCodes: ['ADMINISTRATOR'] };
    await expect(service.holdVacancy(job.id, ORG, 'admin hold', admin)).rejects.toThrow(/administrator cannot/);
    await expect(service.closeVacancy(job.id, ORG, 'admin close', admin)).rejects.toThrow(ForbiddenException);
    await service.holdVacancy(job.id, ORG, 'owner hold', as(ids.owner!));
    await expect(service.reopenVacancy(job.id, ORG, 'admin reopen', admin)).rejects.toThrow(/administrator cannot/);
    expect((await prisma.vacancy.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('On Hold');
  });

  it('requisition label: stored Converted to Vacancy is shown as Active', async () => {
    const id = await makeRequest('Approved', { assignedEmployeeId: ids.owner });
    const result = await service.activateRequest(id, ORG, ids.manager, {});
    expect(result.request.status).toBe('Converted to Vacancy');
    expect(result.request.statusLabel).toBe('Active');
  });

  it('a requisition cannot leave Draft without a due date (400 DUE_DATE_REQUIRED)', async () => {
    const id = await makeRequest('Draft', { targetFillDate: null, recruitmentTiming: 'After Approval', budgetMin: 1000, budgetMax: 2000, budgetCurrency: 'AED' });
    await expect(service.submitRequest(id, ORG, ids.manager!)).rejects.toMatchObject({ response: { code: 'DUE_DATE_REQUIRED' } });
    expect((await prisma.vacancyRequest.findUniqueOrThrow({ where: { id } })).status).toBe('Draft');
    await service.updateRequest(id, ORG, { dueDate: '2026-10-19' });
    expect((await service.submitRequest(id, ORG, ids.manager!)).status).toBe('Pending Approval');
  });

  it('public apply accepts Open and Partially Filled jobs, not held ones', async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ORG } });
    const pub = new PublicJobsService(prisma, { enforcePublicRequestLimit: async () => undefined } as never, {} as never, {} as never);
    const id = await makeRequest('Approved', { assignedEmployeeId: ids.owner });
    const job = (await service.activateRequest(id, ORG, ids.manager, {})).vacancy!;
    await prisma.vacancy.update({ where: { id: job.id }, data: { status: 'Partially Filled', joinedHeadcount: 1, openedAt: new Date(Date.now() - 60_000) } });
    expect((await pub.getJob(org.code, job.vacancyCode)).vacancyCode).toBe(job.vacancyCode);
    const listed = await pub.listJobs(org.code, { pageSize: 100 } as never);
    expect(listed.data.some((j) => j.vacancyCode === job.vacancyCode)).toBe(true);
    const applied = await pub.apply(org.code, job.vacancyCode, { firstName: 'Pub', lastName: 'Applicant', email: `pub-${tag}@b3.test`, consentAccepted: true } as never, '127.0.0.1');
    expect(applied).toBeTruthy();
    expect(await prisma.application.count({ where: { vacancyId: job.id } })).toBe(1);
    await prisma.vacancy.update({ where: { id: job.id }, data: { status: 'On Hold' } });
    await expect(pub.getJob(org.code, job.vacancyCode)).rejects.toThrow();
    await expect(pub.apply(org.code, job.vacancyCode, { firstName: 'Pub', lastName: 'Two', email: `pub2-${tag}@b3.test`, consentAccepted: true } as never, '127.0.0.1')).rejects.toThrow();
  });

  it('hold/reopen: owner or manager only, reason required, history written, held job blocks new applications', async () => {
    await expect(service.holdVacancy(ids.job!, ORG, 'budget freeze', as(ids.other!))).rejects.toThrow(ForbiddenException);
    await expect(service.holdVacancy(ids.job!, ORG, ' ', as(ids.owner!))).rejects.toThrow(BadRequestException);
    expect((await service.holdVacancy(ids.job!, ORG, 'budget freeze', as(ids.owner!))).status).toBe('On Hold');
    await expect(service.holdVacancy(ids.job!, ORG, 'again', as(ids.owner!))).rejects.toThrow(ConflictException);

    const candidate = await makeCandidate();
    await expect(applications.createApplication(ORG, { vacancyId: ids.job!, candidateId: candidate } as never)).rejects.toThrow(/accepts no new applications/);

    expect((await service.reopenVacancy(ids.job!, ORG, 'budget back', as(ids.manager!))).status).toBe('Open');
    const history = await prisma.vacancyStatusHistory.findMany({ where: { vacancyId: ids.job }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => [h.fromStatus, h.toStatus, h.reason, h.changedById])).toEqual([
      [null, 'Open', 'Requisition activated', ids.manager],
      ['Open', 'On Hold', 'budget freeze', ids.owner],
      ['On Hold', 'Open', 'budget back', ids.manager],
    ]);
    const app = await applications.createApplication(ORG, { vacancyId: ids.job!, candidateId: candidate } as never);
    expect(app.stage).toBe('Applied');
    ids.liveApp = app.id;
  });

  it('cancel after approval needs a reason; with a live job it closes the job and rejects live files in one go; idempotent', async () => {
    const joined = await makeCandidate();
    const joinedApp = randomUUID();
    await prisma.application.create({ data: { id: joinedApp, organizationId: ORG, applicationCode: `B3J-${tag}`, vacancyId: ids.job!, candidateId: joined, stage: 'Joined' } });
    const screening = await makeCandidate();
    const screeningApp = randomUUID();
    await prisma.application.create({ data: { id: screeningApp, organizationId: ORG, applicationCode: `B3S-${tag}`, vacancyId: ids.job!, candidateId: screening, stage: 'Screening' } });

    await expect(service.cancelRequest(ids.jobRequest!, ORG, ids.manager!, '')).rejects.toThrow(BadRequestException);
    const result = await service.cancelRequest(ids.jobRequest!, ORG, ids.manager!, 'Budget withdrawn');
    expect(result).toMatchObject({ idempotent: false, closedJob: true, rejectedApplications: 2 });
    expect(result.request).toMatchObject({ status: 'Cancelled', cancelReason: 'Budget withdrawn' });
    expect((await prisma.vacancy.findUniqueOrThrow({ where: { id: ids.job } })).status).toBe('Closed');
    for (const id of [ids.liveApp!, screeningApp]) {
      expect((await prisma.application.findUniqueOrThrow({ where: { id } })).stage).toBe('Rejected');
      expect(await prisma.applicationStatusHistory.findFirst({ where: { applicationId: id, toStage: 'Rejected', reason: 'Requisition cancelled' } })).toBeTruthy();
    }
    expect((await prisma.application.findUniqueOrThrow({ where: { id: joinedApp } })).stage).toBe('Joined');
    expect(await prisma.vacancyStatusHistory.findFirst({ where: { vacancyId: ids.job, toStatus: 'Closed' } })).toMatchObject({ reason: 'Requisition cancelled: Budget withdrawn' });

    const again = await service.cancelRequest(ids.jobRequest!, ORG, ids.manager!, 'again');
    expect(again.idempotent).toBe(true);
    expect(await prisma.vacancyStatusHistory.count({ where: { vacancyId: ids.job, toStatus: 'Closed' } })).toBe(1);
    await expect(service.reopenVacancy(ids.job!, ORG, 'try', as(ids.owner!))).rejects.toThrow(ConflictException);
    await expect(service.activateRequest(ids.jobRequest!, ORG, ids.manager, {})).rejects.toThrow(ConflictException);
  });

  it('draft requisitions cancel without a reason', async () => {
    const id = await makeRequest('Draft');
    expect((await service.cancelRequest(id, ORG, ids.manager!)).request.status).toBe('Cancelled');
  });

  it('the B3 data mapping left no Cancelled or Pending Activation jobs', async () => {
    expect(await prisma.vacancy.count({ where: { status: { in: ['Cancelled', 'Pending Activation'] } } })).toBe(0);
  });
});
