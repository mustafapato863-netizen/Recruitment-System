import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { AuditLogEntry, PaginatedResult } from '@recruitflow/contracts';

export interface AuditSearchQuery { actor?: string; action?: string; entity?: string; entityId?: string; from?: string; to?: string; page?: string; pageSize?: string }

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

  /**
   * C5: GET /audit (admin-only). Server-side filters: actor (user id), action (one or comma list),
   * entity (entityType, optional entityId), date range from/to (ISO instant, or YYYY-MM-DD = Cairo day, to inclusive).
   * Pagination: page >= 1, pageSize 1..100 (default 20). Newest first.
   */
  async search(organizationId: string, q: AuditSearchQuery): Promise<PaginatedResult<AuditLogEntry>> {
    const bad = (message: string) => new BadRequestException({ code: 'VALIDATION_ERROR', message });
    const page = q.page === undefined || q.page === '' ? 1 : Number(q.page);
    const pageSize = q.pageSize === undefined || q.pageSize === '' ? 20 : Number(q.pageSize);
    if (!Number.isInteger(page) || page < 1) throw bad('page must be a whole number >= 1.');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw bad('pageSize must be 1..100.');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (q.actor && !uuid.test(q.actor)) throw bad('actor must be a user id.');
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const at = (v: string, end: boolean) => {
      const d = day.test(v) ? new Date(`${v}T00:00:00+03:00`) : new Date(v); // Cairo day (UTC+3)
      if (Number.isNaN(d.getTime())) throw bad(`Invalid date: ${v}`);
      return end && day.test(v) ? new Date(d.getTime() + 86_400_000) : d;
    };
    const from = q.from ? at(q.from, false) : undefined;
    const to = q.to ? at(q.to, true) : undefined;
    if (from && to && from >= to) throw bad('from must be before to.');
    const actions = q.action?.split(',').map((a) => a.trim()).filter(Boolean) ?? [];
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actor ? { actorUserId: q.actor } : {}),
      ...(actions.length ? { action: { in: actions } } : {}),
      ...(q.entity ? { entityType: q.entity } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    };
    return this.query(organizationId, page, pageSize, where);
  }

  async query(organizationId: string, page: number = 1, pageSize: number = 20, filters: Prisma.AuditLogWhereInput = {}): Promise<PaginatedResult<AuditLogEntry>> {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { ...filters, organizationId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({
        where: { ...filters, organizationId },
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
