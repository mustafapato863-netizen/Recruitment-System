import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { CandidatesService } from '../candidates.service';

const url = process.env.B6_TEST_DATABASE_URL;
it.skipIf(!url)('concurrent phone-only candidate creates resolve to one organization identity', async () => {
  const db = new PrismaService({ datasources: { db: { url } } });
  const organizationId = randomUUID();
  try {
    await db.organization.create({ data: { id: organizationId, code: organizationId, name: 'Concurrent import test' } });
    const service = new CandidatesService(db);
    const create = (phone: string) => service.createCandidate(organizationId, { firstName: 'Test', lastName: 'Applicant', phone });
    const results = await Promise.allSettled([create('+201234567891'), create('00201234567891')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { response: { code: 'CANDIDATE_EXISTS' } } });
    expect(await db.candidate.count({ where: { organizationId } })).toBe(1);
  } finally {
    await db.candidate.deleteMany({ where: { organizationId } });
    await db.organization.deleteMany({ where: { id: organizationId } });
    await db.$disconnect();
  }
});
