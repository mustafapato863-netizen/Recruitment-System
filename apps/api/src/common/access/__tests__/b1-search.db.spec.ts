/**
 * B1 security follow-up: GET /search uses the same scope as the lists. Scratch Postgres only
 * (B1_TEST_DATABASE_URL). Other owners' files are excluded, other owners' jobs are redacted
 * to title/site/seats, and non-owners get no contact fields (and cannot match on them).
 */
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../database/prisma.service';
import { AccessControlService } from '../../../access-control/access-control.service';
import { SearchService } from '../../../search/search.service';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B1 search scope (scratch Postgres)', () => {
  let prisma: PrismaService;
  let search: SearchService;
  const ids = { owner: randomUUID(), other: randomUUID(), admin: randomUUID(), candA: randomUUID(), candB: randomUUID(), appA: randomUUID(), appB: randomUUID() };
  let jobA = ''; let jobB = '';
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    search = new SearchService(prisma, new AccessControlService(prisma));
    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'ADMINISTRATOR'] } } })).map((r) => [r.code, r.id]));
    for (const [id, name, role] of [[ids.owner, 'owner', 'RECRUITER'], [ids.other, 'other', 'RECRUITER'], [ids.admin, 'admin', 'ADMINISTRATOR']] as const) {
      await prisma.user.create({ data: { id, organizationId: ORG, email: `s-${name}-${tag}@b1.test`, emailNormalized: `s-${name}-${tag}@b1.test`, displayName: `S ${name}`, passwordHash: 'x', status: 'Active', userRoles: { create: { roleId: roles[role]! } } } });
    }
    const jobs = await prisma.vacancy.findMany({ where: { organizationId: ORG }, orderBy: { vacancyCode: 'desc' }, take: 2 });
    jobA = jobs[0]!.id; jobB = jobs[1]!.id;
    await prisma.vacancyAssignment.create({ data: { vacancyId: jobA, userId: ids.owner, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } });
    await prisma.vacancyAssignment.create({ data: { vacancyId: jobB, userId: ids.other, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } });
    await prisma.candidate.create({ data: { id: ids.candA, organizationId: ORG, candidateCode: `SA-${tag}`, firstName: `Srch${tag}`, lastName: 'Alpha', email: `alpha-${tag}@b1.test` } });
    await prisma.candidate.create({ data: { id: ids.candB, organizationId: ORG, candidateCode: `SB-${tag}`, firstName: `Srch${tag}`, lastName: 'Beta', email: `beta-${tag}@b1.test` } });
    await prisma.application.create({ data: { id: ids.appA, organizationId: ORG, applicationCode: `SA-${tag}`, vacancyId: jobA, candidateId: ids.candA, stage: 'Screening', primaryRecruiterId: ids.owner } });
    await prisma.application.create({ data: { id: ids.appB, organizationId: ORG, applicationCode: `SB-${tag}`, vacancyId: jobB, candidateId: ids.candB, stage: 'Screening', primaryRecruiterId: ids.other } });
  });
  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: { in: [ids.appA, ids.appB] } } });
    await prisma.vacancyAssignment.deleteMany({ where: { userId: { in: [ids.owner, ids.other] } } });
    await prisma.$disconnect();
  });

  const group = (res: Awaited<ReturnType<SearchService['search']>>, type: string) => res.groups.find((g) => g.entityType === type)?.items ?? [];

  it('applications: other owners\' files are excluded', async () => {
    const res = await search.search(auth(ids.other, ['RECRUITER']), `Srch${tag}`, 10);
    expect(group(res, 'application').map((i) => i.entityId)).toEqual([ids.appB]);
  });

  it('candidates: no email for non-owners, and no matching on their email', async () => {
    const res = await search.search(auth(ids.other, ['RECRUITER']), `Srch${tag}`, 10);
    const items = group(res, 'candidate');
    expect(JSON.stringify(items)).not.toContain(`alpha-${tag}`);
    const b = items.find((i) => i.entityId === ids.candB);
    expect(b?.subtitle).toContain(`beta-${tag}@b1.test`);
    expect(group(await search.search(auth(ids.other, ['RECRUITER']), `alpha-${tag}`, 10), 'candidate')).toEqual([]);
    expect(group(await search.search(auth(ids.owner, ['RECRUITER']), `alpha-${tag}`, 10), 'candidate').map((i) => i.entityId)).toEqual([ids.candA]);
  });

  it('jobs: another owner\'s job is title/site/seats only (no code, no status)', async () => {
    const job = await prisma.vacancy.findUniqueOrThrow({ where: { id: jobA }, include: { position: true, branch: true } });
    const res = await search.search(auth(ids.other, ['RECRUITER']), job.position.title, 10);
    const item = group(res, 'vacancy').find((i) => i.entityId === jobA);
    expect(item).toBeDefined();
    {
      expect(item!).toMatchObject({ redacted: true, title: job.position.title });
      expect(item!.subtitle).toBe(`${job.branch.name} · ${job.joinedHeadcount}/${job.approvedHeadcount} seats`);
      expect(item!.status).toBeUndefined();
      expect(JSON.stringify(item)).not.toContain(job.vacancyCode);
    }
    expect(group(await search.search(auth(ids.other, ['RECRUITER']), job.vacancyCode, 10), 'vacancy').find((i) => i.entityId === jobA)).toBeUndefined();
    const own = group(await search.search(auth(ids.owner, ['RECRUITER']), job.vacancyCode, 10), 'vacancy').find((i) => i.entityId === jobA);
    expect(own).toMatchObject({ subtitle: expect.stringContaining(job.vacancyCode) });
    expect(own?.redacted).toBeUndefined();
  });

  it('admin (oversight) sees all, with contact fields', async () => {
    const res = await search.search(auth(ids.admin, ['ADMINISTRATOR']), `Srch${tag}`, 10);
    expect(group(res, 'application').map((i) => i.entityId).sort()).toEqual([ids.appA, ids.appB].sort());
    expect(JSON.stringify(group(res, 'candidate'))).toContain(`alpha-${tag}@b1.test`);
  });
});
