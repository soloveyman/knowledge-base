-- Add business_id to users for per-tenant scoping (nullable for existing rows)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_id" uuid;

-- Optional: backfill owners' business_id = id
UPDATE "users" SET "business_id" = "id" WHERE role = 'owner' AND "business_id" IS NULL;

-- Optional: index to speed up tenant queries
CREATE INDEX IF NOT EXISTS idx_users_business_id ON "users" ("business_id");


