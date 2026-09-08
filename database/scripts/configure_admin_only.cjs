const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('../generated/client');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const ORGANIZATION_CODE = process.env.RECRUITFLOW_ORGANIZATION_CODE || 'RECRUITFLOW-DEMO';
const ADMIN_EMAIL = (process.env.RECRUITFLOW_ADMIN_EMAIL || 'admin@me.com').toLowerCase();

async function main() {
  const organization = await prisma.organization.findFirst({ where: { code: ORGANIZATION_CODE } });
  if (!organization) throw new Error(`Organization ${ORGANIZATION_CODE} was not found.`);

  const adminRole = await prisma.role.findUnique({ where: { code: 'ADMINISTRATOR' } });
  if (!adminRole) throw new Error('ADMINISTRATOR role was not found. Run the normal database seed first.');

  let admin = await prisma.user.findFirst({
    where: { organizationId: organization.id, emailNormalized: ADMIN_EMAIL },
  });
  if (!admin) {
    admin = await prisma.user.findFirst({
      where: {
        organizationId: organization.id,
        userRoles: { some: { roleId: adminRole.id } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!admin) throw new Error('No administrator account exists for the target organization.');

  const result = await prisma.$transaction(async (tx) => {
    const otherUsers = await tx.user.findMany({
      where: { organizationId: organization.id, id: { not: admin.id } },
      select: { id: true },
    });

    // Keep business/audit history intact. Revoke all access and hide inactive
    // accounts from the normal user directory instead of deleting rows that may
    // be referenced by historical workflow records.
    if (otherUsers.length > 0) {
      const ids = otherUsers.map((user) => user.id);
      await tx.authToken.deleteMany({ where: { userId: { in: ids } } });
      await tx.userRole.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.updateMany({
        where: { id: { in: ids } },
        data: { status: 'Inactive', tokenVersion: { increment: 1 } },
      });
    }

    await tx.userRole.deleteMany({ where: { userId: admin.id, roleId: { not: adminRole.id } } });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      create: { userId: admin.id, roleId: adminRole.id },
      update: {},
    });
    await tx.user.update({
      where: { id: admin.id },
      data: { status: 'Active', email: ADMIN_EMAIL, emailNormalized: ADMIN_EMAIL },
    });

    const customRoles = await tx.role.findMany({
      where: { organizationId: organization.id },
      select: { id: true },
    });
    if (customRoles.length > 0) {
      const roleIds = customRoles.map((role) => role.id);
      await tx.userRole.deleteMany({ where: { roleId: { in: roleIds } } });
      await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
      await tx.role.deleteMany({ where: { id: { in: roleIds } } });
    }

    // Remove tenant-local permission definitions. Shared permission definitions
    // remain as the administrator's reusable natural-access catalog.
    const customPermissions = await tx.permission.findMany({
      where: { organizationId: organization.id },
      select: { id: true },
    });
    if (customPermissions.length > 0) {
      const permissionIds = customPermissions.map((permission) => permission.id);
      await tx.rolePermission.deleteMany({ where: { permissionId: { in: permissionIds } } });
      await tx.permission.deleteMany({ where: { id: { in: permissionIds } } });
    }

    const permissions = await tx.permission.findMany({ select: { id: true } });
    for (const permission of permissions) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id },
        },
        create: { roleId: adminRole.id, permissionId: permission.id },
        update: {},
      });
    }

    const catalogPayload = {
      visibleRoleCodes: ['ADMINISTRATOR'],
      roleNameOverrides: {},
    };
    const catalog = await tx.integration.findFirst({
      where: { organizationId: organization.id, name: 'ACCESS_CONTROL_CATALOG' },
      select: { id: true },
    });
    if (catalog) {
      await tx.integration.update({
        where: { id: catalog.id },
        data: { configJson: catalogPayload, status: 'Active', lastSyncAt: new Date() },
      });
    } else {
      await tx.integration.create({
        data: {
          organizationId: organization.id,
          name: 'ACCESS_CONTROL_CATALOG',
          provider: 'INTERNAL_ACCESS_CONTROL',
          category: 'SECURITY',
          status: 'Active',
          configJson: catalogPayload,
          lastSyncAt: new Date(),
        },
      });
    }

    return {
      adminId: admin.id,
      deactivatedUsers: otherUsers.length,
      removedCustomRoles: customRoles.length,
      removedCustomPermissions: customPermissions.length,
      retainedPermissionCatalog: permissions.length,
    };
  }, { timeout: 60000 });

  console.log(JSON.stringify({ organization: organization.code, adminEmail: ADMIN_EMAIL, ...result }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

