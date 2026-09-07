const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@recruitflow/database');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

const DEFAULT_PASSWORD_HASH = '$2b$10$dd0OAfjCvUL/waxTy79xZe0H7QN3r7oEbPPKJ9dwg97.y70rZgep6';

async function main() {
  console.log('--- Setting up admin@sgh.com and cleaning up demo users ---');

  // 1. Find or verify target organization
  const org = await prisma.organization.findFirst({
    where: { code: 'RECRUITFLOW-DEMO' },
  });

  if (!org) {
    throw new Error('Organization RECRUITFLOW-DEMO not found');
  }

  // 2. Find ADMINISTRATOR role
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMINISTRATOR' },
  });

  if (!adminRole) {
    throw new Error('Role ADMINISTRATOR not found');
  }

  // 3. Create or upsert admin@sgh.com
  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_emailNormalized: {
        organizationId: org.id,
        emailNormalized: 'admin@sgh.com',
      },
    },
    update: {
      email: 'admin@sgh.com',
      emailNormalized: 'admin@sgh.com',
      displayName: 'System Administrator',
      passwordHash: DEFAULT_PASSWORD_HASH,
      status: 'Active',
    },
    create: {
      id: '10000000-0000-4000-8000-000000000000',
      organizationId: org.id,
      email: 'admin@sgh.com',
      emailNormalized: 'admin@sgh.com',
      displayName: 'System Administrator',
      passwordHash: DEFAULT_PASSWORD_HASH,
      status: 'Active',
    },
  });

  console.log(`Created/updated admin user: ${adminUser.email} (ID: ${adminUser.id})`);

  // Assign ADMINISTRATOR role to admin@sgh.com
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });
  console.log(`Assigned ADMINISTRATOR role to ${adminUser.email}`);

  // 4. Find demo users to remove
  const demoUsers = await prisma.user.findMany({
    where: {
      email: { in: ['a@test.com', 'm@test.com', 'e@test.com'] },
    },
  });

  const demoUserIds = demoUsers.map((u) => u.id);
  console.log(`Found ${demoUsers.length} demo users:`, demoUsers.map((u) => `${u.email} (${u.id})`));

  if (demoUserIds.length > 0) {
    // Reassign relations to adminUser to maintain referential integrity
    console.log('Reassigning dependent records from demo users to admin@sgh.com...');

    await prisma.vacancyRequest.updateMany({
      where: { requesterId: { in: demoUserIds } },
      data: { requesterId: adminUser.id },
    });

    await prisma.task.updateMany({
      where: { createdById: { in: demoUserIds } },
      data: { createdById: adminUser.id },
    });

    await prisma.task.updateMany({
      where: { assigneeUserId: { in: demoUserIds } },
      data: { assigneeUserId: adminUser.id },
    });

    await prisma.vacancyRequestApproval.updateMany({
      where: { assigneeUserId: { in: demoUserIds } },
      data: { assigneeUserId: adminUser.id },
    });

    await prisma.applicationStatusHistory.updateMany({
      where: { changedById: { in: demoUserIds } },
      data: { changedById: adminUser.id },
    });

    await prisma.notification.deleteMany({
      where: { recipientUserId: { in: demoUserIds } },
    });

    await prisma.userRole.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    await prisma.authToken.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    // Finally delete demo users
    const deleteResult = await prisma.user.deleteMany({
      where: { id: { in: demoUserIds } },
    });
    console.log(`Deleted ${deleteResult.count} demo users (a@test.com, m@test.com, e@test.com)`);
  }

  // 5. Clean up automated test run artifacts (m1.inv.*, m1g4_*)
  console.log('Cleaning up automated test run users and artifacts...');
  const testArtifactUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: 'm1.' } },
        { email: { startsWith: 'm1g4_' } },
        { email: { startsWith: 'm1.test.' } },
      ],
    },
    select: { id: true, email: true },
  });

  if (testArtifactUsers.length > 0) {
    const testIds = testArtifactUsers.map((u) => u.id);
    console.log(`Found ${testIds.length} test artifact users to clean up.`);

    // Cascade clean related transient records for test artifact users
    await prisma.notification.deleteMany({ where: { recipientUserId: { in: testIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: testIds } } });
    await prisma.authToken.deleteMany({ where: { userId: { in: testIds } } });
    await prisma.screeningLog.deleteMany({ where: { screenerId: { in: testIds } } });
    await prisma.interviewScorecard.deleteMany({ where: { interviewerId: { in: testIds } } });
    await prisma.interviewAttendee.deleteMany({ where: { userId: { in: testIds } } });
    await prisma.offerApproval.deleteMany({ where: { approverUserId: { in: testIds } } });
    await prisma.hiringCaseApproval.deleteMany({ where: { approverUserId: { in: testIds } } });
    await prisma.hiringCase.deleteMany({ where: { ownerUserId: { in: testIds } } });
    await prisma.candidateDocument.updateMany({ where: { uploadedById: { in: testIds } }, data: { uploadedById: adminUser.id } });
    await prisma.candidateImportJob.updateMany({ where: { uploadedById: { in: testIds } }, data: { uploadedById: adminUser.id } });
    await prisma.task.deleteMany({ where: { OR: [{ createdById: { in: testIds } }, { assigneeUserId: { in: testIds } }] } });
    await prisma.vacancyRequestApproval.updateMany({ where: { assigneeUserId: { in: testIds } }, data: { assigneeUserId: adminUser.id } });
    await prisma.vacancyRequest.updateMany({ where: { requesterId: { in: testIds } }, data: { requesterId: adminUser.id } });

    const deletedArtifacts = await prisma.user.deleteMany({ where: { id: { in: testIds } } });
    console.log(`Successfully removed ${deletedArtifacts.count} test run artifact users.`);
  }

  // Also clean up any lingering test invitees
  await prisma.authToken.deleteMany({ where: { user: { email: { contains: 'invite' } } } });
  await prisma.userRole.deleteMany({ where: { user: { email: { contains: 'invite' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'invite' } } });

  // 6. Verify remaining users
  const remainingUsers = await prisma.user.findMany({
    include: {
      userRoles: { include: { role: true } },
    },
    orderBy: { email: 'asc' },
  });

  console.log('\n--- ACTIVE SYSTEM USERS ---');
  for (const u of remainingUsers) {
    const roleCodes = u.userRoles.map((r) => r.role.code).join(', ') || 'NO_ROLE';
    console.log(`- ${u.email} | ${u.displayName} | [${roleCodes}]`);
  }
}

main()
  .catch((e) => {
    console.error('Error executing script:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
