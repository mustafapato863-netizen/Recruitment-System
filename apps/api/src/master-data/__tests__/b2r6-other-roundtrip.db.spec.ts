/** B2R-6: after b3f's rollback and a re-upgrade, the "Other" rejection reason is Active again (b3g). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';

const url = process.env.B3_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const root = join(__dirname, '../../../../../database/prisma');
// Data statements only: the _prisma_migrations bookkeeping is not replayed here.
const statements = (file: string) => readFileSync(join(root, file), 'utf8').split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter((s) => s && !s.includes('_prisma_migrations'));

describe.skipIf(!url)('B2R-6 rejection "Other" survives a rollback round trip', () => {
  if (!url) return;
  const prisma = new PrismaService({ datasources: { db: { url } } });
  afterAll(async () => { await prisma.$disconnect(); });
  it('b3f down -> b3f up -> b3g up leaves Other Active', async () => {
    // One transaction: parallel suites never see "Other" Inactive.
    await prisma.$transaction(async (tx) => {
    const status = async () => (await tx.masterDataValue.findFirstOrThrow({ where: { organizationId: ORG, category: 'rejection-reasons', code: 'OTHER' } })).status;
    for (const s of statements('rollbacks/20261010_b3f_rejection_other.down.sql')) await tx.$executeRawUnsafe(s);
    expect(await status()).toBe('Inactive');
    for (const s of [...statements('migrations/20261010_b3f_rejection_other/migration.sql'), ...statements('migrations/20261010_b3g_rejection_other_active/migration.sql')]) await tx.$executeRawUnsafe(s);
    expect(await status()).toBe('Active');
    });
  });
});
