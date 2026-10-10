-- B2 (Roadmap v2 §3): no hard deletes, deactivate only, admin-only anonymize.
-- Additive only: nullable columns, a defaulted status column, one permission row.

ALTER TABLE "candidates" ADD COLUMN "anonymizedAt" TIMESTAMPTZ(6);
ALTER TABLE "candidate_documents" ADD COLUMN "anonymizedAt" TIMESTAMPTZ(6);
ALTER TABLE "talent_pool_candidates" ADD COLUMN "removedAt" TIMESTAMPTZ(6);
ALTER TABLE "permissions" ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'Active';

-- Admin-only legal-erasure permission.
INSERT INTO "permissions" ("id", "code", "name", "description", "organizationId", "status", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'CANDIDATE_ANONYMIZE', 'Anonymize candidate (legal erasure)',
        'Irreversibly replace a candidate''s personal data with placeholders. Administrator only.',
        NULL, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" = 'CANDIDATE_ANONYMIZE'
WHERE r."code" = 'ADMINISTRATOR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Retire hard candidate delete. Grants are kept as history but the permission
-- is no longer effective (only Active permissions count).
UPDATE "permissions" SET "status" = 'Retired', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'CANDIDATE_DELETE';
