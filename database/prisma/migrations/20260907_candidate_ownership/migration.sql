ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "createdById" UUID;

CREATE INDEX IF NOT EXISTS "candidates_createdById_idx"
  ON "candidates" ("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_createdById_fkey'
  ) THEN
    ALTER TABLE "candidates"
      ADD CONSTRAINT "candidates_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
