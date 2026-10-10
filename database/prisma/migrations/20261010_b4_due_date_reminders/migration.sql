-- B4: due-date reminder sent-log (idempotency for the worker). NEVER run on prod without review.
-- Rollback: database/prisma/rollbacks/20261010_b4_due_date_reminders.down.sql
-- CreateTable
CREATE TABLE "due_date_reminders" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "reminderDate" DATE NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "notificationId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "due_date_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "due_date_reminders_organizationId_reminderDate_idx" ON "due_date_reminders"("organizationId", "reminderDate");

-- CreateIndex
CREATE UNIQUE INDEX "due_date_reminders_entityType_entityId_kind_reminderDate_re_key" ON "due_date_reminders"("entityType", "entityId", "kind", "reminderDate", "recipientUserId");

