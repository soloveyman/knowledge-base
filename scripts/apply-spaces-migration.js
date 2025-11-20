// Simple script to apply Spaces migration
// Usage: node scripts/apply-spaces-migration.js
// Make sure DATABASE_URL is set in environment or .env file

const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  console.error('Please set DATABASE_URL environment variable or add it to .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('railway') || databaseUrl.includes('vercel') 
    ? { rejectUnauthorized: false } 
    : false,
});

async function applyMigration() {
  console.log('🚀 Applying Spaces migration...');
  
  try {
    await pool.query('BEGIN');
    
    // Add url and storage_key columns
    await pool.query(`
      ALTER TABLE "document_images" 
      ADD COLUMN IF NOT EXISTS "url" text,
      ADD COLUMN IF NOT EXISTS "storage_key" text;
    `);
    console.log('✅ Added url and storage_key columns');
    
    // Make data column nullable
    await pool.query(`
      ALTER TABLE "document_images" 
      ALTER COLUMN "data" DROP NOT NULL;
    `);
    console.log('✅ Made data column nullable');
    
    await pool.query('COMMIT');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();

