/**
 * Script to set up annual versions of subscription plans
 * Creates annual versions of Standard and Pro plans with 20% discount (2 months free)
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
  process.exit(1);
}

async function setupAnnualPlans() {
  const { db, subscriptionPlans } = await import('../lib/db');
  const { eq, and } = await import('drizzle-orm');
  
  try {
    console.log('Setting up annual subscription plans...\n');
    
    // Standard plan annual version
    // Monthly: $45/month = $540/year
    // Annual with discount: $399/year
    const standardMonthlyPrice = 4500; // $45/month in cents
    const standardAnnualPrice = 39900; // $399/year in cents
    
    // Check if annual Standard plan exists
    const existingStandardAnnual = await db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.name, 'standard'),
        eq(subscriptionPlans.interval, 'year')
      ))
      .limit(1);
    
    if (existingStandardAnnual.length > 0) {
      const [updated] = await db
        .update(subscriptionPlans)
        .set({
          displayName: 'Standard',
          description: 'For small teams and startups',
          price: standardAnnualPrice,
          currency: 'USD',
          interval: 'year',
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
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, existingStandardAnnual[0].id))
        .returning();
      
      console.log('✅ Standard (Annual) plan updated:');
      console.log(`   ID: ${updated.id}`);
      console.log(`   Price: $${(updated.price || 0) / 100}/year ($${Math.round(standardAnnualPrice / 12) / 100}/month)`);
    } else {
      const [plan] = await db
        .insert(subscriptionPlans)
        .values({
          name: 'standard',
          displayName: 'Standard',
          description: 'For small teams and startups',
          price: standardAnnualPrice,
          currency: 'USD',
          interval: 'year',
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
      
      console.log('✅ Standard (Annual) plan created:');
      console.log(`   ID: ${plan.id}`);
      console.log(`   Price: $${(plan.price || 0) / 100}/year ($${Math.round(standardAnnualPrice / 12) / 100}/month)`);
    }
    
    // Pro plan annual version
    // Monthly: $99/month = $1188/year
    // Annual with 20% discount: $950/year (2 months free)
    const proMonthlyPrice = 9900; // $99/month in cents
    const proAnnualPrice = 95000; // $950/year in cents (20% discount)
    
    // Check if annual Pro plan exists
    const existingProAnnual = await db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.name, 'pro'),
        eq(subscriptionPlans.interval, 'year')
      ))
      .limit(1);
    
    if (existingProAnnual.length > 0) {
      const [updated] = await db
        .update(subscriptionPlans)
        .set({
          displayName: 'Pro',
          description: 'For growing companies and networks',
          price: proAnnualPrice,
          currency: 'USD',
          interval: 'year',
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
        .where(eq(subscriptionPlans.id, existingProAnnual[0].id))
        .returning();
      
      console.log('✅ Pro (Annual) plan updated:');
      console.log(`   ID: ${updated.id}`);
      console.log(`   Price: $${(updated.price || 0) / 100}/year ($${Math.round(proAnnualPrice / 12) / 100}/month)`);
    } else {
      const [plan] = await db
        .insert(subscriptionPlans)
        .values({
          name: 'pro',
          displayName: 'Pro',
          description: 'For growing companies and networks',
          price: proAnnualPrice,
          currency: 'USD',
          interval: 'year',
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
      
      console.log('✅ Pro (Annual) plan created:');
      console.log(`   ID: ${plan.id}`);
      console.log(`   Price: $${(plan.price || 0) / 100}/year ($${Math.round(proAnnualPrice / 12) / 100}/month)`);
    }
    
    console.log('\n✅ All annual plans set up successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set up annual plans:', error);
    process.exit(1);
  }
}

setupAnnualPlans();

