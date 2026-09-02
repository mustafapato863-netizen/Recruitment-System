const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Existing tables count:', tables.length);
  console.log('Tables:', tables.map(t => t.table_name));
  
  const orgCount = await prisma.$queryRawUnsafe("SELECT count(*) FROM \"Organization\"").catch(() => null);
  console.log('Organization count:', orgCount);

  const userCount = await prisma.$queryRawUnsafe("SELECT count(*) FROM \"User\"").catch(() => null);
  console.log('User count:', userCount);

  const candidateCount = await prisma.$queryRawUnsafe("SELECT count(*) FROM \"Candidate\"").catch(() => null);
  console.log('Candidate count:', candidateCount);

  const vacancyCount = await prisma.$queryRawUnsafe("SELECT count(*) FROM \"Vacancy\"").catch(() => null);
  console.log('Vacancy count:', vacancyCount);

  const appCount = await prisma.$queryRawUnsafe("SELECT count(*) FROM \"Application\"").catch(() => null);
  console.log('Application count:', appCount);

  await prisma.$disconnect();
}

run().catch(console.error);
