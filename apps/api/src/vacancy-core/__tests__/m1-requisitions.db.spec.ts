/** M1 (Frontend): activate from Draft, department, scoped GET with names, PATCH target. Scratch Postgres only. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { VacancyCoreService } from '../vacancy-core.service';
import { PrismaVacancyCoreRepository } from '../prisma-vacancy-core.repository';
import { MasterDataService } from '../../master-data/master-data.service';
import { REASON_CATEGORIES, resolveListReason } from '../../master-data/reason-lists';

const url = process.env.B3_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('M1 requisitions (scratch Postgres)', () => {
  let prisma: PrismaService;
  let service: VacancyCoreService;
  const ids: Record<string, string> = {};
  const as = (userId: string, admin = false) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes: [admin ? 'ADMINISTRATOR' : 'HIRING_MANAGER'] });

  async function makeRequest(requester: string, status = 'Draft', extra: Record<string, unknown> = {}) {
    const branch = await prisma.branch.findFirstOrThrow({ where: { organizationId: ORG } });
    const position = await prisma.position.findFirstOrThrow({ where: { organizationId: ORG } });
    const id = randomUUID();
    await prisma.vacancyRequest.create({ data: {
      id, organizationId: ORG, branchId: branch.id, positionId: position.id, requesterId: requester,
      requestCode: `M1-${tag}-${id.slice(0, 4)}`, status, requestedHeadcount: 2, ...extra,
    } });
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    service = new VacancyCoreService(new PrismaVacancyCoreRepository(prisma), prisma, { create: async () => undefined } as never);
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    for (const key of ['boss', 'mgr', 'report', 'stranger', 'emp']) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: { id: ids[key], organizationId: ORG, email: `${key}-${tag}@m1.test`, emailNormalized: `${key}-${tag}@m1.test`, displayName: `M1 ${key}`, passwordHash: 'x', userRoles: { create: { roleId: recruiter.id } } } });
    }
    await prisma.user.update({ where: { id: ids.mgr }, data: { managerId: ids.boss } });
    await prisma.user.update({ where: { id: ids.report }, data: { managerId: ids.mgr } });
    ids.dept = (await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'departments', code: `D-${tag}`, name: `Nursing ${tag}` } })).id;
    ids.grade = (await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'grades', code: `G-${tag}`, name: `Grade ${tag}` } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('department comes from master data (departments) and is stored', async () => {
    const id = await makeRequest(ids.mgr);
    await expect(service.updateRequest(id, ORG, { departmentId: ids.grade })).rejects.toMatchObject({ response: { code: 'DEPARTMENT_NOT_FOUND' } });
    expect(await service.updateRequest(id, ORG, { departmentId: ids.dept })).toMatchObject({ departmentId: ids.dept });
  });

  it('Manager activates own Draft with a due date and eligible assignee; no sign-off', async () => {
    const noDue = await makeRequest(ids.mgr, 'Draft', { assignedEmployeeId: ids.emp });
    await expect(service.activateRequest(noDue, ORG, ids.mgr, {})).rejects.toMatchObject({ response: { code: 'DUE_DATE_REQUIRED' } });
    const id = await makeRequest(ids.mgr, 'Draft', { targetFillDate: new Date('2026-11-30') });
    await expect(service.activateRequest(id, ORG, ids.mgr, {})).rejects.toMatchObject({ response: { code: 'ASSIGNEE_REQUIRED' } });
    await expect(service.activateRequest(id, ORG, ids.stranger, { assignedEmployeeId: ids.emp })).rejects.toMatchObject({ status: 403 });
    await expect(service.activateRequest(id, ORG, ids.report, { assignedEmployeeId: ids.emp })).rejects.toMatchObject({ status: 403 });
    const res = await service.activateRequest(id, ORG, ids.mgr, { assignedEmployeeId: ids.emp });
    expect(res).toMatchObject({ request: { status: 'Converted to Vacancy' }, vacancy: { status: 'Open' } });
    // the requester's manager may activate too
    const byBoss = await makeRequest(ids.mgr, 'Draft', { targetFillDate: new Date('2026-11-30'), assignedEmployeeId: ids.emp });
    expect((await service.activateRequest(byBoss, ORG, ids.boss, {})).request.status).toBe('Converted to Vacancy');
    // the approval path still works, other statuses do not
    const approved = await makeRequest(ids.stranger, 'Approved', { targetFillDate: new Date('2026-11-30'), assignedEmployeeId: ids.emp });
    expect((await service.activateRequest(approved, ORG, ids.boss, {})).request.status).toBe('Converted to Vacancy');
    const pending = await makeRequest(ids.mgr, 'Pending Approval', { targetFillDate: new Date('2026-11-30'), assignedEmployeeId: ids.emp });
    await expect(service.activateRequest(pending, ORG, ids.mgr, {})).rejects.toMatchObject({ status: 409, response: { code: 'REQUISITION_NOT_APPROVED' } });
    const changes = await makeRequest(ids.mgr, 'Changes Requested', { targetFillDate: new Date('2026-11-30'), assignedEmployeeId: ids.emp });
    await expect(service.activateRequest(changes, ORG, ids.mgr, {})).rejects.toMatchObject({ status: 409, response: { code: 'REQUISITION_NOT_APPROVED' } });
    await prisma.vacancyRequest.update({ where: { id: changes }, data: { status: 'Approved' } }); // resubmitted + approved
    expect((await service.activateRequest(changes, ORG, ids.mgr, {})).request.status).toBe('Converted to Vacancy');
  });

  it('GET is scoped (own + direct reports; admin all) and carries names', async () => {
    const own = await makeRequest(ids.mgr, 'Draft', { departmentId: ids.dept, gradeId: ids.grade, assignedEmployeeId: ids.emp });
    const reports = await makeRequest(ids.report);
    const foreign = await makeRequest(ids.stranger);
    const mine = await service.listRequests(ORG, as(ids.mgr) as never);
    const got = new Set(mine.map((r) => r.id));
    expect(got.has(own) && got.has(reports)).toBe(true);
    expect(got.has(foreign)).toBe(false);
    expect(mine.find((r) => r.id === own)).toMatchObject({
      title: expect.any(String), site: { name: expect.any(String) }, grade: { id: ids.grade, name: `Grade ${tag}` },
      department: { id: ids.dept, name: `Nursing ${tag}` }, requesterName: 'M1 mgr', requester: { id: ids.mgr, name: 'M1 mgr' }, owner: { id: ids.emp, name: 'M1 emp' }, ownerName: 'M1 emp',
    });
    expect((await service.listRequests(ORG, as(ids.report) as never)).some((r) => r.id === own)).toBe(false);
    const all = (await service.listRequests(ORG, as(ids.stranger, true) as never)).map((r) => r.id);
    expect(all).toEqual(expect.arrayContaining([own, reports, foreign]));
  });

  it('recruiters and HR: requested or assigned to, plus direct reports\' (same rule as managers); admin all', async () => {
    const assignedToEmp = await makeRequest(ids.stranger, 'Draft', { assignedEmployeeId: ids.emp });
    const assignedToReport = await makeRequest(ids.stranger, 'Draft', { assignedEmployeeId: ids.report });
    const requestedByEmp = await makeRequest(ids.emp);
    const unrelated = await makeRequest(ids.stranger);
    await prisma.user.update({ where: { id: ids.emp }, data: { managerId: ids.boss } });
    for (const roleCodes of [['RECRUITER'], ['HR']]) {
      const emp = new Set((await service.listRequests(ORG, { ...as(ids.emp), roleCodes } as never)).map((r) => r.id));
      expect(emp.has(assignedToEmp) && emp.has(requestedByEmp)).toBe(true);
      expect(emp.has(unrelated) || emp.has(assignedToReport)).toBe(false);
    }
    const mgr = new Set((await service.listRequests(ORG, { ...as(ids.mgr), roleCodes: ['RECRUITER'] } as never)).map((r) => r.id));
    expect(mgr.has(assignedToReport)).toBe(true); // assigned to a direct report
    expect(mgr.has(unrelated)).toBe(false);
    const boss = new Set((await service.listRequests(ORG, { ...as(ids.boss), roleCodes: ['HR'] } as never)).map((r) => r.id));
    expect(boss.has(assignedToEmp) && boss.has(requestedByEmp)).toBe(true); // emp now reports to boss
    const all = (await service.listRequests(ORG, as(ids.emp, true) as never)).map((r) => r.id);
    expect(all).toEqual(expect.arrayContaining([assignedToEmp, assignedToReport, requestedByEmp, unrelated]));
  });

  it('PATCH target after activation: Manager only, reason required, history, never below joined', async () => {
    const id = await makeRequest(ids.mgr, 'Draft', { targetFillDate: new Date('2026-11-30'), assignedEmployeeId: ids.emp });
    await expect(service.updateRequisitionTarget(id, ORG, ids.mgr, { seats: 3, reason: 'more' })).rejects.toMatchObject({ response: { code: 'REQUISITION_NOT_ACTIVE' } });
    const { vacancy } = await service.activateRequest(id, ORG, ids.mgr, {});
    await expect(service.updateRequisitionTarget(id, ORG, ids.mgr, { seats: 3, reason: ' ' })).rejects.toMatchObject({ status: 400 });
    await expect(service.updateRequisitionTarget(id, ORG, ids.stranger, { seats: 3, reason: 'x' })).rejects.toMatchObject({ status: 403 });
    await prisma.vacancy.update({ where: { id: vacancy!.id }, data: { joinedHeadcount: 2 } });
    await expect(service.updateRequisitionTarget(id, ORG, ids.mgr, { seats: 1, reason: 'cut' })).rejects.toMatchObject({ status: 409, response: { code: 'SEATS_BELOW_JOINED' } });
    const res = await service.updateRequisitionTarget(id, ORG, ids.boss, { seats: 4, dueDate: '2026-12-31', reason: 'Ward expansion' });
    expect(res.request).toMatchObject({ requestedHeadcount: 4, dueDate: '2026-12-31' });
    expect((await prisma.vacancy.findUniqueOrThrow({ where: { id: vacancy!.id } })).approvedHeadcount).toBe(4);
    const h = await prisma.vacancyStatusHistory.findMany({ where: { vacancyId: vacancy!.id }, orderBy: { createdAt: 'asc' } });
    expect(h.at(-1)?.reason).toBe('Target changed: seats 2 -> 4; due date 2026-11-30 -> 2026-12-31. Reason: Ward expansion');
    expect(await prisma.auditLog.count({ where: { entityId: id, action: 'REQUISITION_TARGET_UPDATE' } })).toBe(1);
    expect((await service.updateRequisitionTarget(id, ORG, ids.mgr, { seats: 2, reason: 'back to plan' })).request.requestedHeadcount).toBe(2);
  });

  it('C2: INTERVIEW_PARTICIPATE and LICENSE_CHECK are named in the catalog; Administrator has them (wiring in B0b)', async () => {
    const perms = await prisma.permission.findMany({ where: { code: { in: ['INTERVIEW_PARTICIPATE', 'LICENSE_CHECK'] } }, select: { code: true, name: true } });
    expect(perms.map((p) => p.code).sort()).toEqual(['INTERVIEW_PARTICIPATE', 'LICENSE_CHECK']);
    expect(perms.every((p) => Boolean(p.name))).toBe(true);
    const admin = await prisma.rolePermission.count({ where: { role: { code: 'ADMINISTRATOR' }, permission: { code: { in: ['INTERVIEW_PARTICIPATE', 'LICENSE_CHECK'] } } } });
    expect(admin).toBe(2);
  });

  it('C3: hold/close/rejection/reassign reasons share one master-data base: seeded, listed, deactivate via PATCH {status}', async () => {
    const md = new MasterDataService(prisma);
    for (const category of REASON_CATEGORIES) {
      expect((await md.listCatalog(ORG, category)).length).toBeGreaterThan(3); // seeded
      const name = `Test ${category} ${tag}`;
      const v = await prisma.masterDataValue.create({ data: { organizationId: ORG, category, name, status: 'Active' } });
      expect(await resolveListReason(prisma, ORG, category, name)).toBe(name);
      expect(await md.setCatalogValueStatus(ORG, category, v.id, 'Inactive')).toMatchObject({ status: 'Inactive' });
      await expect(resolveListReason(prisma, ORG, category, name)).rejects.toMatchObject({ status: 400, response: { code: 'REASON_NOT_IN_LIST' } });
      await expect(md.deleteCatalogValue(ORG, category, v.id)).resolves.toMatchObject({ deactivated: true }); // DELETE never hard-deletes
      expect(await prisma.masterDataValue.count({ where: { id: v.id } })).toBe(1);
    }
    await expect(resolveListReason(prisma, ORG, 'reassign-reasons', 'Other')).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
    expect(await resolveListReason(prisma, ORG, 'reassign-reasons', 'Other', 'Team merge')).toBe('Other: Team merge');
    const any = await prisma.masterDataValue.findFirstOrThrow({ where: { organizationId: ORG, category: 'hold-reasons' } });
    await expect(md.setCatalogValueStatus(ORG, 'hold-reasons', any.id, 'Deleted')).rejects.toMatchObject({ status: 400 });
  });
});
