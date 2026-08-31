-- Persist authentication rate-limit state so lockouts survive restarts and are shared by API instances.
CREATE TABLE "auth_rate_limits" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(6) NOT NULL,
    "lockedUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_rate_limits_scope_keyHash_key"
  ON "auth_rate_limits"("scope", "keyHash");

CREATE INDEX "auth_rate_limits_lockedUntil_idx"
  ON "auth_rate_limits"("lockedUntil");
