-- Employee activity targets.
-- Completion instant for an interview, plus the target and its revision history.

ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "employee_activity_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "setById" UUID NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "periodType" VARCHAR(20) NOT NULL,
    "periodKey" VARCHAR(20) NOT NULL,
    "vacancyId" UUID,
    "scopeKey" VARCHAR(40) NOT NULL DEFAULT 'ALL',
    "targetQuantity" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_activity_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_activity_target_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "targetId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "priorQuantity" INTEGER,
    "newQuantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_activity_target_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_activity_targets_scope_key" ON "employee_activity_targets"("organizationId", "employeeId", "metric", "periodType", "periodKey", "scopeKey");

CREATE INDEX IF NOT EXISTS "employee_activity_targets_period_idx" ON "employee_activity_targets"("organizationId", "employeeId", "periodType", "periodKey", "isActive");

CREATE INDEX IF NOT EXISTS "employee_activity_target_revisions_targetId_createdAt_idx" ON "employee_activity_target_revisions"("targetId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "employee_activity_targets" ADD CONSTRAINT "employee_activity_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_activity_targets" ADD CONSTRAINT "employee_activity_targets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_activity_targets" ADD CONSTRAINT "employee_activity_targets_setById_fkey" FOREIGN KEY ("setById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_activity_targets" ADD CONSTRAINT "employee_activity_targets_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_activity_target_revisions" ADD CONSTRAINT "employee_activity_target_revisions_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "employee_activity_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_activity_target_revisions" ADD CONSTRAINT "employee_activity_target_revisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
