/**
 * Seed script for test data
 * Populates database with simple test fixtures following user constraints:
 * - IDs <= 4 characters
 * - Simple fname/lname placeholders (single letters)
 * - 3 role types: Employee/Requester, Manager/Hiring Manager, Administrator/Recruitment Operations
 */

const { PrismaClient } = require('@prisma/client');
const { seedTestFixtures } = require('./prisma/test-fixtures');

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting test data seeding...');

    // Get the default organization (assuming it exists from migrations)
    const organization = await prisma.organization.findFirst({
      where: { name: 'Saudi German Health' }
    });

    if (!organization) {
      console.error('Organization not found. Please run migrations first.');
      process.exit(1);
    }

    console.log(`Found organization: ${organization.name} (ID: ${organization.id})`);

    // Seed test fixtures
    const result = await seedTestFixtures(prisma, { organization });

    console.log('Test data seeded successfully:');
    console.log(`- Users: ${result.users}`);
    console.log(`- Vacancy Requests: ${result.vacancyRequests}`);
    console.log(`- Vacancies: ${result.vacancies}`);
    console.log(`- Applications: ${result.applications}`);

    // Display created users for verification
    const users = await prisma.user.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true
      },
      orderBy: { id: 'asc' }
    });

    console.log('\nCreated Users:');
    users.forEach(user => {
      console.log(`- ID: ${user.id} | ${user.firstName} ${user.lastName} (${user.email})`);
    });

  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();