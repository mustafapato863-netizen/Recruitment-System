-- B2R-6: b3f's down deactivates "Other" and its up is ON CONFLICT DO NOTHING, so a rollback + re-upgrade left it Inactive.
-- Re-activate the seeded "Other" rejection reason (data only, idempotent).
UPDATE "master_data_values" SET "status" = 'Active', "version" = "version" + 1, "updatedAt" = now()
WHERE "category" = 'rejection-reasons' AND "code" = 'OTHER' AND "status" <> 'Active';
