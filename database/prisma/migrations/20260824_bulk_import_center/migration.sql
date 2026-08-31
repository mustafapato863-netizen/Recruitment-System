ALTER TABLE "candidate_import_jobs"
  ADD COLUMN IF NOT EXISTS "dataset" VARCHAR(40) NOT NULL DEFAULT 'candidates',
  ADD COLUMN IF NOT EXISTS "sourceFormat" VARCHAR(20) NOT NULL DEFAULT 'json',
  ADD COLUMN IF NOT EXISTS "sheetName" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "fileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "checksum" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "candidate_import_jobs_organizationId_dataset_createdAt_idx"
  ON "candidate_import_jobs" ("organizationId", "dataset", "createdAt");
