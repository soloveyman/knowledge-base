/**
 * Check and update Monthly Standard plan
 * 
 * Run: npx tsx scripts/check-and-update-monthly-standard.ts
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

const monthlyStandardPriceId = 'price_1SSbPqPKcDWtZlco0Utv2k5D';

async function checkAndUpdateMonthlyStandard() {
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq, and, or } = await import('drizzle-orm');

  try {
    console.log('\n🔍 Checking monthly plans in database...\n');

    // Get all monthly plans
    const monthlyPlans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.interval, 'month'));

    console.log(`Found ${monthlyPlans.length} monthly plan(s):\n`);
    
    for (const plan of monthlyPlans) {
      console.log(`  - Name: ${plan.name}`);
      console.log(`    Display Name: ${plan.displayName}`);
      console.log(`    Price: $${((plan.price || 0) / 100).toFixed(2)}`);
      console.log(`    Price ID: ${(plan as any).stripePriceId || 'Not set'}`);
      console.log('');
    }

    // Try to find Standard plan by name or price
    const standardPlan = monthlyPlans.find(p => 
      p.name === 'standard' || 
      p.name === 'starter' ||
      (p.price === 4500) // $45/month
    );

    if (standardPlan) {
      console.log(`\n🔄 Updating plan "${standardPlan.name}" (${standardPlan.displayName})...\n`);
      
      const updated = await db
        .update(subscriptionPlans)
        .set({ stripePriceId: monthlyStandardPriceId })
        .where(eq(subscriptionPlans.id, standardPlan.id))
        .returning();
      
      if (updated.length > 0) {
        console.log(`✅ Updated plan "${updated[0].name}" with Price ID: ${monthlyStandardPriceId}\n`);
      }
    } else {
      console.log('\n⚠️  Could not find Monthly Standard plan.');
      console.log('   Please check the plan name in database.\n');
      console.log('   You can manually update it with SQL:');
      console.log(`   UPDATE subscription_plans`);
      console.log(`   SET stripe_price_id = '${monthlyStandardPriceId}'`);
      console.log(`   WHERE name = 'standard' AND interval = 'month';`);
      console.log(`   -- OR --`);
      console.log(`   WHERE name = 'starter' AND interval = 'month';`);
      console.log(`   -- OR --`);
      console.log(`   WHERE price = 4500 AND interval = 'month';`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

checkAndUpdateMonthlyStandard();

