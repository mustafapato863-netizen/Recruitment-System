ALTER TABLE "vacancy_requests"
  ADD COLUMN "budgetMin" INTEGER,
  ADD COLUMN "budgetMax" INTEGER,
  ADD COLUMN "budgetCurrency" VARCHAR(3),
  ADD COLUMN "targetFillDate" DATE,
  ADD COLUMN "recruitmentTiming" VARCHAR(20),
  ADD COLUMN "plannedOpenDate" DATE;

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_budget_range_check"
  CHECK (
    ("budgetMin" IS NULL AND "budgetMax" IS NULL AND "budgetCurrency" IS NULL)
    OR ("budgetMin" > 0 AND "budgetMax" >= "budgetMin" AND "budgetCurrency" IS NOT NULL)
  );

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_budget_currency_check"
  CHECK ("budgetCurrency" IS NULL OR "budgetCurrency" IN ('AED', 'EGP'));

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_recruitment_timing_check"
  CHECK ("recruitmentTiming" IS NULL OR "recruitmentTiming" IN ('After Approval', 'Deferred'));

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_planned_open_check"
  CHECK (
    ("recruitmentTiming" = 'Deferred' AND "plannedOpenDate" IS NOT NULL)
    OR ("recruitmentTiming" IS DISTINCT FROM 'Deferred' AND "plannedOpenDate" IS NULL)
  );

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_fill_after_open_check"
  CHECK ("targetFillDate" IS NULL OR "plannedOpenDate" IS NULL OR "targetFillDate" >= "plannedOpenDate");
