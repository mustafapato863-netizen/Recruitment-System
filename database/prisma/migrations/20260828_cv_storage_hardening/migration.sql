ALTER TABLE "candidate_documents"
  ADD COLUMN "storageProvider" VARCHAR(50) NOT NULL DEFAULT 'local-private',
  ADD COLUMN "sha256" VARCHAR(64),
  ADD COLUMN "scanProvider" VARCHAR(50),
  ADD COLUMN "scanMessage" TEXT,
  ADD COLUMN "scannedAt" TIMESTAMPTZ(6),
  ADD COLUMN "parserStatus" VARCHAR(40) NOT NULL DEFAULT 'NotStarted',
  ADD COLUMN "parserVersion" VARCHAR(40),
  ADD COLUMN "retentionExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "consentStatus" VARCHAR(30) NOT NULL DEFAULT 'Unknown',
  ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN "deletedById" UUID,
  ADD COLUMN "deletionReason" TEXT;

ALTER TABLE "candidate_documents"
  ADD CONSTRAINT "candidate_documents_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "candidate_documents_organizationId_scanStatus_idx"
  ON "candidate_documents"("organizationId", "scanStatus");
CREATE INDEX "candidate_documents_organizationId_retentionExpiresAt_idx"
  ON "candidate_documents"("organizationId", "retentionExpiresAt");
CREATE INDEX "candidate_documents_organizationId_sha256_idx"
  ON "candidate_documents"("organizationId", "sha256");
