-- Tenant-aware permission metadata for administrator-managed access catalogs.
ALTER TABLE "permissions"
  ADD COLUMN "name" VARCHAR(160),
  ADD COLUMN "organizationId" UUID NULL;

ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "permissions_organizationId_idx" ON "permissions"("organizationId");

