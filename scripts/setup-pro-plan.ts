/**
 * Script to set up the Pro plan in the database
 * Run this once to create or update the Pro plan
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

async function setupProPlan() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  
  try {
    console.log('Setting up Pro plan...');
    
    // Check if Pro plan already exists
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, 'pro'))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing Pro plan
      const [updatedPlan] = await db
        .update(subscriptionPlans)
        .set({
          displayName: 'Pro',
          description: 'For growing companies and networks',
          price: 9900, // $99/month in cents
          currency: 'USD',
          interval: 'month',
          maxUsers: 25,
          maxImportsPerMonth: 80,
          maxGenerationsPerMonth: 250,
          maxEnhancementsPerMonth: 40,
          features: [
            'Up to 25 users',
            '80 document imports per month',
            '250 AI test generations per month',
            '40 document enhancements per month',
            'Extended analytics and priority support',
          ],
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, existing[0].id))
        .returning();
      
      console.log('✅ Pro plan updated:');
      console.log(`   ID: ${updatedPlan.id}`);
      console.log(`   Name: ${updatedPlan.displayName}`);
      console.log(`   Price: $${(updatedPlan.price || 0) / 100}/month`);
      console.log(`   Max Users: ${updatedPlan.maxUsers}`);
      console.log(`   Max Imports: ${updatedPlan.maxImportsPerMonth}/month`);
      console.log(`   Max Generations: ${updatedPlan.maxGenerationsPerMonth}/month`);
    } else {
      // Create Pro plan if it doesn't exist
      const [proPlan] = await db
        .insert(subscriptionPlans)
        .values({
          name: 'pro',
          displayName: 'Pro',
          description: 'For growing companies and networks',
          price: 9900, // $99/month in cents
          currency: 'USD',
          interval: 'month',
          maxUsers: 25,
          maxImportsPerMonth: 80,
          maxGenerationsPerMonth: 250,
          maxEnhancementsPerMonth: 40,
          features: [
            'Up to 25 users',
            '80 document imports per month',
            '250 AI test generations per month',
            '40 document enhancements per month',
            'Extended analytics and priority support',
          ],
          isActive: true,
        })
        .returning();
      
      console.log('✅ Pro plan created:');
      console.log(`   ID: ${proPlan.id}`);
      console.log(`   Name: ${proPlan.displayName}`);
      console.log(`   Price: $${(proPlan.price || 0) / 100}/month`);
      console.log(`   Max Users: ${proPlan.maxUsers}`);
      console.log(`   Max Imports: ${proPlan.maxImportsPerMonth}/month`);
      console.log(`   Max Generations: ${proPlan.maxGenerationsPerMonth}/month`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set up Pro plan:', error);
    process.exit(1);
  }
}

setupProPlan();

