const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@recruitflow/database');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { code: 'RECRUITFLOW-DEMO' },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000001',
        code: 'RECRUITFLOW-DEMO',
        name: 'RecruitFlow Demo Organization',
      },
    });

    const legalEntity = await transaction.legalEntity.upsert({
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

    const branch = await transaction.branch.upsert({
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

    const position = await transaction.position.upsert({
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

    const user = await transaction.user.upsert({
      where: {
        organizationId_emailNormalized: {
          organizationId: organization.id,
          emailNormalized: 'ahmed.mohamed@recruitflow.local',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000004',
        organizationId: organization.id,
        email: 'ahmed.mohamed@recruitflow.local',
        emailNormalized: 'ahmed.mohamed@recruitflow.local',
        displayName: 'Ahmed Mohamed',
      },
    });

    const role = await transaction.role.upsert({
      where: { code: 'RECRUITMENT_ADMIN' },
      update: {},
      create: {
        code: 'RECRUITMENT_ADMIN',
        name: 'Recruitment Administrator',
      },
    });

    const permission = await transaction.permission.upsert({
      where: { code: 'VACANCY_REQUEST_APPROVE' },
      update: {},
      create: {
        code: 'VACANCY_REQUEST_APPROVE',
        description: 'Approve vacancy requests in the workflow.',
      },
    });

    await transaction.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: role.id },
      },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    await transaction.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });

    return { organization, legalEntity, branch, position, user };
  });

  console.log(
    JSON.stringify({
      seeded: true,
      organizationId: result.organization.id,
      branchId: result.branch.id,
      positionId: result.position.id,
      requesterId: result.user.id,
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
