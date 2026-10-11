-- Manual rollback for 20261011_license_specialist_license_check (Prisma has no down migrations).
-- Idempotent; a no-op when the role, permission or grant is absent.
BEGIN;
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  AND r."code" = 'LICENSE_SPECIALIST' AND p."code" = 'LICENSE_CHECK';
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261011_license_specialist_license_check';
COMMIT;
