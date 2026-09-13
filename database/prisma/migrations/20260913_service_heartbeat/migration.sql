-- Track process liveness independently from organization records so the API
-- can distinguish a healthy database from a missing background worker.
CREATE TABLE "service_heartbeats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service" VARCHAR(80) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'healthy',
    "metadata" JSONB,
    "observedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_heartbeats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_heartbeats_service_key" ON "service_heartbeats"("service");
CREATE INDEX "service_heartbeats_status_observedAt_idx" ON "service_heartbeats"("status", "observedAt");
