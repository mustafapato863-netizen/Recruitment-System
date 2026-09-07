const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { code: 'RECRUITFLOW-DEMO' },
  });

  const positions = await prisma.position.findMany({
    where: { organizationId: org.id },
    include: {
      vacancies: {
        select: { id: true, vacancyCode: true, status: true, requiredSkills: true, minExperienceYears: true, location: true }
      }
    },
    orderBy: { title: 'asc' }
  });

  console.log('--- RECRUITFLOW-DEMO POSITIONS (' + positions.length + ') ---');
  positions.forEach(p => {
    const v = p.vacancies[0];
    console.log(`[POS] ${p.code.padEnd(20)} | ${p.title.padEnd(35)} | Vacancies: ${p.vacancies.length} | First Vac: ${v ? v.vacancyCode + ' (' + v.status + ')' : 'NONE'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
