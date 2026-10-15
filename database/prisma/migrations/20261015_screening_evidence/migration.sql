ALTER TABLE "screening_logs"
  ADD COLUMN "method" VARCHAR(80),
  ADD COLUMN "evidence_source" VARCHAR(500),
  ADD COLUMN "next_step" VARCHAR(200);
