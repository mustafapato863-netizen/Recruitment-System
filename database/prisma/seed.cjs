const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@recruitflow/database');
const { seedDemoFixtures } = require('./demo-fixtures.cjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// bcryptjs hash of the local seed password with cost factor 10
// Pre-computed to avoid requiring bcryptjs in the seed script.
const DEFAULT_PASSWORD_HASH = '$2b$10$1YF2d.BurlPR9CzQravUWuqurUfHyhpGLe5yAW13nWRf7gCC6raDe';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // ── Organization ──────────────────────────────────────────
    const organization = await tx.organization.upsert({
      where: { code: 'RECRUITFLOW-DEMO' },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000001',
        code: 'RECRUITFLOW-DEMO',
        name: 'RecruitFlow Demo Organization',
      },
    });

    // ── Legal Entity ──────────────────────────────────────────
    const legalEntity = await tx.legalEntity.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'HQ',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000005',
        organizationId: organization.id,
        code: 'HQ',
        name: 'RecruitFlow Head Office',
      },
    });

    // ── Branch ────────────────────────────────────────────────
    const branch = await tx.branch.upsert({
      where: {
        legalEntityId_code: {
          legalEntityId: legalEntity.id,
          code: 'HEAD-OFFICE',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000002',
        organizationId: organization.id,
        legalEntityId: legalEntity.id,
        code: 'HEAD-OFFICE',
        name: 'Head Office',
        city: 'Cairo',
      },
    });

    // ── Position ──────────────────────────────────────────────
    const position = await tx.position.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'SSE',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000003',
        organizationId: organization.id,
        legalEntityId: legalEntity.id,
        code: 'SSE',
        title: 'Senior Software Engineer',
      },
    });

    // ── Additional Positions ──────────────────────────────────
    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'SR-PHARM' } },
      update: {},
      create: {
        organizationId: organization.id,
        legalEntityId: legalEntity.id,
        code: 'SR-PHARM',
        title: 'Senior Pharmacist',
        description: 'Licensed pharmacist for retail pharmacy operations.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'FE-ENG' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'FE-ENG',
        title: 'Frontend Engineer',
        description: 'React/TypeScript frontend developer.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'HR-SPEC' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'HR-SPEC',
        title: 'HR Specialist',
        description: 'Human resources operations specialist.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'SALES-EXEC' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'SALES-EXEC',
        title: 'Sales Executive',
        description: 'Field sales and business development.',
      },
    });

    // ── Users (matching reference screen 39) ──────────────────
    const users = {};

    const userSeed = [
      {
        id: '10000000-0000-4000-8000-000000000004',
        email: 'ahmed.mahmoud@recruitflow.local',
        displayName: 'Ahmed Mahmoud',
      },
      {
        id: '10000000-0000-4000-8000-000000000010',
        email: 'sarah.ahmed@recruitflow.local',
        displayName: 'Sarah Ahmed',
      },
      {
        id: '10000000-0000-4000-8000-000000000011',
        email: 'hassan.ali@recruitflow.local',
        displayName: 'Dr. Hassan Ali',
      },
      {
        id: '10000000-0000-4000-8000-000000000012',
        email: 'aya.mostafa@recruitflow.local',
        displayName: 'Aya Mostafa',
      },
      {
        id: '10000000-0000-4000-8000-000000000013',
        email: 'omar.nasser@recruitflow.local',
        displayName: 'Omar Nasser',
      },
    ];

    for (const u of userSeed) {
      users[u.email] = await tx.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          emailNormalized: u.email,
          displayName: u.displayName,
          passwordHash: DEFAULT_PASSWORD_HASH,
        },
        create: {
          id: u.id,
          organizationId: organization.id,
          email: u.email,
          emailNormalized: u.email,
          displayName: u.displayName,
          passwordHash: DEFAULT_PASSWORD_HASH,
        },
      });
    }

    // ── Roles (matching reference screen 39) ──────────────────
    const roles = {};

    const roleSeed = [
      { code: 'ADMINISTRATOR', name: 'Administrator' },
      { code: 'HR_MANAGER', name: 'HR Manager' },
      { code: 'RECRUITER', name: 'Recruiter' },
      { code: 'HIRING_MANAGER', name: 'Hiring Manager' },
      { code: 'INTERVIEWER', name: 'Interviewer' },
      { code: 'HR_OPERATIONS', name: 'HR Operations' },
      { code: 'LICENSE_SPECIALIST', name: 'License Specialist' },
      { code: 'OFFER_APPROVER', name: 'Offer Approver' },
      { code: 'FINAL_HIRING_APPROVER', name: 'Final Hiring Approver' },
      { code: 'VIEWER', name: 'Viewer' },
    ];

    for (const r of roleSeed) {
      roles[r.code] = await tx.role.upsert({
        where: { code: r.code },
        update: { name: r.name },
        create: { code: r.code, name: r.name },
      });
    }

    // Remove old RECRUITMENT_ADMIN role if it still exists
    const oldRole = await tx.role.findUnique({ where: { code: 'RECRUITMENT_ADMIN' } });
    if (oldRole) {
      await tx.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
      await tx.userRole.deleteMany({ where: { roleId: oldRole.id } });
      await tx.role.delete({ where: { code: 'RECRUITMENT_ADMIN' } });
    }

    // ── Permissions ───────────────────────────────────────────
    const permissions = {};

    const permSeed = [
      // Vacancy
      { code: 'VACANCY_REQUEST_VIEW', description: 'View vacancy requests.' },
      { code: 'VACANCY_REQUEST_CREATE', description: 'Create vacancy requests.' },
      { code: 'VACANCY_REQUEST_APPROVE', description: 'Approve vacancy requests in the workflow.' },
      { code: 'VACANCY_VIEW', description: 'View vacancies.' },
      { code: 'VACANCY_MANAGE', description: 'Manage vacancies (activate, assign, hold, cancel).' },
      // Users & Roles
      { code: 'USERS_VIEW', description: 'View user list and details.' },
      { code: 'USERS_MANAGE', description: 'Create, edit, and deactivate users.' },
      { code: 'ROLES_VIEW', description: 'View roles and permissions.' },
      { code: 'ROLES_MANAGE', description: 'Create, edit roles and assign permissions.' },
      // Master Data
      { code: 'MASTER_DATA_VIEW', description: 'View master data (organizations, branches, positions).' },
      { code: 'MASTER_DATA_MANAGE', description: 'Create and edit master data records.' },
      // Audit
      { code: 'AUDIT_VIEW', description: 'View audit log entries.' },
      // Candidate & Application
      { code: 'CANDIDATE_VIEW', description: 'View candidate profile and list.' },
      { code: 'CANDIDATE_CREATE', description: 'Create candidate records.' },
      { code: 'CANDIDATE_EDIT', description: 'Edit candidate profile details.' },
      { code: 'APPLICATION_VIEW', description: 'View recruitment applications.' },
      { code: 'APPLICATION_CREATE', description: 'Apply candidate to a vacancy.' },
      { code: 'APPLICATION_MOVE_STAGE', description: 'Advance or move application stage.' },
      // Sensitive fields
      { code: 'VIEW_CANDIDATE_PII', description: 'View candidate personally identifiable information.' },
      { code: 'VIEW_CURRENT_SALARY', description: 'View candidate current salary details.' },
      { code: 'APPROVE_OFFERS', description: 'Approve offer packages and salary bands.' },
      { code: 'DOWNLOAD_DOCUMENTS', description: 'Download private candidate and hiring documents.' },
      { code: 'FINAL_HIRING_APPROVAL', description: 'Perform final hiring approval gate.' },
      { code: 'OVERRIDE_WORKFLOW', description: 'Override workflow rules and bypass validations.' },
      // Notifications & Tasks (Phase 10)
      { code: 'NOTIFICATION_VIEW', description: 'View own notifications and manage read status.' },
      { code: 'TASK_VIEW', description: 'View tasks assigned to the current user.' },
      { code: 'TASK_UPDATE_STATUS', description: 'Update the status of an assigned task.' },
    ];

    for (const p of permSeed) {
      permissions[p.code] = await tx.permission.upsert({
        where: { code: p.code },
        update: { description: p.description },
        create: { code: p.code, description: p.description },
      });
    }

    // ── Role → Permission assignments ─────────────────────────
    const rolePermMap = {
      ADMINISTRATOR: Object.keys(permissions), // Administrator gets everything
      HR_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW', 'VACANCY_MANAGE',
        'USERS_VIEW', 'USERS_MANAGE', 'ROLES_VIEW',
        'MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE',
        'AUDIT_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'VIEW_CURRENT_SALARY', 'APPROVE_OFFERS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      RECRUITER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      HIRING_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'APPLICATION_VIEW', 'APPLICATION_MOVE_STAGE',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      INTERVIEWER: [
        'VACANCY_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      HR_OPERATIONS: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'USERS_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      LICENSE_SPECIALIST: [
        'VACANCY_VIEW',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      OFFER_APPROVER: [
        'VACANCY_VIEW',
        'APPROVE_OFFERS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      FINAL_HIRING_APPROVER: [
        'VACANCY_VIEW',
        'FINAL_HIRING_APPROVAL',
        'VIEW_CANDIDATE_PII',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      VIEWER: [
        'VACANCY_REQUEST_VIEW',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW',
      ],
    };

    for (const [roleCode, permCodes] of Object.entries(rolePermMap)) {
      const role = roles[roleCode];
      if (!role) continue;
      for (const permCode of permCodes) {
        const permission = permissions[permCode];
        if (!permission) continue;
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }

    // ── User → Role assignments ───────────────────────────────
    const userRoleMap = {
      'ahmed.mahmoud@recruitflow.local': 'ADMINISTRATOR',
      'sarah.ahmed@recruitflow.local': 'RECRUITER',
      'hassan.ali@recruitflow.local': 'HIRING_MANAGER',
      'aya.mostafa@recruitflow.local': 'FINAL_HIRING_APPROVER',
      'omar.nasser@recruitflow.local': 'LICENSE_SPECIALIST',
    };

    for (const [email, roleCode] of Object.entries(userRoleMap)) {
      const user = users[email];
      const role = roles[roleCode];
      if (!user || !role) continue;
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    // ── Sample Candidates & Applications ─────────────────────
    const candidateSeed = [
      { code: 'CND-2026-001', firstName: 'Mariam', lastName: 'Farouk', email: 'mariam.farouk@example.com', phone: '+201001234567', currentTitle: 'Lead Frontend Developer', currentCompany: 'TechHub', source: 'LinkedIn' },
      { code: 'CND-2026-002', firstName: 'Kareem', lastName: 'Ezzat', email: 'kareem.ezzat@example.com', phone: '+201119876543', currentTitle: 'Senior React Specialist', currentCompany: 'DevCorp', source: 'Referral' },
      { code: 'CND-2026-003', firstName: 'Nour', lastName: 'Salem', email: 'nour.salem@example.com', phone: '+201225554433', currentTitle: 'UI/UX Designer & Engineer', currentCompany: 'DesignStudio', source: 'Job Portal' },
    ];

    for (const c of candidateSeed) {
      await tx.candidate.upsert({
        where: { organizationId_email: { organizationId: organization.id, email: c.email } },
        update: { firstName: c.firstName, lastName: c.lastName },
        create: {
          organizationId: organization.id,
          candidateCode: c.code,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          currentTitle: c.currentTitle,
          currentCompany: c.currentCompany,
          source: c.source,
          status: 'Active',
        },
      });
    }

    const demo = await seedDemoFixtures(tx, { organization, legalEntity, branch, position, users });
    return { organization, legalEntity, branch, position, users, roles, demo };
  }, { timeout: 30000 });

  console.log(
    JSON.stringify({
      seeded: true,
      organizationId: result.organization.id,
      branchId: result.branch.id,
      positionId: result.position.id,
      users: Object.keys(result.users).length,
      roles: Object.keys(result.roles).length,
      demo: result.demo,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
