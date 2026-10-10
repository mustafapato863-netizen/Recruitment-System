# 20261010_b2_no_delete_anonymize

Adds `candidates.anonymizedAt`, `candidate_documents.anonymizedAt`,
`talent_pool_candidates.removedAt` (all nullable), `permissions.status`
(NOT NULL DEFAULT 'Active'), inserts the `CANDIDATE_ANONYMIZE` permission granted
to `ADMINISTRATOR`, and marks `CANDIDATE_DELETE` as `Retired`.

Rollback (manual; Prisma has no down migrations). Note: anonymization itself is
irreversible by design; rolling back the schema does NOT restore anonymized PII.

```sql
BEGIN;
UPDATE "permissions" SET "status" = 'Active' WHERE "code" = 'CANDIDATE_DELETE';
DELETE FROM "role_permissions" WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "code" = 'CANDIDATE_ANONYMIZE');
DELETE FROM "permissions" WHERE "code" = 'CANDIDATE_ANONYMIZE';
ALTER TABLE "permissions" DROP COLUMN IF EXISTS "status";
ALTER TABLE "talent_pool_candidates" DROP COLUMN IF EXISTS "removedAt";
ALTER TABLE "candidate_documents" DROP COLUMN IF EXISTS "anonymizedAt";
ALTER TABLE "candidates" DROP COLUMN IF EXISTS "anonymizedAt";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b2_no_delete_anonymize';
COMMIT;
```
Before dropping `talent_pool_candidates.removedAt`, decide what to do with soft-unlinked
rows (they would reappear as active members).

**Do not run on production without Mustafa's explicit approval.**
