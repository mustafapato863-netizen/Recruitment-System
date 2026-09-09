import { Injectable, Logger } from '@nestjs/common';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { Prisma } from '@recruitflow/database';
import { assertOutboxEncryptionKey, protectOutboxPayload } from './outbox-crypto';

export type EmailTemplate =
  | 'password_reset'
  | 'email_verification'
  | 'invitation'
  | 'notification';

export interface EnqueueEmailInput {
  toEmail: string;
  subject: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
  organizationId?: string | null;
}

/**
 * Transactional email outbox. `enqueue` writes a Pending row; the worker
 * process drains the table and performs actual delivery, so callers never
 * block on SMTP. Callers that need business-write atomicity use
 * `enqueueWithTx`.
 */
@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);

  constructor(private readonly prisma: PrismaService) {
    assertOutboxEncryptionKey();
  }

  async enqueue(input: EnqueueEmailInput): Promise<void> {
    if (!mailDeliveryEnabled()) return;
    await this.prisma.emailOutbox.create({
      data: {
        organizationId: input.organizationId ?? null,
        toEmail: input.toEmail,
        subject: input.subject,
        template: input.template,
        payload: protectOutboxPayload(input.payload) as Prisma.InputJsonValue,
      },
    });
    this.logger.log(`Queued ${input.template} email to ${maskEmailForLog(input.toEmail)}`);
  }

  /** Same as {@link enqueue} but runs against a transaction client so the
   *  outbox row commits atomically with the caller's business writes. */
  async enqueueWithTx(
    tx: Prisma.TransactionClient,
    input: EnqueueEmailInput,
  ): Promise<void> {
    if (!mailDeliveryEnabled()) return;
    await tx.emailOutbox.create({
      data: {
        organizationId: input.organizationId ?? null,
        toEmail: input.toEmail,
        subject: input.subject,
        template: input.template,
        payload: protectOutboxPayload(input.payload) as Prisma.InputJsonValue,
      },
    });
    this.logger.log(`Queued ${input.template} email to ${maskEmailForLog(input.toEmail)} (transactional)`);
  }

  async countPending(): Promise<number> {
    return this.prisma.emailOutbox.count({ where: { status: 'Pending' } });
  }
}

function mailDeliveryEnabled(): boolean {
  return !['false', '0'].includes(process.env.MAIL_DELIVERY_ENABLED?.trim().toLowerCase() ?? 'true');
}

function maskEmailForLog(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'invalid';
  return `${localPart.slice(0, 1)}***@${domain}`;
}
