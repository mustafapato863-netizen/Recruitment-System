-- Transactional email outbox for the async delivery engine.
-- Rows are enqueued inside the same transaction as the business change
-- (auth tokens, invitations) and drained by the worker with SKIP LOCKED.

CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "toEmail" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "template" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "email_outbox_status_availableAt_idx" ON "email_outbox"("status", "availableAt");
