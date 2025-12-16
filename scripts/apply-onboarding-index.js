// Script to apply onboarding_progress unique index to Railway database
// This ensures the unique index exists for ON CONFLICT to work

const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set');
  console.error('Please set DATABASE_URL environment variable or add it to .env file');
  process.exit(1);
}

const isRailway = databaseUrl.includes('railway') || databaseUrl.includes('rlwy.net');
const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isRailway || (!isLocalhost && process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function applyOnboardingIndex() {
  console.log('🚀 Applying onboarding_progress unique index...');
  console.log(`📍 Environment: ${isRailway ? 'Railway' : isLocalhost ? 'Local' : 'Unknown'}`);
  console.log(`📍 URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  
  try {
    // Test connection
    console.log('\n🔌 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    
    // Check if table exists
    console.log('\n🔍 Checking if onboarding_progress table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'onboarding_progress'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Table onboarding_progress does not exist');
      console.log('   Creating table first...');
      
      await pool.query(`
        CREATE TABLE "onboarding_progress" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "business_id" uuid NOT NULL,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "dismissed_at" timestamp,
          "completed_at" timestamp,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        )
      `);
      console.log('✅ Table created');
    } else {
      console.log('✅ Table exists');
    }
    
    // Check if index exists
    console.log('\n🔍 Checking if unique index exists...');
    const indexCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'onboarding_progress_business_user_idx'
        AND tablename = 'onboarding_progress'
      )
    `);
    
    if (indexCheck.rows[0].exists) {
      console.log('✅ Unique index already exists');
      console.log('   No action needed');
    } else {
      console.log('⚠️  Unique index does not exist');
      console.log('   Creating unique index...');
      
      await pool.query(`
        CREATE UNIQUE INDEX onboarding_progress_business_user_idx
        ON onboarding_progress (business_id, user_id)
      `);
      console.log('✅ Unique index created successfully!');
    }
    
    // Verify index
    console.log('\n🔍 Verifying index...');
    const verifyIndex = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE indexname = 'onboarding_progress_business_user_idx'
      AND tablename = 'onboarding_progress'
    `);
    
    if (verifyIndex.rows.length > 0) {
      console.log('✅ Index verified:');
      console.log(`   Name: ${verifyIndex.rows[0].indexname}`);
      console.log(`   Definition: ${verifyIndex.rows[0].indexdef}`);
    } else {
      console.log('⚠️  Index verification failed');
    }
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyOnboardingIndex();

