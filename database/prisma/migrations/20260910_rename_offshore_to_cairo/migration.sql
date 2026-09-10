-- Rename the retired branch city label while preserving branch and vacancy records.
UPDATE "branches"
SET "city" = 'Cairo'
WHERE LOWER(BTRIM("city")) = 'offshore';

UPDATE "vacancies"
SET "location" = 'Cairo'
WHERE LOWER(BTRIM("location")) = 'offshore';
