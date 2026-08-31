import type { PrismaClient } from '@recruitflow/database';
import type { EmailTransport } from './transport';
import { unprotectOutboxPayload } from './outbox-crypto';

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 15 * 60_000;

interface ClaimedJob {
  id: string;
  organizationId: string | null;
  toEmail: string;
  subject: string;
  template: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

export interface ProcessResult {
  claimed: number;
  sent: number;
  retried: number;
  dead: number;
}

function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

const DEFAULT_PROCESSING_LEASE_MS = 5 * 60_000;

async function recoverStaleJobs(
  prisma: PrismaClient,
  processingLeaseMs: number,
): Promise<void> {
  const lease = Math.max(1_000, Math.floor(processingLeaseMs));
  await prisma.$executeRaw`
    UPDATE "email_outbox"
    SET "status" = 'Dead',
        "lastError" = COALESCE("lastError", 'Worker lease expired after maximum delivery attempts'),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'Processing'
      AND "attempts" >= "maxAttempts"
      AND "updatedAt" < CURRENT_TIMESTAMP - (${lease} * INTERVAL '1 millisecond')
  `;
  await prisma.$executeRaw`
    UPDATE "email_outbox"
    SET "status" = 'Pending',
        "availableAt" = CURRENT_TIMESTAMP,
        "lastError" = COALESCE("lastError", 'Worker lease expired; delivery was reclaimed'),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'Processing'
      AND "attempts" < "maxAttempts"
      AND "updatedAt" < CURRENT_TIMESTAMP - (${lease} * INTERVAL '1 millisecond')
  `;
}

/** Atomically claim up to `limit` due Pending rows (SKIP LOCKED so multiple
 *  workers never grab the same email). */
async function claimBatch(
  prisma: PrismaClient,
  limit: number,
  processingLeaseMs = DEFAULT_PROCESSING_LEASE_MS,
): Promise<ClaimedJob[]> {
  await recoverStaleJobs(prisma, processingLeaseMs);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "email_outbox"
    SET "status" = 'Processing',
        "attempts" = "attempts" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" IN (
      SELECT "id" FROM "email_outbox"
      WHERE "status" = 'Pending' AND "availableAt" <= CURRENT_TIMESTAMP
      ORDER BY "createdAt"
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      "id",
      "organizationId",
      "toEmail",
      "subject",
      "template",
      "payload",
      "attempts",
      "maxAttempts"
  `;
}

export function createOutboxProcessor(prisma: PrismaClient, transport: EmailTransport) {
  return async function processBatch(limit: number): Promise<ProcessResult> {
    const result: ProcessResult = { claimed: 0, sent: 0, retried: 0, dead: 0 };
    const jobs = await claimBatch(
      prisma,
      limit,
      Number(process.env.WORKER_PROCESSING_LEASE_MS ?? DEFAULT_PROCESSING_LEASE_MS),
    );
    result.claimed = jobs.length;

    for (const job of jobs) {
      try {
        await transport.send({
          id: job.id,
          to: job.toEmail,
          subject: job.subject,
          template: job.template,
          payload: unprotectOutboxPayload((job.payload ?? {}) as Record<string, unknown>),
        });
        await prisma.emailOutbox.update({
          where: { id: job.id },
          data: { status: 'Sent', sentAt: new Date(), lastError: null },
        });
        result.sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.attempts >= job.maxAttempts) {
          await prisma.emailOutbox.update({
            where: { id: job.id },
            data: { status: 'Dead', lastError: message.slice(0, 2000) },
          });
          result.dead += 1;
        } else {
          await prisma.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: 'Pending',
              lastError: message.slice(0, 2000),
              availableAt: new Date(Date.now() + backoffMs(job.attempts)),
            },
          });
          result.retried += 1;
        }
      }
    }

    return result;
  };
}
