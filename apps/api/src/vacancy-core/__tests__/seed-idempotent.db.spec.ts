/** M1: the seed is idempotent and adds the demo departments. Scratch Postgres only. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';

// Re-running the seed rewrites demo fixtures, so this needs its OWN scratch DB (never the shared suite DB).
const url = process.env.SEED_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const seed = resolve(__dirname, '../../../../../database/prisma/seed.cjs');
// Only what other (parallel) suites never write, plus seed-owned master data, so the comparison is stable.
const QUERIES: Record<string, string> = {
  organizations: 'SELECT count(*) AS n FROM "organizations"',
  roles: 'SELECT count(*) AS n FROM "roles"',
  permissions: 'SELECT count(*) AS n FROM "permissions"',
  role_permissions: 'SELECT count(*) AS n FROM "role_permissions"',
  branches: 'SELECT count(*) AS n FROM "branches"',
  positions: 'SELECT count(*) AS n FROM "positions"',
  seededMasterData: `SELECT count(*) AS n FROM "master_data_values" WHERE code LIKE 'DEPT\\_%' OR category IN ('hold-reasons', 'close-reasons', 'rejection-reasons', 'reassign-reasons')`,
};

describe.skipIf(!url)('seed (scratch Postgres)', () => {
  let prisma: PrismaService;
  const run = () => execFileSync(process.execPath, [seed], { env: { ...process.env, DATABASE_URL: url }, cwd: resolve(seed, '..', '..'), stdio: 'pipe' });
  const counts = async () => Object.fromEntries(await Promise.all(Object.entries(QUERIES).map(async ([k, q]) => [k, Number((await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(q))[0]!.n)])));
  beforeAll(() => { prisma = new PrismaService({ datasources: { db: { url } } }); });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('running it again changes nothing and the demo departments exist once each', async () => {
    run();
    const before = await counts();
    run();
    expect(await counts()).toEqual(before);
    const depts = await prisma.masterDataValue.findMany({ where: { organizationId: ORG, category: 'departments', name: { in: ['IT', 'Nursing', 'Pharmacy', 'Finance', 'HR'] } } });
    expect(depts.map((d) => d.name).sort()).toEqual(['Finance', 'HR', 'IT', 'Nursing', 'Pharmacy']);
    expect(depts.every((d) => d.status === 'Active')).toBe(true);
  }, 120_000);
});
