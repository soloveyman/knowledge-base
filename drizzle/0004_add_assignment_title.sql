-- Add title column to assignments table
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "title" text;

