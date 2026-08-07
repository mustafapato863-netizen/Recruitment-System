import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    return next.handle().pipe(
      tap({
        next: () => {
          if (action && user) {
            this.prisma.auditLog.create({
              data: {
                action,
                actorUserId: user.userId,
                organizationId: user.organizationId,
                entityType: 'system',
                entityId: 'none',
                result: 'SUCCESS',
              },
            }).catch(console.error);
          }
        },
        error: (err: Error) => {
          if (action && user) {
            this.prisma.auditLog.create({
              data: {
                action,
                actorUserId: user.userId,
                organizationId: user.organizationId,
                entityType: 'system',
                entityId: 'none',
                result: 'FAILURE',
                reason: err.message,
              },
            }).catch(console.error);
          }
        },
      }),
    );
  }
}
