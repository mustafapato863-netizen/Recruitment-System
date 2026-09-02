import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Retrieves the tenantId (organizationId) that was attached by TenantContextMiddleware.
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
