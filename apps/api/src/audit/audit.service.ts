import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuditLogEntry, PaginatedResult } from '@recruitflow/contracts';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    action: string;
    actorUserId?: string;
    organizationId?: string;
    entityType: string;
    entityId: string;
    result: string;
    reason?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data,
    });
  }

  async query(organizationId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<AuditLogEntry>> {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({
        where: { organizationId },
      }),
    ]);

    // Audit rows intentionally store the actor ID, while the UI needs a
    // readable name. Resolve actors in the same organization so this lookup
    // cannot accidentally disclose a user from another tenant.
    const actorIds = [
      ...new Set(
        data.map((log) => log.actorUserId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId, id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.displayName]));

    return {
      data: data.map((log) => {
        const actorDisplayName = log.actorUserId ? actorNames.get(log.actorUserId) : undefined;
        return {
          id: log.id,
          organizationId: log.organizationId,
          actorUserId: log.actorUserId,
          ...(actorDisplayName ? { actorDisplayName } : {}),
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          result: log.result,
          reason: log.reason,
          correlationId: log.correlationId,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
    };
  }
}
