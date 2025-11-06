/**
 * Script to add enhancement columns to database
 * Adds max_enhancements_per_month to subscription_plans and enhancements_count to usage
 */

// IMPORTANT: Load environment variables using require() to ensure it runs before imports
const dotenv = require('dotenv');
const { resolve } = require('path');

// Load environment variables from .env.local (primary)
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

// Load .env.local first, then .env as fallback
const envLocal = dotenv.config({ path: envLocalPath });
const env = dotenv.config({ path: envPath });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error(`   Checked: ${envLocalPath} (${envLocal.error ? 'not found' : 'loaded'})`);
  console.error(`   Checked: ${envPath} (${env.error ? 'not found' : 'loaded'})`);
  console.error('   Please ensure .env.local exists with DATABASE_URL set');
  console.error('   Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_base');
  process.exit(1);
}

async function addEnhancementColumns() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { db } = await import('@/lib/db');
  const { sql } = await import('drizzle-orm');

  try {
    console.log('Adding enhancement columns to database...\n');

    // Add max_enhancements_per_month to subscription_plans
    console.log('1. Adding max_enhancements_per_month to subscription_plans...');
    await db.execute(sql`
      ALTER TABLE subscription_plans 
      ADD COLUMN IF NOT EXISTS max_enhancements_per_month INTEGER;
    `);
    console.log('   ✅ Column added to subscription_plans\n');

    // Add enhancements_count to usage
    console.log('2. Adding enhancements_count to usage...');
    await db.execute(sql`
      ALTER TABLE usage 
      ADD COLUMN IF NOT EXISTS enhancements_count INTEGER DEFAULT 0;
    `);
    console.log('   ✅ Column added to usage\n');

    console.log('✅ All enhancement columns added successfully!');
    console.log('\nNext steps:');
    console.log('   - Run setup:trial to update free plan with maxEnhancementsPerMonth: 1');
    console.log('   - Run setup:starter to update Optimal plan with maxEnhancementsPerMonth: 20');
    console.log('   - Run setup:pro to update Pro plan with maxEnhancementsPerMonth: 50');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add enhancement columns:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

addEnhancementColumns();

