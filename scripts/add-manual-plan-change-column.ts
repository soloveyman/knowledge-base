#!/usr/bin/env tsx

/**
 * Script to add changed_manually_at column to subscriptions table
 * This column tracks when a subscription plan was manually changed by super-admin
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local or .env
const envPath = resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('   Please set DATABASE_URL in .env.local or .env file');
  process.exit(1);
}

async function addManualPlanChangeColumn() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { db } = await import('@/lib/db');
  const { sql } = await import('drizzle-orm');

  try {
    console.log('Adding changed_manually_at column to subscriptions table...\n');

    // Add changed_manually_at column to subscriptions
    await db.execute(sql`
      ALTER TABLE subscriptions 
      ADD COLUMN IF NOT EXISTS changed_manually_at TIMESTAMP;
    `);
    console.log('   ✅ Column added to subscriptions\n');

    console.log('✅ Migration complete!');
    console.log('\nThe changed_manually_at column will track when subscription plans are manually changed by super-admin.');
    
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

addManualPlanChangeColumn();

