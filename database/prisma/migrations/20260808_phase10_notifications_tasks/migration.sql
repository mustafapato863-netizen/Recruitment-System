-- Phase 10: Notifications & My Tasks
-- Forward-only migration. Never edit or revert.

-- ─── notifications ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"   UUID        NOT NULL,
  "recipientUserId"  UUID        NOT NULL,
  "type"             VARCHAR(80) NOT NULL,
  "title"            VARCHAR(255) NOT NULL,
  "message"          TEXT        NOT NULL,
  "entityType"       VARCHAR(80),
  "entityId"         VARCHAR(80),
  "readAt"           TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "notifications_organizationId_recipientUserId_createdAt_idx"
  ON "notifications"("organizationId", "recipientUserId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_recipientUserId_readAt_idx"
  ON "notifications"("recipientUserId", "readAt");

-- ─── tasks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tasks" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID        NOT NULL,
  "assigneeUserId" UUID        NOT NULL,
  "createdById"    UUID        NOT NULL,
  "type"           VARCHAR(80) NOT NULL,
  "title"          VARCHAR(255) NOT NULL,
  "description"    TEXT,
  "priority"       VARCHAR(30) NOT NULL DEFAULT 'Normal',
  "status"         VARCHAR(30) NOT NULL DEFAULT 'Open',
  "dueAt"          TIMESTAMPTZ,
  "entityType"     VARCHAR(80),
  "entityId"       VARCHAR(80),
  "completedAt"    TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "tasks_organizationId_assigneeUserId_status_idx"
  ON "tasks"("organizationId", "assigneeUserId", "status");

CREATE INDEX IF NOT EXISTS "tasks_assigneeUserId_dueAt_idx"
  ON "tasks"("assigneeUserId", "dueAt");

CREATE INDEX IF NOT EXISTS "tasks_organizationId_status_idx"
  ON "tasks"("organizationId", "status");
