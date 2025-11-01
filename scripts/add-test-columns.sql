-- Migration to add type, difficulty, and locale columns to tests table
-- Run this on Railway database to match the schema

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'type'
  ) THEN
    ALTER TABLE tests ADD COLUMN type text;
  END IF;

  -- Add difficulty column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE tests ADD COLUMN difficulty text;
  END IF;

  -- Add locale column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tests' AND column_name = 'locale'
  ) THEN
    ALTER TABLE tests ADD COLUMN locale text;
  END IF;
END $$;

