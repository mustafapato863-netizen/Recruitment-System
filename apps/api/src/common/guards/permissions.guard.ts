import { Injectable, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * Guard that checks required permissions and ensures the request tenant matches the
 * authenticated user's organizationId. It loads the user with roles scoped to the tenant.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyPermissions = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredPermissions || requiredPermissions.length === 0) && (!anyPermissions || anyPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.userId) {
      throw new ForbiddenException('Access denied: unauthenticated request cannot access restricted resource');
    }

    // Ensure request tenant (set by a tenant guard or after JWT validation) matches the user's organization
    if (request.tenantId && request.tenantId !== user.organizationId) {
      throw new ForbiddenException('Access denied: tenant mismatch');
    }

    // Load the user with roles, scoped to the tenant
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.userId, organizationId: user.organizationId, status: 'Active' },
      include: {
        userRoles: {
          where: { role: { status: 'Active' } },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      throw new ForbiddenException('Access denied: user record is inactive or missing');
    }

    const userPermissions = userWithRoles.userRoles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );

    const hasAllPermissions = (requiredPermissions ?? []).every((p) => userPermissions.includes(p));
    const hasAnyPermission = !anyPermissions || anyPermissions.length === 0
      ? true
      : anyPermissions.some((p) => userPermissions.includes(p));
    if (!hasAllPermissions || !hasAnyPermission) {
      throw new ForbiddenException('Access denied: insufficient permissions to perform this action');
    }

    return true;
  }
}
