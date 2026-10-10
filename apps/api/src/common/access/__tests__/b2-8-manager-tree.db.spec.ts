/** B2-8: a Manager's file scope is his reporting tree; VACANCY_MANAGE alone grants no other team's files or pay. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../../../database/prisma.service';
import { AccessControlService } from '../../../access-control/access-control.service';
import { privateVacancy } from '../../testing/private-vacancy';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B2-8 manager reporting tree (scratch Postgres)', () => {
  let prisma: PrismaService;
  let access: AccessControlService;
  const u = { hassan: randomUUID(), karim: randomUUID(), mariam: randomUUID(), mona: randomUUID(), admin: randomUUID() };
  const app = randomUUID();
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    access = new AccessControlService(prisma);
    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'HIRING_MANAGER', 'TALENT_MANAGER', 'ADMINISTRATOR'] } } })).map((r) => [r.code, r.id]));
    const mk = (id: string, name: string, role: string, managerId?: string) => prisma.user.create({ data: {
      id, organizationId: ORG, email: `${name}-${tag}@b28.test`, emailNormalized: `${name}-${tag}@b28.test`, displayName: `B28 ${name}`, passwordHash: 'x', status: 'Active',
      ...(managerId ? { managerId } : {}), userRoles: { create: { roleId: roles[role]! } } } });
    await mk(u.hassan, 'hassan', 'HIRING_MANAGER');
    await mk(u.karim, 'karim', 'HIRING_MANAGER', u.hassan);
    await mk(u.mariam, 'mariam', 'RECRUITER', u.karim);
    await mk(u.mona, 'mona', 'TALENT_MANAGER'); // holds VACANCY_MANAGE; Mariam is NOT in her tree
    await mk(u.admin, 'admin', 'ADMINISTRATOR');
    const vac = await privateVacancy(prisma, ORG, 'B28');
    const cand = await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `B28-${tag}`, firstName: 'Lina', lastName: 'B28' } });
    await prisma.application.create({ data: { id: app, organizationId: ORG, applicationCode: `B28-${tag}`, vacancyId: vac, candidateId: cand.id, stage: 'Offer', primaryRecruiterId: u.mariam } });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  const sees = async (who: AuthUser) => Boolean(await prisma.application.findFirst({ where: { AND: [{ id: app }, await access.getApplicationReadVisibilityWhere(who)] }, select: { id: true } }));

  it('direct manager and his manager see the report\'s file; another team\'s VACANCY_MANAGE holder does not; admin does', async () => {
    expect(await sees(auth(u.mariam, ['RECRUITER']))).toBe(true);
    expect(await sees(auth(u.karim, ['HIRING_MANAGER']))).toBe(true);
    expect(await sees(auth(u.hassan, ['HIRING_MANAGER']))).toBe(true); // tree, not only direct reports
    expect(await sees(auth(u.mona, ['TALENT_MANAGER']))).toBe(false);
    expect(await sees(auth(u.admin, ['ADMINISTRATOR']))).toBe(true);
    expect((await access.getAccessProfile(auth(u.mona, ['TALENT_MANAGER']))).isOversight).toBe(false);
  });

  it('write visibility follows the same tree', async () => {
    const can = async (who: AuthUser) => Boolean(await prisma.application.findFirst({ where: { AND: [{ id: app }, await access.getApplicationVisibilityWhere(who)] } }));
    expect(await can(auth(u.karim, ['HIRING_MANAGER']))).toBe(true);
    expect(await can(auth(u.mona, ['TALENT_MANAGER']))).toBe(false);
  });
});
