-- Add description column to assignments table
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "description" text;

