/**
 * Add stripe_price_id column to subscription_plans table
 * 
 * Run: tsx scripts/add-stripe-price-id-column.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('   Please set DATABASE_URL in .env.local or .env file');
  process.exit(1);
}

async function addStripePriceIdColumn() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { db } = await import('@/lib/db');
  const { sql } = await import('drizzle-orm');

  try {
    console.log('Adding stripe_price_id column to subscription_plans table...\n');

    // Add stripe_price_id column to subscription_plans
    await db.execute(sql`
      ALTER TABLE subscription_plans 
      ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
    `);
    console.log('   ✅ Column added to subscription_plans\n');

    console.log('✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('   1. Create Products and Prices in Stripe Dashboard');
    console.log('   2. Update subscription_plans with stripe_price_id values');
    console.log('   3. Example SQL:');
    console.log('      UPDATE subscription_plans SET stripe_price_id = \'price_xxx\' WHERE name = \'standard\';');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add column:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

addStripePriceIdColumn();

