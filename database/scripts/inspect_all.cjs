const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

async function run() {
  const org = await prisma.organization.findFirst({ where: { code: 'RECRUITFLOW-DEMO' } });
  console.log('Org:', org?.id, org?.code);

  const positions = await prisma.position.findMany({
    where: { organizationId: org.id },
    include: {
      vacancies: {
        select: { id: true, vacancyCode: true, status: true, requiredSkills: true, minExperienceYears: true, location: true }
      }
    },
    orderBy: { code: 'asc' }
  });
  console.log('--- ALL POSITIONS & VACANCIES ---');
  positions.forEach(p => {
    const vWithSkills = p.vacancies.find(v => v.requiredSkills && v.requiredSkills.length > 0);
    console.log(p.code.padEnd(25), '|', p.title.padEnd(35), '| vacs:', p.vacancies.length, '| hasSkills:', Boolean(vWithSkills), '| skillsCount:', vWithSkills?.requiredSkills?.length || 0);
  });
}

run().catch(console.error).finally(() => prisma.$disconnect());
