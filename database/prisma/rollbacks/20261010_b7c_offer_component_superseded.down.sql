-- Drops superseded-pay history; delete superseded rows first so the live pay stays correct after rollback.
DELETE FROM "offer_components" WHERE "supersededAt" IS NOT NULL;
ALTER TABLE "offer_components" DROP COLUMN IF EXISTS "supersededAt";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b7c_offer_component_superseded';
