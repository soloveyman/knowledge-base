/**
 * Update subscription plans with extracted Price IDs
 * 
 * Run: npx tsx scripts/update-plans-with-extracted-price-ids.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Price IDs extracted from Products
const priceIds = {
  'standard-monthly': 'price_1SSbPqPKcDWtZlco0Utv2k5D',
  'pro-monthly': 'price_1SSbQlPKcDWtZlco99AWVoLT',
  'standard-annual': 'price_1SSbRyPKcDWtZlconk73nrGk',
  'pro-annual': 'price_1SSbTCPKcDWtZlcoMLbPRn0J',
};

async function updatePlansWithPriceIds() {
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq, and } = await import('drizzle-orm');

  try {
    console.log('\n🔄 Updating subscription plans with Stripe Price IDs...\n');

    let updatedCount = 0;

    // Update Monthly Standard
    const monthlyStandard = await db
      .update(subscriptionPlans)
      .set({ stripePriceId: priceIds['standard-monthly'] })
      .where(and(
        eq(subscriptionPlans.name, 'standard'),
        eq(subscriptionPlans.interval, 'month')
      ))
      .returning();
    
    if (monthlyStandard.length > 0) {
      console.log(`✅ Updated Monthly Standard plan: ${priceIds['standard-monthly']}`);
      updatedCount++;
    } else {
      console.log(`⚠️  Monthly Standard plan not found in database`);
    }

    // Update Monthly Pro
    const monthlyPro = await db
      .update(subscriptionPlans)
      .set({ stripePriceId: priceIds['pro-monthly'] })
      .where(and(
        eq(subscriptionPlans.name, 'pro'),
        eq(subscriptionPlans.interval, 'month')
      ))
      .returning();
    
    if (monthlyPro.length > 0) {
      console.log(`✅ Updated Monthly Pro plan: ${priceIds['pro-monthly']}`);
      updatedCount++;
    } else {
      console.log(`⚠️  Monthly Pro plan not found in database`);
    }

    // Update Annual Standard
    const annualStandard = await db
      .update(subscriptionPlans)
      .set({ stripePriceId: priceIds['standard-annual'] })
      .where(and(
        eq(subscriptionPlans.name, 'standard'),
        eq(subscriptionPlans.interval, 'year')
      ))
      .returning();
    
    if (annualStandard.length > 0) {
      console.log(`✅ Updated Annual Standard plan: ${priceIds['standard-annual']}`);
      updatedCount++;
    } else {
      console.log(`⚠️  Annual Standard plan not found in database`);
    }

    // Update Annual Pro
    const annualPro = await db
      .update(subscriptionPlans)
      .set({ stripePriceId: priceIds['pro-annual'] })
      .where(and(
        eq(subscriptionPlans.name, 'pro'),
        eq(subscriptionPlans.interval, 'year')
      ))
      .returning();
    
    if (annualPro.length > 0) {
      console.log(`✅ Updated Annual Pro plan: ${priceIds['pro-annual']}`);
      updatedCount++;
    } else {
      console.log(`⚠️  Annual Pro plan not found in database`);
    }

    console.log(`\n✅ Updated ${updatedCount} plan(s)!\n`);
    
    // Verify updates
    console.log('📋 Verifying updates...\n');
    const allPlans = await db
      .select({
        name: subscriptionPlans.name,
        interval: subscriptionPlans.interval,
        stripePriceId: subscriptionPlans.stripePriceId,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));
    
    for (const plan of allPlans) {
      const priceId = (plan as any).stripePriceId;
      if (priceId) {
        console.log(`  ✅ ${plan.name} (${plan.interval}): ${priceId}`);
      } else {
        console.log(`  ⚠️  ${plan.name} (${plan.interval}): No Price ID set`);
      }
    }

    console.log('\n✅ Done!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update plans:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

updatePlansWithPriceIds();

