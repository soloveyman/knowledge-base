/**
 * Script to set up the Optimal plan (formerly Starter) in the database
 * Run this once to create or update the Optimal plan
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
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  
  try {
    console.log('Setting up Optimal plan...');
    
    // Check if Optimal plan (name: starter) already exists
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, 'starter'))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing Starter plan to Optimal
      const [updatedPlan] = await db
        .update(subscriptionPlans)
        .set({
          displayName: 'Optimal',
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, existing[0].id))
        .returning();
      
      console.log('✅ Optimal plan updated:');
      console.log(`   ID: ${updatedPlan.id}`);
      console.log(`   Name: ${updatedPlan.displayName}`);
      console.log(`   Price: $${(updatedPlan.price || 0) / 100}/month`);
      process.exit(0);
    }
    
    // Create Optimal plan
    const [starterPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: 'starter',
        displayName: 'Optimal',
        description: 'Small teams, startups',
        price: 3900, // $39/month in cents
        currency: 'USD',
        interval: 'month',
        maxUsers: 10,
        maxImportsPerMonth: 20,
        maxGenerationsPerMonth: 100,
        features: [
          'Access to all features',
          '10 team members',
          '20 document imports per month',
          '100 AI test generations per month',
          'Full support',
        ],
        isActive: true,
      })
      .returning();
    
    console.log('✅ Optimal plan created:');
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

