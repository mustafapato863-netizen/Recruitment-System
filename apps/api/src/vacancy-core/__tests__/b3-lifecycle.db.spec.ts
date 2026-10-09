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
