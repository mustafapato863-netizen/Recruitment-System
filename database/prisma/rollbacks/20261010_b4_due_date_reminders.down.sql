-- Rollback for 20261010_b4_due_date_reminders (scratch/staging only). Then:
DROP TABLE "due_date_reminders";

-- B2-M1: forget the migration too, so `prisma migrate deploy` re-applies it cleanly.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010_b4_due_date_reminders';
