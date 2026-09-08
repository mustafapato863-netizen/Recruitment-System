-- Persist the summary extracted from a CV so CV Intake can create a complete candidate profile.
ALTER TABLE "candidates"
  ADD COLUMN "summary" TEXT;
