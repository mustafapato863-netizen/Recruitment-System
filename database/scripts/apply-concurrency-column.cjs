require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

async function run() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('Application', 'applications') AND column_name = 'version'
  `);
  console.log('Existing version columns:', tables);

  // Check which table exists
  const appTables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Application', 'applications')
  `);
  console.log('App tables:', appTables);

  for (const t of appTables) {
    const tableName = t.table_name;
    console.log(`Adding version column to "${tableName}" if missing...`);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "${tableName}_id_stage_version_idx" ON "${tableName}"("id", "stage", "version");
    `).catch(e => console.log('Index error (may already exist):', e.message));
  }

  console.log('Done.');
  await prisma.$disconnect();
}

run().catch(console.error);
