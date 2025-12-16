-- Onboarding progress per user & business
CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dismissed_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Ensure each user has only one onboarding row per business
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_business_user_idx"
  ON "onboarding_progress" ("business_id", "user_id");


