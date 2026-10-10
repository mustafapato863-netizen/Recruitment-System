-- M2-M4 (B7 follow-up): master-data list of reassign reasons (deactivate-only), minimal set per org. Data only.
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'reassign-reasons', v.code, v.name, 'Active', 1, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('WORKLOAD_BALANCING', 'Workload balancing'),
  ('OWNER_ON_LEAVE', 'Owner on leave'),
  ('OWNER_LEAVING', 'Owner leaving'),
  ('SPECIALIST_NEEDED', 'Specialist needed'),
  ('OTHER', 'Other')
) AS v(code, name)
ON CONFLICT DO NOTHING;
