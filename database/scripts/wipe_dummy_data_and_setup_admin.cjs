const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('../generated/client');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

// bcryptjs hash of "Admin@123456" with cost factor 10
const ADMIN_PASSWORD_HASH = '$2b$10$P2RMg2wMHHLu0c/Otxhgs.g9INmY5py4vqAcw/wrH9ToeLXJyiuG6';

async function main() {
  console.log('===============================================================');
  console.log('=== WIPING FULL DUMMY DATA & SETTING UP SINGLE ADMIN USER ===');
  console.log('===============================================================\n');

  await prisma.$transaction(async (tx) => {
    // 1. Delete all transactional recruitment workflow records in FK dependency order
    console.log('Step 1: Deleting dummy recruitment and hiring records...');

    await tx.complianceRequirement.deleteMany({});
    console.log('  - Cleared ComplianceRequirement');

    await tx.hiringCaseApproval.deleteMany({});
    console.log('  - Cleared HiringCaseApproval');

    await tx.hiringCase.deleteMany({});
    console.log('  - Cleared HiringCase');

    await tx.offerApproval.deleteMany({});
    console.log('  - Cleared OfferApproval');

    await tx.offer.deleteMany({});
    console.log('  - Cleared Offer');

    await tx.interviewScorecard.deleteMany({});
    console.log('  - Cleared InterviewScorecard');

    await tx.interviewAttendee.deleteMany({});
    console.log('  - Cleared InterviewAttendee');

    await tx.interview.deleteMany({});
    console.log('  - Cleared Interview');

    await tx.screeningLog.deleteMany({});
    console.log('  - Cleared ScreeningLog');

    await tx.applicationNote.deleteMany({});
    console.log('  - Cleared ApplicationNote');

    await tx.applicationStatusHistory.deleteMany({});
    console.log('  - Cleared ApplicationStatusHistory');

    await tx.application.deleteMany({});
    console.log('  - Cleared Application');

    await tx.candidateDocument.deleteMany({});
    console.log('  - Cleared CandidateDocument');

    await tx.candidateImportJob.deleteMany({});
    console.log('  - Cleared CandidateImportJob');

    await tx.talentPoolCandidate.deleteMany({});
    console.log('  - Cleared TalentPoolCandidate');

    await tx.talentPool.deleteMany({});
    console.log('  - Cleared TalentPool');

    await tx.candidate.deleteMany({});
    console.log('  - Cleared Candidate');

    await tx.vacancyAssignment.deleteMany({});
    console.log('  - Cleared VacancyAssignment');

    await tx.vacancy.deleteMany({});
    console.log('  - Cleared Vacancy');

    await tx.vacancyRequestApproval.deleteMany({});
    console.log('  - Cleared VacancyRequestApproval');

    await tx.vacancyRequest.deleteMany({});
    console.log('  - Cleared VacancyRequest');

    await tx.task.deleteMany({});
    console.log('  - Cleared Task');

    await tx.notification.deleteMany({});
    console.log('  - Cleared Notification');

    await tx.emailOutbox.deleteMany({});
    console.log('  - Cleared EmailOutbox');

    await tx.authToken.deleteMany({});
    console.log('  - Cleared AuthToken');

    // 2. Reset code sequences so real data starts with clean sequence numbers (e.g. VR-2026-0001)
    console.log('\nStep 2: Resetting code sequences...');
    await tx.codeSequence.updateMany({
      data: { lastIssued: 0 },
    });
    console.log('  - Reset all CodeSequence counters to 0');

    // 3. Ensure primary Organization exists
    console.log('\nStep 3: Ensuring primary organization...');
    let org = await tx.organization.findFirst({
      where: {
        OR: [
          { code: 'SGH' },
          { code: 'RECRUITFLOW-DEMO' },
        ],
      },
    });

    if (!org) {
      org = await tx.organization.create({
        data: {
          id: '10000000-0000-4000-8000-000000000001',
          code: 'SGH',
          name: 'Saudi German Health',
          status: 'Active',
        },
      });
    } else {
      org = await tx.organization.update({
        where: { id: org.id },
        data: {
          name: 'Saudi German Health',
          status: 'Active',
        },
      });
    }
    console.log(`  - Organization ready: ${org.name} (ID: ${org.id}, Code: ${org.code})`);

    // 4. Ensure ADMINISTRATOR role exists and has all permissions
    console.log('\nStep 4: Ensuring ADMINISTRATOR role and permissions...');
    let adminRole = await tx.role.findFirst({
      where: { code: 'ADMINISTRATOR' },
    });

    if (!adminRole) {
      adminRole = await tx.role.create({
        data: {
          code: 'ADMINISTRATOR',
          name: 'Administrator',
          status: 'Active',
        },
      });
    }

    const allPermissions = await tx.permission.findMany();
    for (const perm of allPermissions) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
    console.log(`  - Assigned ${allPermissions.length} permissions to ADMINISTRATOR role`);

    // 5. Delete all demo users and user roles
    console.log('\nStep 5: Removing all demo users...');
    await tx.userRole.deleteMany({});
    const deletedUsers = await tx.user.deleteMany({
      where: {
        emailNormalized: { not: 'admin@me.com' },
      },
    });
    console.log(`  - Removed ${deletedUsers.count} demo/test users`);

    // 6. Create or update single admin user "admin@me.com"
    console.log('\nStep 6: Creating admin user "admin@me.com"...');
    const adminUser = await tx.user.upsert({
      where: {
        organizationId_emailNormalized: {
          organizationId: org.id,
          emailNormalized: 'admin@me.com',
        },
      },
      update: {
        email: 'admin@me.com',
        emailNormalized: 'admin@me.com',
        displayName: 'System Administrator',
        passwordHash: ADMIN_PASSWORD_HASH,
        status: 'Active',
        emailVerifiedAt: new Date(),
        tokenVersion: 0,
      },
      create: {
        id: '10000000-0000-4000-8000-000000000000',
        organizationId: org.id,
        email: 'admin@me.com',
        emailNormalized: 'admin@me.com',
        displayName: 'System Administrator',
        passwordHash: ADMIN_PASSWORD_HASH,
        status: 'Active',
        emailVerifiedAt: new Date(),
        tokenVersion: 0,
      },
    });
    console.log(`  - Created/Verified Admin User: ${adminUser.email} (ID: ${adminUser.id})`);

    // Assign ADMINISTRATOR role to admin@me.com
    await tx.userRole.upsert({
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
    console.log(`  - Assigned ADMINISTRATOR role to ${adminUser.email}`);

    // 7. Seed default RLS Access Control Policy in Integration table
    console.log('\nStep 7: Initializing RLS Data Governance Policy...');
    const defaultRlsConfig = {
      roles: {
        ADMINISTRATOR: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: true,
          canDownloadDocs: true,
          canApprove: true,
        },
        TALENT_MANAGER: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: true,
          canDownloadDocs: true,
          canApprove: true,
        },
        HR_MANAGER: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: true,
          canDownloadDocs: true,
          canApprove: true,
        },
        RECRUITER: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: false,
          canDownloadDocs: true,
          canApprove: false,
        },
        HIRING_MANAGER: {
          dataScope: 'DEPARTMENT',
          canViewPii: false,
          canViewSalary: false,
          canDownloadDocs: false,
          canApprove: true,
        },
        INTERVIEWER: {
          dataScope: 'ASSIGNED_ONLY',
          canViewPii: false,
          canViewSalary: false,
          canDownloadDocs: false,
          canApprove: false,
        },
        HR_OPERATIONS: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: false,
          canDownloadDocs: true,
          canApprove: false,
        },
        LICENSE_SPECIALIST: {
          dataScope: 'ALL',
          canViewPii: false,
          canViewSalary: false,
          canDownloadDocs: true,
          canApprove: false,
        },
        OFFER_APPROVER: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: true,
          canDownloadDocs: true,
          canApprove: true,
        },
        FINAL_HIRING_APPROVER: {
          dataScope: 'ALL',
          canViewPii: true,
          canViewSalary: true,
          canDownloadDocs: true,
          canApprove: true,
        },
        VIEWER: {
          dataScope: 'ALL',
          canViewPii: false,
          canViewSalary: false,
          canDownloadDocs: false,
          canApprove: false,
        },
      },
      userOverrides: {},
    };

    const existingRls = await tx.integration.findFirst({
      where: {
        organizationId: org.id,
        name: 'RLS_ACCESS_POLICY',
      },
    });

    if (existingRls) {
      await tx.integration.update({
        where: { id: existingRls.id },
        data: {
          configJson: defaultRlsConfig,
          status: 'Active',
          lastSyncAt: new Date(),
        },
      });
    } else {
      await tx.integration.create({
        data: {
          organizationId: org.id,
          name: 'RLS_ACCESS_POLICY',
          provider: 'INTERNAL_RLS',
          category: 'SECURITY',
          status: 'Active',
          configJson: defaultRlsConfig,
          lastSyncAt: new Date(),
        },
      });
    }
    console.log('  - Initialized RLS Policy in Integration table');
  }, { timeout: 60000 });

  console.log('\n===============================================================');
  console.log('=== DATABASE RESET COMPLETED SUCCESSFULLY! ===');
  console.log('Admin Email:    admin@me.com');
  console.log('Admin Password: Admin@123456');
  console.log('Role:           ADMINISTRATOR (Full Privileges)');
  console.log('All dummy applications, candidates, and vacancies removed.');
  console.log('===============================================================\n');
}

main()
  .catch((e) => {
    console.error('Error during wipe and setup:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
