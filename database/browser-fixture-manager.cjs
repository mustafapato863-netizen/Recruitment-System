/**
 * Browser Test Fixture Manager
 * Creates and tears down isolated public vacancy fixtures for Playwright browser tests.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@recruitflow/database');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

async function setup() {
  try {
    const org = await prisma.organization.findUnique({
      where: { code: 'RECRUITFLOW-DEMO' }
    });
    if (!org) throw new Error('RECRUITFLOW-DEMO organization not found');

    const branch = await prisma.branch.findFirst({
      where: { organizationId: org.id }
    });
    if (!branch) throw new Error('Branch not found for RECRUITFLOW-DEMO');

    const position = await prisma.position.findFirst({
      where: { organizationId: org.id }
    });
    if (!position) throw new Error('Position not found for RECRUITFLOW-DEMO');

    const admin = await prisma.user.findFirst({
      where: { organizationId: org.id }
    });
    if (!admin) throw new Error('User not found for RECRUITFLOW-DEMO');

    const pastDate = new Date(Date.now() - 24 * 3600 * 1000);
    const reqCode = `VR-BROWSER-${Date.now()}`;
    const vacancyCode = `VAC-BROWSER-${Date.now()}`;

    const vacancyRequest = await prisma.vacancyRequest.create({
      data: {
        organizationId: org.id,
        requestCode: reqCode,
        positionId: position.id,
        branchId: branch.id,
        requesterId: admin.id,
        requestedHeadcount: 2,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });

    const vacancy = await prisma.vacancy.create({
      data: {
        organizationId: org.id,
        vacancyCode,
        vacancyRequestId: vacancyRequest.id,
        branchId: branch.id,
        positionId: position.id,
        status: 'Open',
        approvedHeadcount: 2,
        openedAt: pastDate,
        targetStartDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        minExperienceYears: 3,
        requiredSkills: ['Playwright', 'TypeScript', 'React', 'Automated Testing'],
      }
    });

    const result = {
      organizationCode: org.code,
      organizationName: org.name,
      vacancyCode: vacancy.vacancyCode,
      vacancyId: vacancy.id,
      vacancyRequestId: vacancyRequest.id,
      positionTitle: position.title,
    };

    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup(vacancyCode) {
  if (!vacancyCode) {
    console.error('No vacancyCode provided for cleanup');
    process.exit(1);
  }
  try {
    const vacancy = await prisma.vacancy.findUnique({
      where: { vacancyCode },
      include: {
        applications: {
          select: { id: true, candidateId: true }
        }
      }
    });

    if (vacancy) {
      const appIds = vacancy.applications.map(a => a.id);
      const candIds = vacancy.applications.map(a => a.candidateId);

      if (appIds.length > 0) {
        await prisma.interviewScorecard.deleteMany({ where: { interview: { applicationId: { in: appIds } } } });
        await prisma.interviewAttendee.deleteMany({ where: { interview: { applicationId: { in: appIds } } } });
        await prisma.interview.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.offerApproval.deleteMany({ where: { offerVersion: { offer: { applicationId: { in: appIds } } } } });
        await prisma.offerComponent.deleteMany({ where: { offerVersion: { offer: { applicationId: { in: appIds } } } } });
        await prisma.offerVersion.deleteMany({ where: { offer: { applicationId: { in: appIds } } } });
        await prisma.offer.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.screeningLog.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: appIds } } });
        await prisma.auditLog.deleteMany({ where: { entityType: 'Application', entityId: { in: appIds } } });
        await prisma.application.deleteMany({ where: { id: { in: appIds } } });
      }

      if (candIds.length > 0) {
        await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: candIds } } });
        await prisma.candidate.deleteMany({ where: { id: { in: candIds } } });
      }

      await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: vacancy.id } });
      await prisma.vacancy.deleteMany({ where: { id: vacancy.id } });

      if (vacancy.vacancyRequestId) {
        await prisma.vacancyRequestApproval.deleteMany({ where: { vacancyRequestId: vacancy.vacancyRequestId } });
        await prisma.vacancyRequest.deleteMany({ where: { id: vacancy.vacancyRequestId } });
      }
    }

    // Clean rate limits created during test
    await prisma.authRateLimit.deleteMany({
      where: { scope: 'account' }
    });

    console.log(JSON.stringify({ cleaned: true, vacancyCode }));
  } finally {
    await prisma.$disconnect();
  }
}

const command = process.argv[2];
if (command === 'setup') {
  setup().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else if (command === 'cleanup') {
  cleanup(process.argv[3]).catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error('Usage: node database/browser-fixture-manager.cjs [setup|cleanup <vacancyCode>]');
  process.exit(1);
}
