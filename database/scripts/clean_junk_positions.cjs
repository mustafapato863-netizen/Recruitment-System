const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

async function cleanAndEnrich() {
  console.log('--- CLEANING AND ENRICHING POSITIONS & VACANCIES ---');

  const org = await prisma.organization.findFirst({
    where: { code: 'RECRUITFLOW-DEMO' },
  });
  if (!org) throw new Error('Org not found');

  // 1. Delete junk test positions (POS_M1G4_*)
  const junkPositions = await prisma.position.findMany({
    where: {
      organizationId: org.id,
      code: { startsWith: 'POS_M1G4_' }
    },
    include: { vacancies: true, vacancyRequests: true }
  });

  const validVacancy = await prisma.vacancy.findFirst({
    where: { organizationId: org.id, position: { code: 'STAFF-NURSE' } }
  });

  console.log(`Found ${junkPositions.length} junk test positions to clean up.`);
  for (const pos of junkPositions) {
    for (const v of pos.vacancies) {
      if (validVacancy) {
        await prisma.application.updateMany({
          where: { vacancyId: v.id },
          data: { vacancyId: validVacancy.id }
        });
      }
      await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: v.id } });
      await prisma.vacancy.delete({ where: { id: v.id } });
    }
    for (const vr of pos.vacancyRequests) {
      await prisma.vacancyRequestApproval.deleteMany({ where: { vacancyRequestId: vr.id } });
      await prisma.vacancyRequest.delete({ where: { id: vr.id } });
    }
    await prisma.position.delete({ where: { id: pos.id } });
    console.log(`  Cleaned junk position: ${pos.code}`);
  }

  // 2. Clean up duplicate FE-ENG vacancies, keeping only the primary one with skills
  const feVacs = await prisma.vacancy.findMany({
    where: {
      organizationId: org.id,
      position: { code: 'FE-ENG' }
    },
    include: { applications: true, assignments: true },
    orderBy: { createdAt: 'desc' }
  });

  if (feVacs.length > 1) {
    console.log(`Found ${feVacs.length} FE-ENG vacancies. Keeping the primary one with skills.`);
    const primary = feVacs.find(v => v.requiredSkills && v.requiredSkills.length > 0) || feVacs[0];
    for (const v of feVacs) {
      if (v.id !== primary.id) {
        // If there are applications, reassign to primary
        if (v.applications.length > 0) {
          await prisma.application.updateMany({
            where: { vacancyId: v.id },
            data: { vacancyId: primary.id }
          });
        }
        await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: v.id } });
        await prisma.vacancy.delete({ where: { id: v.id } });
        console.log(`  Deleted duplicate FE-ENG vacancy: ${v.vacancyCode}`);
      }
    }
  }

  console.log('Cleanup completed successfully.');
}

cleanAndEnrich()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
