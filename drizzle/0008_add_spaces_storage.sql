-- Add DigitalOcean Spaces storage fields to document_images table
ALTER TABLE "document_images" 
ADD COLUMN IF NOT EXISTS "url" text,
ADD COLUMN IF NOT EXISTS "storage_key" text;

-- Make data column nullable (it's now optional, used only as fallback)
ALTER TABLE "document_images" 
ALTER COLUMN "data" DROP NOT NULL;

