-- Meeting notes 2026-11-25 (six items): opening types, nationality preference, reporting cycle.
-- All new columns nullable or defaulted; existing data unaffected. Data-only catalog seeding is idempotent.

ALTER TABLE "vacancy_requests"
  ADD COLUMN IF NOT EXISTS "openingType" VARCHAR(20) NOT NULL DEFAULT 'New position',
  ADD COLUMN IF NOT EXISTS "replacedEmployeeId" UUID,
  ADD COLUMN IF NOT EXISTS "nationalityPreference" VARCHAR(60)[] NOT NULL DEFAULT '{}';

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_replacedEmployeeId_fkey"
  FOREIGN KEY ("replacedEmployeeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "vacancy_requests_replacedEmployeeId_idx" ON "vacancy_requests"("replacedEmployeeId");

ALTER TABLE "vacancies"
  ADD COLUMN IF NOT EXISTS "nationalityPreference" VARCHAR(60)[] NOT NULL DEFAULT '{}';

ALTER TABLE "candidates"
  ADD COLUMN IF NOT EXISTS "nationality" VARCHAR(60);

ALTER TABLE "hiring_cases"
  ADD COLUMN IF NOT EXISTS "reportingCycle" VARCHAR(20);

-- Seed the new master-data catalog values for every org (same pattern as the reason-list migrations).
INSERT INTO "master_data_values" ("id", "organizationId", "category", "code", "name", "status", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", v.category, v.code, v.name, 'Active', 1, now(), now()
FROM "organizations" o
CROSS JOIN (VALUES
  ('nationalities', 'EGYPTIAN', 'Egyptian'),
  ('nationalities', 'SAUDI', 'Saudi'),
  ('nationalities', 'INDIAN', 'Indian'),
  ('nationalities', 'FILIPINO', 'Filipino'),
  ('nationalities', 'PAKISTANI', 'Pakistani'),
  ('nationalities', 'BANGLADESHI', 'Bangladeshi'),
  ('nationalities', 'JORDANIAN', 'Jordanian'),
  ('nationalities', 'SUDANESE', 'Sudanese'),
  ('nationalities', 'SYRIAN', 'Syrian'),
  ('nationalities', 'LEBANESE', 'Lebanese'),
  ('nationalities', 'YEMENI', 'Yemeni'),
  ('nationalities', 'NIGERIAN', 'Nigerian'),
  ('nationalities', 'KENYAN', 'Kenyan'),
  ('nationalities', 'ETHIOPIAN', 'Ethiopian'),
  ('nationalities', 'MOROCCAN', 'Moroccan'),
  ('nationalities', 'TUNISIAN', 'Tunisian'),
  ('nationalities', 'SRI_LANKAN', 'Sri Lankan'),
  ('nationalities', 'NEPALESE', 'Nepalese'),
  ('opening-reasons', 'NEW_PROJECT', 'New project'),
  ('opening-reasons', 'TEAM_EXPANSION', 'Team expansion'),
  ('opening-reasons', 'INCREASED_WORKLOAD', 'Increased workload'),
  ('opening-reasons', 'REPLACEMENT', 'Replacement'),
  ('opening-reasons', 'SEASONAL', 'Seasonal need'),
  ('opening-reasons', 'OTHER', 'Other'),
  ('interview-types', 'SCREENING', 'Screening'),
  ('interview-types', 'TECHNICAL', 'Technical'),
  ('interview-types', 'BEHAVIORAL', 'Behavioral'),
  ('interview-types', 'MANAGERIAL', 'Managerial'),
  ('interview-types', 'ASSESSMENT', 'Assessment')
) AS v(category, code, name)
ON CONFLICT DO NOTHING;
