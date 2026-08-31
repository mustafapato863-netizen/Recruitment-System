-- Normalize defaults on structured array fields for environments that already
-- had these columns before the reconciliation migration was introduced.

ALTER TABLE "candidates"
  ALTER COLUMN "skills" SET DEFAULT ARRAY[]::VARCHAR(100)[],
  ALTER COLUMN "experienceYears" DROP DEFAULT,
  ALTER COLUMN "certifications" SET DEFAULT ARRAY[]::VARCHAR(120)[],
  ALTER COLUMN "languages" SET DEFAULT ARRAY[]::VARCHAR(50)[];

ALTER TABLE "vacancies"
  ALTER COLUMN "requiredSkills" SET DEFAULT ARRAY[]::VARCHAR(100)[],
  ALTER COLUMN "minExperienceYears" DROP DEFAULT,
  ALTER COLUMN "location" DROP DEFAULT;
