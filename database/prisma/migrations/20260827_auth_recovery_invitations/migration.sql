-- M1 authentication contracts: persistent, tenant-bound, single-use token state.
-- Raw token values are never persisted; the API stores SHA-256 hashes only.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "invitationAcceptedAt" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "auth_tokens" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_tokens_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "auth_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_tokens_tokenHash_key"
  ON "auth_tokens"("tokenHash");

CREATE INDEX IF NOT EXISTS "auth_tokens_userId_type_expiresAt_idx"
  ON "auth_tokens"("userId", "type", "expiresAt");

CREATE INDEX IF NOT EXISTS "auth_tokens_organizationId_type_expiresAt_idx"
  ON "auth_tokens"("organizationId", "type", "expiresAt");
