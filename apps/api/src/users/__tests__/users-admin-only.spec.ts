import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

// See users-password.spec.ts: stub the ungenerated Prisma client entry so
// the import in prisma.service.ts resolves. The guard under test receives a
// mocked PrismaService; this stub is never instantiated.
vi.mock('@recruitflow/database', () => ({
  PrismaClient: class MockPrismaClient {
    async $disconnect(): Promise<void> {}
  },
}));

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { PrismaService } from '../../database/prisma.service';
import { UsersController } from '../users.controller';

function prismaWith(roleCode: string, permissions: string[]) {
  return {
    user: {
      findUnique: async () => ({
        userRoles: [{ role: { code: roleCode, permissions: permissions.map((code) => ({ permission: { code } })) } }],
      }),
    },
  } as unknown as PrismaService;
}

function ctx(cls: { prototype: object }, method: string): ExecutionContext {
  const handler = (cls.prototype as Record<string, unknown>)[method];
  const req = { tenantId: 'org', user: { userId: 'u', organizationId: 'org' } };
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => cls } as unknown as ExecutionContext;
}

const manage: Array<[{ prototype: object }, string]> = [
  [UsersController, 'create'],
  [UsersController, 'adminChangePassword'],
];

describe('User creation and admin password change are admin-only', () => {
  it.each(manage)('%o.%s: 403 for a non-admin holding USERS_MANAGE, allowed for admins', async (cls, method) => {
    await expect(
      new PermissionsGuard(new Reflector(), prismaWith('TALENT_MANAGER', ['USERS_MANAGE'])).canActivate(ctx(cls, method)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new PermissionsGuard(new Reflector(), prismaWith('ADMINISTRATOR', [])).canActivate(ctx(cls, method)),
    ).resolves.toBe(true);
  });

  it.each(manage)('%o.%s: 403 for a non-admin without the permission', async (cls, method) => {
    await expect(
      new PermissionsGuard(new Reflector(), prismaWith('RECRUITER', [])).canActivate(ctx(cls, method)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
