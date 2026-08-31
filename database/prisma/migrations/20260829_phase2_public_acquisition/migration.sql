-- Phase 2: persist explicit candidate consent captured by public applications.
-- Existing candidates remain auditable with the conservative Unknown default.

ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "consentStatus" VARCHAR(30) NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "consentCapturedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "consentSource" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "candidates_organizationId_consentStatus_idx"
  ON "candidates"("organizationId", "consentStatus");
