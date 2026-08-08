import { Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a notification. Idempotent: skips if same type+entityId already exists unread for the recipient. */
  async create(data: {
    organizationId: string;
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }): Promise<void> {
    // Idempotency: if the same unread notification already exists, skip
    if (data.entityId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          organizationId: data.organizationId,
          recipientUserId: data.recipientUserId,
          type: data.type,
          entityId: data.entityId,
          readAt: null,
        },
        select: { id: true },
      });
      if (existing) return;
    }

    await this.prisma.notification.create({ data });
  }

  async list(
    organizationId: string,
    recipientUserId: string,
    unreadOnly = false,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<NotificationRecord>> {
    const where = {
      organizationId,
      recipientUserId,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: data.map(this.toRecord),
      total,
      page,
      pageSize,
    };
  }

  async unreadCount(organizationId: string, recipientUserId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { organizationId, recipientUserId, readAt: null },
    });
  }

  async markRead(organizationId: string, recipientUserId: string, id: string): Promise<NotificationRecord> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, organizationId, recipientUserId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    return this.toRecord(updated);
  }

  async markAllRead(organizationId: string, recipientUserId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { organizationId, recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  private toRecord(n: {
    id: string;
    organizationId: string;
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationRecord {
    return {
      id: n.id,
      organizationId: n.organizationId,
      recipientUserId: n.recipientUserId,
      type: n.type,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
