// Clear the local development database while keeping schema migrations and a
// single administrator account, so workflows can be tested from a clean slate.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('../generated/client');

// Same local-only test password and hash used by prisma/seed.cjs.
const LOCAL_PASSWORD_HASH = '$2b$10$dd0OAfjCvUL/waxTy79xZe0H7QN3r7oEbPPKJ9dwg97.y70rZgep6';

const root = path.resolve(__dirname, '../..');
const readEnv = (file) => dotenv.parse(fs.readFileSync(path.join(root, file)));
const rootEnv = readEnv('.env');
const apiEnv = readEnv('apps/api/.env');

function assertLocalDatabase(value, source) {
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    (url.port && url.port !== '5432') ||
    url.pathname !== '/Recruitment_DB'
  ) {
    throw new Error(`${source} must point to local Recruitment_DB on port 5432.`);
  }
  return url;
}

async function main() {
  if (process.argv[2] !== '--yes-reset-local') {
    throw new Error('Pass --yes-reset-local to reset the local test database.');
  }
  if (rootEnv.NODE_ENV === 'production' || apiEnv.NODE_ENV === 'production') {
    throw new Error('Database reset is disabled in production.');
  }
  const rootUrl = assertLocalDatabase(rootEnv.DATABASE_URL, '.env');
  const apiUrl = assertLocalDatabase(apiEnv.DATABASE_URL, 'apps/api/.env');
  if (rootUrl.href !== apiUrl.href) {
    throw new Error('The root and API database URLs differ; refusing to reset either database.');
  }

  process.env.DATABASE_URL = apiEnv.DATABASE_URL;
  const prisma = new PrismaClient();
  try {
    const permissions = await prisma.permission.findMany({
      where: { organizationId: null },
      select: { code: true, name: true, description: true },
    });
    if (permissions.length === 0) {
      throw new Error('No shared permissions found; refusing to leave an unusable administrator account.');
    }

    const clearedCount = await prisma.$transaction(async (tx) => {
      const tables = await tx.$queryRawUnsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'",
      );
      if (!tables.some(({ tablename }) => tablename === 'users')) {
        throw new Error('The expected application tables were not found.');
      }
      // Names come from PostgreSQL's table catalog, then are quoted as SQL identifiers.
      const names = tables.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`);
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);

      const organization = await tx.organization.create({
        data: { code: 'RECRUITFLOW-DEMO', name: 'RecruitFlow Local Testing' },
      });
      const role = await tx.role.create({ data: { code: 'ADMINISTRATOR', name: 'Administrator' } });
      await tx.permission.createMany({ data: permissions });
      const restoredPermissions = await tx.permission.findMany({ select: { id: true } });
      await tx.rolePermission.createMany({
        data: restoredPermissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: 'admin@sgh.com',
          emailNormalized: 'admin@sgh.com',
          displayName: 'Local Administrator',
          passwordHash: LOCAL_PASSWORD_HASH,
          status: 'Active',
        },
      });
      await tx.userRole.create({ data: { userId: admin.id, roleId: role.id } });
      return tables.length;
    }, { timeout: 60000 });
    console.log(`Local test database reset: ${clearedCount} application tables cleared; 1 admin and ${permissions.length} permissions restored.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
