/**
 * Seed script for test data
 * Populates database with simple test fixtures following user constraints:
 * - Fixed UUID ids (id columns are UUIDs); the fixture number is the suffix
 * - Simple fname/lname placeholders (single letters)
 * - 3 role types: Employee/Requester, Manager/Hiring Manager, Administrator/Recruitment Operations
 */

// Same generated client as prisma/seed.cjs (@prisma/client is not generated here).
const { PrismaClient } = require('@recruitflow/database');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// .cjs must be explicit: Node does not resolve the .cjs extension on its own.
const { seedTestFixtures } = require('./prisma/test-fixtures.cjs');

const SEED_ORGANIZATION_ID = '10000000-0000-4000-8000-000000000001';

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting test data seeding...');

    // Get the default organization (assuming it exists from migrations)
    // The base seed (prisma/seed.cjs) creates the demo organization with a
    // fixed id; older databases used the 'Saudi German Health' name.
    const organization =
      (await prisma.organization.findUnique({ where: { id: SEED_ORGANIZATION_ID } })) ??
      (await prisma.organization.findFirst({ where: { name: 'Saudi German Health' } }));

    if (!organization) {
      console.error('Organization not found. Run migrations and the base seed first (pnpm --dir database prisma:seed).');
      process.exit(1);
    }

    console.log(`Found organization: ${organization.name} (ID: ${organization.id})`);

    // Seed test fixtures
    const result = await seedTestFixtures(prisma, { organization });

    console.log('Test data seeded successfully:');
    console.log(`- Users: ${result.users}`);
    console.log(`- Vacancy Requests: ${result.vacancyRequests}`);
    console.log(`- Vacancies: ${result.vacancies}`);
    console.log(`- Candidates: ${result.candidates}`);
    console.log(`- Applications: ${result.applications}`);

    // Display created users for verification
    const users = await prisma.user.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        email: true,
        displayName: true
      },
      orderBy: { email: 'asc' }
    });

    console.log('\nCreated Users:');
    users.forEach(user => {
      console.log(`- ID: ${user.id} | ${user.displayName} (${user.email})`);
    });

  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();