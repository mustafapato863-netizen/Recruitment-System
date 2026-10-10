/** B2-12: an employee links a bank person (not created by him, no files he sees) to his own job: Applied, not 404. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../../access-control/access-control.service';
import { ApplicationsService } from '../applications.service';
import { CandidatesService } from '../../candidates/candidates.service';
import { privateVacancy } from '../../common/testing/private-vacancy';
import { DocumentsService } from '../../documents/documents.service';
import { HAS_VACANCY_OWNER } from '../../common/schema-features';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B2-12 link a bank person (scratch Postgres)', () => {
  let prisma: PrismaService;
  const me = randomUUID();
  let vac = ''; let person = ''; let person2 = '';
  const auth = (): AuthUser => ({ userId: me, organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] });

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    const rec = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    await prisma.user.create({ data: { id: me, organizationId: ORG, email: `l-${tag}@b212.test`, emailNormalized: `l-${tag}@b212.test`, displayName: 'B212 me', passwordHash: 'x', userRoles: { create: { roleId: rec.id } } } });
    vac = await privateVacancy(prisma, ORG, 'B212');
    await prisma.$transaction([
      prisma.vacancy.update({ where: { id: vac }, data: { status: 'Open', ...(HAS_VACANCY_OWNER ? { primaryRecruiterId: me } : {}) } as never }),
      prisma.vacancyAssignment.create({ data: { vacancyId: vac, userId: me, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } }),
    ]);
    person2 = (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `B2F2-${tag}`, firstName: 'Jane', lastName: 'Bank', email: `jane-${tag}@b212.test` } })).id;
    person = (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `B212-${tag}`, firstName: 'Lina', lastName: 'Bank', email: `lina-${tag}@b212.test` } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('B2F-2: create-application-then-upload: before the link the CV upload is 404; after POST /applications it passes the candidate check', async () => {
    const docs = Object.create(DocumentsService.prototype) as DocumentsService;
    Object.assign(docs, { prisma, accessControl: new AccessControlService(prisma) });
    const upload = () => docs.uploadFile(ORG, me, { candidateId: person2 } as never, { buffer: Buffer.alloc(0), size: 0 } as never, auth()).catch((e: { status?: number; response?: { code?: string } }) => e.response?.code ?? e.status);
    expect(await upload()).toBe(404);
    const apps = new ApplicationsService(prisma, { createForUser: async () => undefined } as never, {} as never, new AccessControlService(prisma));
    await apps.createApplication(ORG, { vacancyId: vac, candidateId: person2, primaryRecruiterId: me } as never, auth());
    expect(await upload()).toBe('FILE_INVALID'); // past the candidate check: only the (empty) file is refused
  });

  it('POST /applications with a bank person on my job creates Applied', async () => {
    const apps = new ApplicationsService(prisma, { createForUser: async () => undefined } as never, {} as never, new AccessControlService(prisma));
    const app = await apps.createApplication(ORG, { vacancyId: vac, candidateId: person, primaryRecruiterId: me } as never, auth());
    expect(app).toMatchObject({ candidateId: person, vacancyId: vac, stage: 'Applied' });
  });

  it('POST /candidates with the same email: 409 CANDIDATE_EXISTS naming the person (id + code only)', async () => {
    const cands = Object.create(CandidatesService.prototype) as CandidatesService;
    Object.assign(cands, { prisma });
    await expect((cands as unknown as { createCandidateRecord: (o: string, d: unknown) => Promise<unknown> }).createCandidateRecord(ORG, { firstName: 'L', lastName: 'H', email: `LINA-${tag}@b212.test` }))
      .rejects.toMatchObject({ status: 409, response: { code: 'CANDIDATE_EXISTS', details: { candidateId: person, candidateCode: `B212-${tag}` } } });
  });
});
