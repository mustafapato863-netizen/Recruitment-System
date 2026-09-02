-- Guard application-stage updates against lost updates. Existing records start
-- at version 1 and every approved stage transition increments the version.
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "applications_id_stage_version_idx"
  ON "applications"("id", "stage", "version");
