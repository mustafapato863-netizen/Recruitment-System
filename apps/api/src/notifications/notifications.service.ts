import { Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { EmailOutboxService } from '../email/email-outbox.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailOutbox: EmailOutboxService,
  ) {}

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
    await this.prisma.$transaction(async (tx) => {
      const recipient = await tx.user.findFirst({
        where: {
          id: data.recipientUserId,
          organizationId: data.organizationId,
          status: 'Active',
        },
        select: {
          email: true,
          displayName: true,
          inAppNotifications: true,
          emailNotifications: true,
          interviewReminders: true,
          approvalReminders: true,
          taskReminders: true,
        },
      });
      if (!recipient) return;

      // Serialize the read-before-create idempotency check for a given event
      // so concurrent workflow requests cannot create duplicate alerts.
      if (data.entityId) {
        const eventKey = `${data.organizationId}:${data.recipientUserId}:${data.type}:${data.entityId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`;
        const existing = await tx.notification.findFirst({
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

      if (recipient.inAppNotifications) {
        await tx.notification.create({
          data: {
            organizationId: data.organizationId,
            recipientUserId: data.recipientUserId,
            type: data.type,
            title: data.title,
            message: data.message,
            entityType: data.entityType ?? null,
            entityId: data.entityId ?? null,
          },
        });
      }

      if (recipient.emailNotifications && shouldSendEmail(data.type, recipient)) {
        await this.emailOutbox.enqueueWithTx(tx, {
          organizationId: data.organizationId,
          toEmail: recipient.email,
          subject: data.title,
          template: 'notification',
          payload: {
            title: data.title,
            message: data.message,
            displayName: recipient.displayName,
            entityType: data.entityType ?? null,
            entityId: data.entityId ?? null,
          },
        });
      }
    });
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

function shouldSendEmail(
  type: string,
  recipient: {
    interviewReminders: boolean;
    approvalReminders: boolean;
    taskReminders: boolean;
  },
): boolean {
  if (type.startsWith('Interview')) return recipient.interviewReminders;
  if (type.startsWith('Task')) return recipient.taskReminders;
  if (type.includes('Approval') || type.includes('Offer') || type.startsWith('VacancyRequest')) {
    return recipient.approvalReminders;
  }
  return true;
}
