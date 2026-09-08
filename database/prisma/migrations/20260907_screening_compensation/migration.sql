-- Capture recruiter screening availability and compensation expectations.
ALTER TABLE "screening_logs"
  ADD COLUMN "noticePeriodDays" INTEGER,
  ADD COLUMN "expectedSalary" DECIMAL(12, 2),
  ADD COLUMN "currentSalary" DECIMAL(12, 2),
  ADD COLUMN "salaryCurrency" VARCHAR(10) NOT NULL DEFAULT 'SAR';
