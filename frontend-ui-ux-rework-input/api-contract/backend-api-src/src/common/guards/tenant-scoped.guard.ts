import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Request } from 'express';
import { TENANT_RESOURCE_POLICIES } from './tenant-resource-policies';

/**
 * M1-G4 Tenant-Scoped Guard
 *
 * Validates that a resource identified by a route parameter belongs to the
 * authenticated user's tenant. Uses a typed policy registry instead of
 * dynamic Prisma model access.
 *
 * Usage:
 *   @UseGuards(TenantScopedGuard)
 *   @TenantResource({ resource: 'candidate', param: 'id' })
 *
 * Behavior:
 * - If `resource` is not in the policy registry → ForbiddenException (fail closed).
 * - If the record does not exist or belongs to another tenant → NotFoundException (safe 404).
 * - If tenantId is not set on the request → ForbiddenException.
 */
@Injectable()
export class TenantScopedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & { tenantId?: string } = context.switchToHttp().getRequest();
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Access denied: tenant context missing');
    }

    const resourceMeta = this.reflector.get<{ resource: string; param: string }>(
      'TENANT_RESOURCE',
      context.getHandler(),
    );

    if (!resourceMeta) {
      // No tenant resource metadata on this route — guard does nothing.
      return true;
    }

    const { resource, param } = resourceMeta;

    // Fail closed: reject unsupported/unmapped resources.
    const verifier = TENANT_RESOURCE_POLICIES[resource];
    if (!verifier) {
      throw new ForbiddenException(
        `Access denied: resource '${resource}' is not configured for tenant verification`,
      );
    }

    const rawId = req.params?.[param];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      throw new NotFoundException('Resource identifier not provided');
    }

    const result = await verifier(this.prisma, id, tenantId);

    if (!result.exists || !result.belongsToTenant) {
      // Safe 404 — do not reveal whether the record exists in another tenant.
      throw new NotFoundException('Resource not found');
    }

    return true;
  }
}
