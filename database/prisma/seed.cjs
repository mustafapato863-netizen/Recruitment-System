const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@recruitflow/database');
const { seedDemoFixtures } = require('./demo-fixtures.cjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// bcryptjs hash of the local seed password ('Password123!') with cost factor 10
const DEFAULT_PASSWORD_HASH = '$2b$10$dd0OAfjCvUL/waxTy79xZe0H7QN3r7oEbPPKJ9dwg97.y70rZgep6';

const prisma = new PrismaClient();

async function resyncCodeSequences() {
  const year = new Date().getUTCFullYear();
  const sequenceDefinitions = [
    { key: `CND:${year}`, model: 'candidate', codeField: 'candidateCode', prefix: 'CND' },
    { key: `APP:${year}`, model: 'application', codeField: 'applicationCode', prefix: 'APP' },
    { key: `INT:${year}`, model: 'interview', codeField: 'interviewCode', prefix: 'INT' },
    { key: `OFF:${year}`, model: 'offer', codeField: 'offerCode', prefix: 'OFF' },
    { key: `VR:${year}`, model: 'vacancyRequest', codeField: 'requestCode', prefix: 'VR' },
    { key: `VAC:${year}`, model: 'vacancy', codeField: 'vacancyCode', prefix: 'VAC' },
  ];

  for (const { key, model, codeField, prefix } of sequenceDefinitions) {
    const records = await prisma[model].findMany({ select: { [codeField]: true } });
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    const maxSeq = records.reduce((max, record) => {
      const match = String(record[codeField] ?? '').match(pattern);
      return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
    }, 0);

    if (maxSeq > 0) {
      await prisma.codeSequence.upsert({
        where: { key },
        create: { key, lastIssued: maxSeq },
        update: { lastIssued: maxSeq },
      });
    }
  }
}

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
        id: '10000000-0000-4000-8000-000000000008',
        email: 'tarek.audit@recruitflow.local',
        displayName: 'Tarek Nabil',
      },
      {
        id: '10000000-0000-4000-8000-000000000009',
        email: 'mona.manager@recruitflow.local',
        displayName: 'Mona El-Sayed',
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
      // System Administrator
      {
        id: '10000000-0000-4000-8000-000000000000',
        email: 'admin@sgh.com',
        displayName: 'System Administrator',
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
      { code: 'PERFORMANCE_ADMIN', name: 'Performance Admin' },
      { code: 'TALENT_MANAGER', name: 'Talent Manager' },
      { code: 'RECRUITER', name: 'Recruiter' },
      { code: 'HR_MANAGER', name: 'HR Manager' },
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
      PERFORMANCE_ADMIN: [
        'VACANCY_REQUEST_VIEW',
        'VACANCY_VIEW',
        'CANDIDATE_VIEW',
        'APPLICATION_VIEW',
        'MASTER_DATA_VIEW',
        'AUDIT_VIEW',
        'NOTIFICATION_VIEW',
      ],
      TALENT_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW', 'VACANCY_MANAGE',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'VIEW_CURRENT_SALARY', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      RECRUITER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
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
      'tarek.audit@recruitflow.local': 'PERFORMANCE_ADMIN',
      'mona.manager@recruitflow.local': 'TALENT_MANAGER',
      'sarah.ahmed@recruitflow.local': 'RECRUITER',
      'hassan.ali@recruitflow.local': 'HIRING_MANAGER',
      'aya.mostafa@recruitflow.local': 'FINAL_HIRING_APPROVER',
      'omar.nasser@recruitflow.local': 'LICENSE_SPECIALIST',
      'admin@sgh.com': 'ADMINISTRATOR',
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
      { code: 'C001', firstName: 'John', lastName: 'Doe', email: 'john@demo.com', phone: '1234', currentTitle: 'Frontend Dev', currentCompany: 'A', source: 'Web' },
      { code: 'C002', firstName: 'Jane', lastName: 'Ali', email: 'jane@demo.com', phone: '1234', currentTitle: 'Backend Dev', currentCompany: 'B', source: 'Web' },
      { code: 'C003', firstName: 'Omar', lastName: 'Sam', email: 'omar@demo.com', phone: '1234', currentTitle: 'DevOps Eng', currentCompany: 'C', source: 'Web' },
      { code: 'C004', firstName: 'Sara', lastName: 'Kim', email: 'sara@demo.com', phone: '1234', currentTitle: 'QA Engineer', currentCompany: 'D', source: 'Web' },
      { code: 'C005', firstName: 'Adam', lastName: 'Zaz', email: 'adam@demo.com', phone: '1234', currentTitle: 'Product Mgr', currentCompany: 'E', source: 'Web' },
      { code: 'C006', firstName: 'Dina', lastName: 'Baz', email: 'dina@demo.com', phone: '1234', currentTitle: 'UI Designer', currentCompany: 'F', source: 'Web' },
    ];

    for (let i = 0; i < candidateSeed.length; i++) {
      const c = candidateSeed[i];
      const candId = `10000000-0000-4000-9000-00000000000${i+1}`;
      const cand = await tx.candidate.upsert({
        where: { organizationId_email: { organizationId: organization.id, email: c.email } },
        update: { firstName: c.firstName, lastName: c.lastName, currentTitle: c.currentTitle },
        create: {
          id: candId,
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

      // Add dummy CV document
      const docId = `20000000-0000-4000-9000-00000000000${i+1}`;
      const existingDoc = await tx.candidateDocument.findUnique({ where: { id: docId } });
      if (!existingDoc) {
        await tx.candidateDocument.create({
          data: {
            id: docId,
            organizationId: organization.id,
            candidateId: cand.id,
            documentType: 'CV',
            fileName: `${c.firstName}_CV.pdf`,
            fileSize: 102400,
            mimeType: 'application/pdf',
            storageKey: `cvs/${organization.id}/${cand.id}/cv.pdf`,
            storageProvider: 'local-private',
            scanStatus: 'Clean',
            consentStatus: 'Active',
          }
        });
      }
    }

    const demo = await seedDemoFixtures(tx, { organization, legalEntity, branch, position, users });

    // ── Organization B (for Cross-Tenant Isolation Testing) ─────
    const orgB = await tx.organization.upsert({
      where: { code: 'ACME-CORP' },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000001',
        code: 'ACME-CORP',
        name: 'Acme Global Healthcare',
      },
    });

    const legalEntityB = await tx.legalEntity.upsert({
      where: { organizationId_code: { organizationId: orgB.id, code: 'ACME-HQ' } },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000005',
        organizationId: orgB.id,
        code: 'ACME-HQ',
        name: 'Acme Head Office',
      },
    });

    const branchB = await tx.branch.upsert({
      where: { legalEntityId_code: { legalEntityId: legalEntityB.id, code: 'ACME-ALEX' } },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000002',
        organizationId: orgB.id,
        legalEntityId: legalEntityB.id,
        code: 'ACME-ALEX',
        name: 'Alexandria Medical Branch',
        city: 'Alexandria',
      },
    });

    const positionB = await tx.position.upsert({
      where: { organizationId_code: { organizationId: orgB.id, code: 'MED-DIR' } },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000003',
        organizationId: orgB.id,
        legalEntityId: legalEntityB.id,
        code: 'MED-DIR',
        title: 'Medical Director',
      },
    });

    const userB = await tx.user.upsert({
      where: { id: '20000000-0000-4000-8000-000000000004' },
      update: { passwordHash: DEFAULT_PASSWORD_HASH },
      create: {
        id: '20000000-0000-4000-8000-000000000004',
        organizationId: orgB.id,
        email: 'tarek.kamal@acme-health.local',
        emailNormalized: 'tarek.kamal@acme-health.local',
        passwordHash: DEFAULT_PASSWORD_HASH,
        displayName: 'Tarek Kamal',
        status: 'Active',
      },
    });

    // Assign roles to User B
    const adminRole = roles['ADMINISTRATOR'];
    if (adminRole) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: userB.id, roleId: adminRole.id } },
        update: {},
        create: { userId: userB.id, roleId: adminRole.id },
      });
    }

    const candidateB = await tx.candidate.upsert({
      where: { organizationId_email: { organizationId: orgB.id, email: 'mona.zaki@example.com' } },
      update: { firstName: 'Mona', lastName: 'Zaki' },
      create: {
        id: '20000000-0000-4000-8000-000000000020',
        organizationId: orgB.id,
        candidateCode: 'CND-ACME-001',
        firstName: 'Mona',
        lastName: 'Zaki',
        email: 'mona.zaki@example.com',
        phone: '+201099887766',
        currentTitle: 'Chief Medical Officer',
        currentCompany: 'Alex Hospital',
        source: 'Executive Search',
        status: 'Active',
      },
    });

    return { organization, legalEntity, branch, position, users, roles, demo, orgB, userB, candidateB, branchB };
  }, { timeout: 30000 });

  await resyncCodeSequences();

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
