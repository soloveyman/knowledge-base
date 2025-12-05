/**
 * Script to update trial plan description from "7 days" to "14 days"
 * This script updates existing trial plans in the database
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
  console.error('   For production, set DATABASE_URL in environment variables');
  process.exit(1);
}

async function updateTrialDescription() {
  try {
    // Use dynamic imports AFTER env vars are loaded
    const { db, subscriptionPlans } = await import('@/lib/db');
    const { eq } = await import('drizzle-orm');
    
    console.log('🔍 Searching for trial plan...');
    
    // Find trial plan
    const trialPlans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, 'free-trial'))
      .limit(1);
    
    if (trialPlans.length === 0) {
      console.log('⚠️  No trial plan found. Creating new trial plan with 14-day description...');
      const { getOrCreateTrialPlan } = await import('@/lib/subscription/trial');
      const trialPlan = await getOrCreateTrialPlan();
      console.log('✅ Trial plan created with 14-day description');
      console.log(`   ID: ${trialPlan.id}`);
      console.log(`   Description: ${trialPlan.description}`);
      process.exit(0);
      return;
    }
    
    const trialPlan = trialPlans[0];
    console.log(`📋 Found trial plan: ${trialPlan.displayName}`);
    console.log(`   Current description: ${trialPlan.description}`);
    
    // Check if update is needed
    if (trialPlan.description === '14 days of full access') {
      console.log('✅ Trial plan already has correct description (14 days)');
      console.log('   No update needed.');
      process.exit(0);
      return;
    }
    
    // Update description to 14 days
    console.log('🔄 Updating description to "14 days of full access"...');
    
    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        description: '14 days of full access',
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, trialPlan.id))
      .returning();
    
    if (updated) {
      console.log('✅ Trial plan updated successfully!');
      console.log(`   ID: ${updated.id}`);
      console.log(`   New description: ${updated.description}`);
      console.log(`   Max Users: ${updated.maxUsers}`);
      console.log(`   Max Imports: ${updated.maxImportsPerMonth}/month`);
      console.log(`   Max Generations: ${updated.maxGenerationsPerMonth}/month`);
      console.log(`   Max Enhancements: ${updated.maxEnhancementsPerMonth}/month`);
    } else {
      console.error('❌ Failed to update trial plan');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update trial plan:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Tip: Make sure your database is running and DATABASE_URL is correct.');
        console.error('   For local: Start PostgreSQL with docker-compose up -d');
        console.error('   For production: Check DATABASE_URL in environment variables');
      }
    }
    process.exit(1);
  }
}

updateTrialDescription();

