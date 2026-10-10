-- C2: name INTERVIEW_PARTICIPATE and LICENSE_CHECK in the permission catalog. Catalog only:
-- no endpoint checks them yet (wiring waits for B0b). Administrator gets them like every catalog permission.
INSERT INTO "permissions" ("id", "code", "name", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'INTERVIEW_PARTICIPATE', 'Participate in interviews', 'Be scheduled on interviews and submit scorecards for interviews you attend.', now(), now()),
  (gen_random_uuid(), 'LICENSE_CHECK', 'Check professional licenses', 'Record and verify a candidate''s professional license check (e.g. nursing, pharmacy).', now(), now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE p."code" IN ('INTERVIEW_PARTICIPATE', 'LICENSE_CHECK') AND r."code" = 'ADMINISTRATOR'
ON CONFLICT DO NOTHING;
