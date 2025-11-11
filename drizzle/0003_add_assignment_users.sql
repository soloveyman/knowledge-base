-- Create assignment_users table
CREATE TABLE IF NOT EXISTS "assignment_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign keys
DO $$ BEGIN
 ALTER TABLE "assignment_users" ADD CONSTRAINT "assignment_users_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "assignment_users" ADD CONSTRAINT "assignment_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "assignment_users_assignment_id_idx" ON "assignment_users" ("assignment_id");
CREATE INDEX IF NOT EXISTS "assignment_users_user_id_idx" ON "assignment_users" ("user_id");

-- Create unique constraint to prevent duplicate user assignments
CREATE UNIQUE INDEX IF NOT EXISTS "assignment_users_assignment_id_user_id_unique" ON "assignment_users" ("assignment_id","user_id");

