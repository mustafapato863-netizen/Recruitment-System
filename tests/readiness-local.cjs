// Isolated local QA database runner. Never migrates or seeds the configured app database.
const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('../database/generated/client');
const root = path.resolve(__dirname, '..');
const databaseName = 'recruitflow_readiness_20260907';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local database required');
const adminUrl = url.toString();
url.pathname = '/' + databaseName;
const readinessPort = process.env.READINESS_API_PORT || '3010';
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  RECRUITFLOW_API_PORT: readinessPort,
  P1_API_PORT: readinessPort,
  P2_API_PORT: readinessPort,
  P3_API_PORT: readinessPort,
  EMAIL_TRANSPORT: 'console',
  SELF_SCHEDULE_SECRET: 'readiness-only-self-schedule-secret-20260907',
  EMAIL_OUTBOX_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
async function main() {
  const command = process.argv[2];
  if (command === 'setup') {
    const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      const exists = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${databaseName}`;
      if (exists.length) throw new Error('QA database already exists; refusing to reseed');
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    } finally { await prisma.$disconnect(); }
    run('database/scripts/prisma.cjs', ['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
    run('database/prisma/seed.cjs', []);
  } else if (command === 'provision') {
    run('database/scripts/prisma.cjs', ['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
    run('database/prisma/seed.cjs', []);
  } else if (command === 'recover') {
    run('database/scripts/prisma.cjs', ['migrate', 'resolve', '--rolled-back', '20260824_bulk_import_center', '--schema', 'prisma/schema.prisma']);
  } else if (command === 'api') {
    const child = spawn(process.execPath, ['apps/api/dist/apps/api/src/main.js'], { cwd: root, env, stdio: 'inherit' });
    child.on('exit', code => process.exit(code || 0));
  } else if (command === 'production-api') {
    const child = spawn(process.execPath, ['apps/api/dist/apps/api/src/main.js'], {
      cwd: root,
      env: { ...env, NODE_ENV: 'production', RECRUITFLOW_API_PORT: '3011', P1_API_PORT: '3011' },
      stdio: 'inherit',
    });
    child.on('exit', code => process.exit(code || 0));
  } else if (command === 'test') {
    for (const file of process.argv.slice(3)) run(file, []);
  } else throw new Error('Use setup, api, or test <script>');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
