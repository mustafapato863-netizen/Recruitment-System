import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

/**
 * Resolves the effective permission codes for a user within their organization.
 * Mirrors the query shape of PermissionsGuard so runtime enforcement and
 * field-level disclosure decisions always agree.
 */
@Injectable()
export class UserPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionSet(userId: string, organizationId: string): Promise<Set<string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, organizationId, status: 'Active' },
      select: {
        userRoles: {
          where: { role: { status: 'Active' } },
          select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
        },
      },
    });

    const codes = new Set<string>();
    for (const userRole of user?.userRoles ?? []) {
      for (const rolePermission of userRole.role.permissions) {
        codes.add(rolePermission.permission.code);
      }
    }
    return codes;
  }

  async hasPermission(userId: string, organizationId: string, code: string): Promise<boolean> {
    const codes = await this.getPermissionSet(userId, organizationId);
    return codes.has(code);
  }
}
