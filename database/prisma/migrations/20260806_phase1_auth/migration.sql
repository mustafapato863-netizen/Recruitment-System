-- Phase 1: Add authentication fields to users table (camelCase to match Prisma schema)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(128);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ(6);

-- Clean up any snake_case columns if they were created
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at";
