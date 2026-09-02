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

    return {
      data: data.map(log => ({
        id: log.id,
        organizationId: log.organizationId,
        actorUserId: log.actorUserId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        result: log.result,
        reason: log.reason,
        correlationId: log.correlationId,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
