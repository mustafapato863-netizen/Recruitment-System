import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailOutboxService } from '../email/email-outbox.service';
import {
  LOCAL_TEST_DESTINATION,
  MESSAGE_ATTEMPT_ACTION,
  attemptOutcome,
  mailDeliveryEnabled,
  renderTemplate,
  writeLocalTestMessage,
  type MessageState,
} from './message-attempts';

export interface MessageAttemptView {
  id: string;
  templateId: string;
  templateName: string;
  channel: 'email';
  state: MessageState;
  reason: string | null;
  at: string;
  retryOf: string | null;
  destination: string;
}

/**
 * File messages. Each attempt is its own row. Retry never overwrites a failed attempt.
 * The recipient is the local test destination, not the candidate.
 */
@Injectable()
export class MessageAttemptsService {
  writeLocal: (id: string, contents: string) => Promise<void> = writeLocalTestMessage;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Optional() @Inject(NotificationsService) private readonly notifications?: NotificationsService,
    @Optional() @Inject(EmailOutboxService) private readonly outbox?: EmailOutboxService,
  ) {}

  async list(user: AuthUser, applicationId: string) {
    const app = await this.visible(user, applicationId);
    const [rows, templates] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId, action: MESSAGE_ATTEMPT_ACTION, entityType: 'Application', entityId: applicationId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.emailTemplate.findMany({
        where: { organizationId: user.organizationId, status: 'Active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      applicationId,
      followUpDate: app.followUpDate ? app.followUpDate.toISOString().slice(0, 10) : null,
      destination: LOCAL_TEST_DESTINATION,
      deliveryEnabled: mailDeliveryEnabled(),
      templates,
      attempts: rows.map((row) => this.toView(row)),
    };
  }

  async send(user: AuthUser, applicationId: string, templateId: string) {
    await this.visible(user, applicationId);
    return this.record(user, applicationId, templateId, 'send', null);
  }

  async retry(user: AuthUser, applicationId: string, attemptId: string) {
    await this.visible(user, applicationId);
    const prior = await this.prisma.auditLog.findFirst({
      where: { id: attemptId, organizationId: user.organizationId, action: MESSAGE_ATTEMPT_ACTION, entityType: 'Application', entityId: applicationId },
    });
    if (!prior) throw new NotFoundException('Message attempt not found.');
    if (prior.result !== 'Failed') {
      throw new ConflictException({ code: 'MESSAGE_NOT_FAILED', message: 'Only a failed attempt can be retried. The earlier attempt stays in history.' });
    }
    const priorData = this.readData(prior.afterData);
    return this.record(user, applicationId, priorData.templateId, 'retry', prior.id);
  }

  private async record(user: AuthUser, applicationId: string, templateId: string, kind: 'send' | 'retry', retryOf: string | null) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, organizationId: user.organizationId },
      select: {
        candidate: { select: { firstName: true, lastName: true } },
        vacancy: { select: { vacancyCode: true, position: { select: { title: true } } } },
        organization: { select: { name: true } },
      },
    });
    if (!app) throw new NotFoundException('Application not found.');
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: templateId, organizationId: user.organizationId, status: 'Active' },
    });
    if (!template) throw new NotFoundException('The template does not exist or is not active.');

    const vars: Record<string, string> = {
      candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`.trim(),
      positionTitle: app.vacancy.position?.title ?? '',
      organizationName: app.organization?.name ?? '',
      stageName: '',
    };
    const subject = renderTemplate(template.subject, vars);
    const body = renderTemplate(template.bodyTemplate, vars);
    const deliveryEnabled = mailDeliveryEnabled();
    const outcome = attemptOutcome(kind, deliveryEnabled);
    const id = randomUUID();

    if (outcome.state === 'Sent') {
      const contents = [
        `destination: ${LOCAL_TEST_DESTINATION}`,
        `template: ${template.name}`,
        `state: Sent`,
        '---',
        body,
      ].join('\n');
      await this.writeLocal(id, contents);
    } else if (outcome.state === 'Queued' && this.outbox) {
      await this.outbox.enqueue({
        organizationId: user.organizationId,
        toEmail: LOCAL_TEST_DESTINATION,
        subject,
        template: 'notification',
        payload: { title: subject, message: body, applicationId, localTest: true },
      });
    }

    const created = await this.prisma.auditLog.create({
      data: {
        id,
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: MESSAGE_ATTEMPT_ACTION,
        entityType: 'Application',
        entityId: applicationId,
        result: outcome.state,
        reason: outcome.reason,
        afterData: {
          templateId: template.id,
          templateName: template.name,
          channel: 'email',
          destination: LOCAL_TEST_DESTINATION,
          retryOf,
        } satisfies Prisma.InputJsonObject,
      },
    });

    const notice = outcome.state === 'Failed'
      ? 'A message failed. Nothing was sent to a candidate.'
      : outcome.state === 'Sent'
        ? 'A message retry was delivered to the local test destination. The failed attempt is still in history.'
        : 'A message was queued for the local test destination.';
    if (this.notifications) {
      await this.notifications.create({
        organizationId: user.organizationId,
        recipientUserId: user.userId,
        type: `ApplicationMessage${outcome.state}`,
        title: `Message ${outcome.state.toLowerCase()}`,
        message: `${notice} Template: ${template.name}.`,
        entityType: 'Application',
        entityId: applicationId,
      }).catch(() => undefined);
    }

    return this.toView(created);
  }

  private async visible(user: AuthUser, applicationId: string) {
    const visibility = await this.access.getApplicationVisibilityWhere(user);
    const app = await this.prisma.application.findFirst({
      where: { AND: [visibility, { id: applicationId, organizationId: user.organizationId }] },
      select: { id: true, followUpDate: true },
    });
    if (!app) throw new NotFoundException('Application not found.');
    return app;
  }

  private readData(value: Prisma.JsonValue | null): { templateId: string; templateName: string; retryOf: string | null } {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const templateId = typeof data.templateId === 'string' ? data.templateId : '';
    const templateName = typeof data.templateName === 'string' ? data.templateName : 'Template';
    const retryOf = typeof data.retryOf === 'string' ? data.retryOf : null;
    return { templateId, templateName, retryOf };
  }

  private toView(row: { id: string; result: string; reason: string | null; createdAt: Date; afterData: Prisma.JsonValue | null }): MessageAttemptView {
    const data = this.readData(row.afterData);
    const state: MessageState = row.result === 'Sent' || row.result === 'Queued' || row.result === 'Failed' ? row.result : 'Failed';
    return {
      id: row.id,
      templateId: data.templateId,
      templateName: data.templateName,
      channel: 'email',
      state,
      reason: row.reason,
      at: row.createdAt.toISOString(),
      retryOf: data.retryOf,
      destination: LOCAL_TEST_DESTINATION,
    };
  }
}
