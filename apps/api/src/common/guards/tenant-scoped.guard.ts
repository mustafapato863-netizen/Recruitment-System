import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Request } from 'express';
import { isUuid } from '../validation/is-uuid';
import { TENANT_RESOURCE_POLICIES } from './tenant-resource-policies';

/** Route params whose values are database UUIDs, including nested ids. */
const UUID_PARAM_NAME = /^(?:id|.+Id)$/;

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
 * - Malformed UUID route params are rejected with HTTP 400 before any database read.
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

    const params = req.params ?? {};
    const namesToCheck = new Set<string>([param]);
    for (const name of Object.keys(params)) {
      if (UUID_PARAM_NAME.test(name)) namesToCheck.add(name);
    }

    const invalidFields: Record<string, string[]> = {};
    for (const name of namesToCheck) {
      const value = firstParam(params[name]);
      if (value && !isUuid(value)) {
        invalidFields[name] = ['A valid identifier is required.'];
      }
    }
    if (Object.keys(invalidFields).length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields.',
        fields: invalidFields,
      });
    }

    const id = firstParam(params[param]);
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

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
