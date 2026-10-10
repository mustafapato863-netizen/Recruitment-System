/** B2R-1/2/3: managers see and act on their tree's jobs; everyone else JOB_NOT_OWNED; admin DELETE is an audited override. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../../access-control/access-control.service';
import { VacancyCoreService } from '../vacancy-core.service';
import { PrismaVacancyCoreRepository } from '../prisma-vacancy-core.repository';
import { VacanciesController } from '../vacancies.controller';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { privateVacancy } from '../../common/testing/private-vacancy';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B2R job scope and actions (scratch Postgres)', () => {
  let prisma: PrismaService; let svc: VacancyCoreService;
  const u = { skip: randomUUID(), hm: randomUUID(), rep: randomUUID(), otherHm: randomUUID(), emp: randomUUID(), admin: randomUUID() };
  const role: Record<string, string> = { skip: 'HIRING_MANAGER', hm: 'HIRING_MANAGER', rep: 'RECRUITER', otherHm: 'HIRING_MANAGER', emp: 'RECRUITER', admin: 'ADMINISTRATOR' };
  const as = (k: keyof typeof u): AuthUser => ({ userId: u[k], organizationId: ORG, tokenVersion: 0, roleCodes: [role[k]!] });
  const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: { response?: { code?: string }; status?: number }) => e.response?.code ?? String(e.status));
  const newJob = async () => {
    const id = await privateVacancy(prisma, ORG, 'B2R');
    await prisma.$transaction([
      prisma.vacancy.update({ where: { id }, data: { status: 'Open', primaryRecruiterId: u.rep } as never }),
      prisma.vacancyAssignment.create({ data: { vacancyId: id, userId: u.rep, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } }),
    ]);
    return id;
  };

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    svc = new VacancyCoreService(new PrismaVacancyCoreRepository(prisma), prisma, { create: async () => undefined } as never, new AccessControlService(prisma));
    const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
    const mgr: Record<string, string | undefined> = { hm: u.skip, rep: u.hm };
    for (const k of Object.keys(u) as (keyof typeof u)[]) {
      await prisma.user.create({ data: { id: u[k], organizationId: ORG, email: `${k}-${tag}@b2r.test`, emailNormalized: `${k}-${tag}@b2r.test`, displayName: `B2R ${k}`, passwordHash: 'x', userRoles: { create: { roleId: roles[role[k]!]! } } } });
    }
    for (const [k, m] of Object.entries(mgr)) await prisma.user.update({ where: { id: u[k as keyof typeof u] }, data: { managerId: m } });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('B2R-1: the manager and skip-level manager see the report\'s job in lookups and lists; another HM does not', async () => {
    const job = await newJob();
    for (const k of ['hm', 'skip'] as const) {
      expect((await svc.getVacancy(ORG, job, as(k))).id).toBe(job);
      const q = await svc.getWorkQueue(ORG, { pageSize: 100, search: 'B2R' } as never, as(k));
      expect(q.data.some((j) => j.id === job)).toBe(true);
    }
    expect(await code(svc.getVacancy(ORG, job, as('otherHm')))).toBe('404');
  });

  it('B2R-1/3: owner\'s manager holds/reopens/closes; others JOB_NOT_OWNED; admin ADMIN_CANNOT_CHANGE_JOB_STATUS', async () => {
    const job = await newJob();
    expect((await svc.holdVacancy(job, ORG, 'Hiring freeze', as('hm'))).status).toBe('On Hold');
    expect((await svc.reopenVacancy(job, ORG, 'budget back', as('skip'))).status).toBe('Open');
    expect(await code(svc.holdVacancy(job, ORG, 'Hiring freeze', as('otherHm')))).toBe('JOB_NOT_OWNED');
    expect(await code(svc.closeVacancy(job, ORG, 'Position no longer needed', as('emp')))).toBe('JOB_NOT_OWNED');
    expect(await code(svc.closeVacancy(job, ORG, 'Position no longer needed', as('admin')))).toBe('ADMIN_CANNOT_CHANGE_JOB_STATUS');
    expect(await code(svc.deleteVacancy(job, ORG, as('emp')))).toBe('JOB_NOT_OWNED');
    expect(await code(svc.deleteVacancy(job, ORG, as('otherHm')))).toBe('JOB_NOT_OWNED');
    expect(await code(svc.deleteVacancy(randomUUID(), ORG, as('emp')))).toBe('404');
    expect((await svc.closeVacancy(job, ORG, 'Position no longer needed', as('hm'))).status).toBe('Closed');
    const del = VacanciesController.prototype.deleteVacancy;
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, del)).toEqual(['VACANCY_MANAGE', 'VACANCY_VIEW']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, del)).toBeUndefined();
  });

  it('B2R-2: admin DELETE needs a close reason (Other + note) and writes ADMIN_OVERRIDE', async () => {
    const job = await newJob();
    expect(await code(svc.deleteVacancy(job, ORG, as('admin')))).toBe('REASON_REQUIRED');
    expect(await code(svc.deleteVacancy(job, ORG, as('admin'), { reason: 'Other' }))).toBe('REASON_REQUIRED');
    expect(await code(svc.deleteVacancy(job, ORG, as('admin'), { reason: 'made up' }))).toBe('REASON_NOT_IN_LIST');
    expect(await svc.deleteVacancy(job, ORG, as('admin'), { reason: 'Other', note: 'Duplicate job' })).toMatchObject({ deactivated: true, status: 'Closed' });
    const audit = await prisma.auditLog.findMany({ where: { entityId: job, action: 'ADMIN_OVERRIDE' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorUserId: u.admin, entityType: 'Vacancy', reason: 'Other: Duplicate job' });
  });
});
