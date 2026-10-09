-- Rollback for 20261010_b4_due_date_reminders (scratch/staging only). Then:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261010_b4_due_date_reminders';
DROP TABLE "due_date_reminders";
