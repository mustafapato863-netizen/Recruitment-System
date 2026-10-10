import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth.service';

const url = process.env.B10_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';

describe.skipIf(!url)('B10 /auth/me rollout fields (scratch Postgres)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  const emp = randomUUID(); const mgr = randomUUID();
  const env = process.env.RF_V2_SEATS;

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    auth = Object.assign(Object.create(AuthService.prototype), { prisma }) as AuthService;
    const role = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    const t = randomUUID().slice(0, 8);
    await prisma.user.create({ data: { id: mgr, organizationId: ORG, email: `b10m-${t}@t.test`, emailNormalized: `b10m-${t}@t.test`, displayName: 'B10 M', passwordHash: 'x', userRoles: { create: { roleId: role.id } } } });
    await prisma.user.create({ data: { id: emp, organizationId: ORG, email: `b10e-${t}@t.test`, emailNormalized: `b10e-${t}@t.test`, displayName: 'B10 E', passwordHash: 'x', managerId: mgr, userRoles: { create: { roleId: role.id } } } });
  });
  afterEach(async () => {
    await prisma.integration.deleteMany({ where: { organizationId: ORG, name: 'ROLLOUT_SEATS' } });
    if (env === undefined) delete process.env.RF_V2_SEATS; else process.env.RF_V2_SEATS = env;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('default: employee seat on v2, manager not', async () => {
    delete process.env.RF_V2_SEATS;
    expect(await auth.getUserProfile(emp)).toMatchObject({ seat: 'employee', v2Seats: ['employee'], v2Enabled: true, flags: { v2Seats: ['employee'] } });
    expect(await auth.getUserProfile(mgr)).toMatchObject({ seat: 'manager', v2Enabled: false });
  });
  it('env, then org config overrides env', async () => {
    process.env.RF_V2_SEATS = 'employee,manager';
    expect(await auth.getUserProfile(mgr)).toMatchObject({ v2Seats: ['employee', 'manager'], v2Enabled: true });
    await prisma.integration.create({ data: { organizationId: ORG, name: 'ROLLOUT_SEATS', provider: 'config', category: 'Config', status: 'Configured', configJson: { v2Seats: [] } } });
    expect(await auth.getUserProfile(emp)).toMatchObject({ v2Seats: [], v2Enabled: false });
  });
});
