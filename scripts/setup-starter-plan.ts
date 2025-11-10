/**
 * Script to set up the Standard plan in the database
 * Run this once to create or update the Standard plan
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

async function setupStarterPlan() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  // Use relative path since scripts are excluded from tsconfig path aliases
  const { db, subscriptionPlans } = await import('../lib/db');
  const { eq } = await import('drizzle-orm');
  
  try {
    console.log('Setting up Standard plan...');
    
    // Check if Standard plan (name: standard or starter) already exists
    const { or } = await import('drizzle-orm');
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(or(eq(subscriptionPlans.name, 'standard'), eq(subscriptionPlans.name, 'starter')))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing plan to Standard (rename from starter to standard if needed)
      const [updatedPlan] = await db
        .update(subscriptionPlans)
        .set({
          name: 'standard', // Update name from 'starter' to 'standard'
          displayName: 'Standard',
          description: 'For small teams and startups',
          price: 4500, // $45/month in cents
          maxUsers: 10,
          maxImportsPerMonth: 20,
          maxGenerationsPerMonth: 100,
          maxEnhancementsPerMonth: 20,
          features: [
            'Up to 10 users',
            '20 document imports per month',
            '100 AI test generations per month',
            '20 document enhancements per month',
            'Learning effectiveness analytics',
          ],
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, existing[0].id))
        .returning();
      
      console.log('✅ Standard plan updated:');
      console.log(`   ID: ${updatedPlan.id}`);
      console.log(`   Name: ${updatedPlan.name}`);
      console.log(`   Display Name: ${updatedPlan.displayName}`);
      console.log(`   Price: $${(updatedPlan.price || 0) / 100}/month`);
      process.exit(0);
    }
    
    // Create Standard plan
    const [starterPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: 'standard',
        displayName: 'Standard',
        description: 'For small teams and startups',
        price: 4500, // $45/month in cents
        currency: 'USD',
        interval: 'month',
        maxUsers: 10,
        maxImportsPerMonth: 20,
        maxGenerationsPerMonth: 100,
        maxEnhancementsPerMonth: 20,
        features: [
          'Up to 10 users',
          '20 document imports per month',
          '100 AI test generations per month',
          '20 document enhancements per month',
          'Learning effectiveness analytics',
        ],
        isActive: true,
      })
      .returning();
    
    console.log('✅ Standard plan created:');
    console.log(`   ID: ${starterPlan.id}`);
    console.log(`   Name: ${starterPlan.displayName}`);
    console.log(`   Price: $${(starterPlan.price || 0) / 100}/month`);
    console.log(`   Max Users: ${starterPlan.maxUsers}`);
    console.log(`   Max Imports: ${starterPlan.maxImportsPerMonth}/month`);
    console.log(`   Max Generations: ${starterPlan.maxGenerationsPerMonth}/month`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set up Optimal plan:', error);
    process.exit(1);
  }
}

setupStarterPlan();

