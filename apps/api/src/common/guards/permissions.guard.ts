import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      // This guard is registered globally and can run before a route-level
      // JwtAuthGuard. Let the authentication guard reject anonymous requests;
      // permission checks continue only after a user has been attached.
      return true;
    }

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.userId, organizationId: user.organizationId, status: 'Active' },
      include: {
        userRoles: {
          where: { role: { status: 'Active' } },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      return false;
    }

    const userPermissions = userWithRoles.userRoles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.code)
    );

    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
