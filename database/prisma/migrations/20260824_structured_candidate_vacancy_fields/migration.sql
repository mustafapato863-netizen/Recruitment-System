-- Keep the structured candidate and vacancy requirements in sync with the Prisma schema.
-- Array fields default to empty collections so existing rows and legacy seed data remain valid.

ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "skills" VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(100)[],
  ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER,
  ADD COLUMN IF NOT EXISTS "location" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "certifications" VARCHAR(120)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(120)[],
  ADD COLUMN IF NOT EXISTS "languages" VARCHAR(50)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(50)[],
  ADD COLUMN IF NOT EXISTS "availability" VARCHAR(60);

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "requiredSkills" VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(100)[],
  ADD COLUMN IF NOT EXISTS "minExperienceYears" INTEGER,
  ADD COLUMN IF NOT EXISTS "location" VARCHAR(120);
