import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import { auditReasonFrom } from '../errors/error-normalizer';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const entity = auditEntityFor(this.reflector.get<{ resource: string; param: string } | undefined>('TENANT_RESOURCE', context.getHandler()), req);
    const bodyReason = auditBodyReason(req?.body);

    return next.handle().pipe(
      tap({
        next: () => {
          if (action && user) {
            this.prisma.auditLog.create({
              data: {
                action,
                actorUserId: user.userId,
                organizationId: user.organizationId,
                ...entity,
                result: 'SUCCESS',
                ...(bodyReason ? { reason: bodyReason } : {}),
              },
            }).catch(console.error);
          }
        },
        error: (err: Error) => {
          if (action && user) {
            // M1-G4: Always include organizationId on failure audit logs.
            // The organizationId comes from the verified JWT user, not from
            // client input, so it is safe to include on failures.
            this.prisma.auditLog.create({
              data: {
                action,
                actorUserId: user.userId,
                organizationId: user.organizationId,
                ...entity,
                result: 'FAILURE',
                reason: auditReasonFrom(err),
              },
            }).catch(console.error);
          }
        },
      }),
    );
  }
}

/**
 * B2F-7: tie the audit row to the resource the route acts on (from @TenantResource), e.g. Vacancy/<id>,
 * instead of system/none. Routes without that marker keep system/none.
 */
export function auditEntityFor(meta: { resource: string; param: string } | undefined, req: { params?: Record<string, string> } | undefined): { entityType: string; entityId: string } {
  const id = meta ? req?.params?.[meta.param] : undefined;
  if (!meta || !id) return { entityType: 'system', entityId: 'none' };
  return { entityType: meta.resource.charAt(0).toUpperCase() + meta.resource.slice(1), entityId: id };
}

/** B2F-7: the reason the caller gave ({reason, note?}); "Other" is stored as "Other: <note>" like status history. */
export function auditBodyReason(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { reason, note } = body as { reason?: unknown; note?: unknown };
  if (typeof reason !== 'string' || !reason.trim()) return null;
  const r = reason.trim();
  const text = r.toLowerCase() === 'other' && typeof note === 'string' && note.trim() ? `Other: ${note.trim()}` : r;
  return text.slice(0, 1000);
}
