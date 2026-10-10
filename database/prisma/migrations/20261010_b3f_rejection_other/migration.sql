-- Rejection reasons get "Other" (a free-text note is required when it is picked). Data only, idempotent.
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'rejection-reasons', 'OTHER', 'Other', 'Active', 1, now(), now()
FROM "organizations" o
ON CONFLICT DO NOTHING;
