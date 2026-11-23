-- Forced password change on first login (user management + strong passwords).
-- Existing users keep mustChangePassword=false; newly created users get
-- mustChangePassword=true from the API until they set their own password.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMPTZ(6);
