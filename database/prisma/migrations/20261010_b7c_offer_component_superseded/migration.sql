-- B2-21: replace B7's hard delete of offer pay rows with soft supersede. Additive, nullable.
ALTER TABLE "offer_components" ADD COLUMN "supersededAt" TIMESTAMPTZ(6);
