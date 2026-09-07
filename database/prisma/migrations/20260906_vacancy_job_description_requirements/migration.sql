-- Phase A: Per-opening job description requirements.
-- Hiring managers draft JD content on the vacancy request; conversion copies it
-- onto the vacancy. Vacancy JD fields are edited per-opening (unlike Position
-- master-data text) and feed the public careers site.

-- AlterTable: vacancy_requests JD draft fields
ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "jobSummary" TEXT;
ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "responsibilities" TEXT;
ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "qualifications" TEXT;
ALTER TABLE "vacancy_requests" ADD COLUMN IF NOT EXISTS "benefits" TEXT;

-- AlterTable: vacancies per-opening JD fields
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "department" VARCHAR(120);
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "jobSummary" TEXT;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "responsibilities" TEXT;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "qualifications" TEXT;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "benefits" TEXT;
