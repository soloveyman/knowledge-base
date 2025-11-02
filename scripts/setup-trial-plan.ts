/**
 * Script to set up the free trial plan in the database
 * Run this once to create the trial plan
 */

// IMPORTANT: Load environment variables using require() to ensure it runs before imports
// Using require() instead of import ensures synchronous execution before module evaluation
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

async function setupTrialPlan() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { getOrCreateTrialPlan } = await import('@/lib/subscription/trial');
  try {
    console.log('Setting up free trial plan...');
    
    const trialPlan = await getOrCreateTrialPlan();
    
    console.log('✅ Free trial plan created/verified:');
    console.log(`   ID: ${trialPlan.id}`);
    console.log(`   Name: ${trialPlan.displayName}`);
    console.log(`   Price: $${(trialPlan.price || 0) / 100}`);
    console.log(`   Max Users: ${trialPlan.maxUsers}`);
    console.log(`   Max Imports: ${trialPlan.maxImportsPerMonth}/month`);
    console.log(`   Max Generations: ${trialPlan.maxGenerationsPerMonth}/month`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set up trial plan:', error);
    process.exit(1);
  }
}

setupTrialPlan();

