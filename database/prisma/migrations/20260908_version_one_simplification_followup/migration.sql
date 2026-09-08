-- Preserve structured Excel-style Master Data fields for real Position records.
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
