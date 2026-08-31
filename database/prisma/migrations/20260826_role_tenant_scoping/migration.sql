-- Tenant scoping for the role catalog.
-- organizationId NULL = shared system role (seeded catalog, readable by all tenants,
-- immutable through the tenant API). A non-null value marks a tenant-local custom role.

ALTER TABLE "roles" ADD COLUMN "organizationId" UUID NULL;

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");
