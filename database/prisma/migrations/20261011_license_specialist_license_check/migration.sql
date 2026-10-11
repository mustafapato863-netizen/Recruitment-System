-- Data only: grant LICENSE_CHECK to the LICENSE_SPECIALIST role (hiring list/detail and compliance PATCH).
-- Idempotent (ON CONFLICT DO NOTHING); a no-op when the role or the permission doesn't exist.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'LICENSE_CHECK'
WHERE r."code" = 'LICENSE_SPECIALIST'
ON CONFLICT DO NOTHING;
