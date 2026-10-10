-- B2-21: 'Archived' is the single status for a deactivated skill (B2 archives every other master-data value).
-- Data only: move skills deactivated as 'Inactive' by earlier B6 builds to 'Archived'.
UPDATE "master_data_values" SET "status" = 'Archived', "version" = "version" + 1, "updatedAt" = now()
WHERE "category" = 'skills' AND "status" = 'Inactive';
