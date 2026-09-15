-- Stage gates are optional by default so existing pipelines keep their current behaviour.
ALTER TABLE "pipeline_stages"
  ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT false;
