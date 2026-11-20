-- Optional user branch assignment, tenant-scoped by application validation.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "branchId" UUID;

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "users_organizationId_branchId_idx"
  ON "users"("organizationId", "branchId");
