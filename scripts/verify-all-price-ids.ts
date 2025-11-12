/**
 * Verify all Price IDs are set correctly
 * 
 * Run: npx tsx scripts/verify-all-price-ids.ts
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

async function verifyAllPriceIds() {
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');

  try {
    console.log('\n📋 Verifying all subscription plans with Price IDs...\n');

    const allPlans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.name, subscriptionPlans.interval);

    console.log('Active Plans:');
    console.log('─'.repeat(80));
    
    let withPriceId = 0;
    let withoutPriceId = 0;

    for (const plan of allPlans) {
      const priceId = (plan as any).stripePriceId;
      const price = plan.price ? `$${((plan.price || 0) / 100).toFixed(2)}` : 'Free';
      
      if (priceId) {
        console.log(`✅ ${plan.displayName.padEnd(20)} (${plan.name}/${plan.interval})`);
        console.log(`   Price: ${price.padEnd(10)} Price ID: ${priceId}`);
        withPriceId++;
      } else {
        console.log(`⚠️  ${plan.displayName.padEnd(20)} (${plan.name}/${plan.interval})`);
        console.log(`   Price: ${price.padEnd(10)} Price ID: Not set`);
        withoutPriceId++;
      }
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log(`\nSummary:`);
    console.log(`  ✅ Plans with Price ID: ${withPriceId}`);
    console.log(`  ⚠️  Plans without Price ID: ${withoutPriceId}`);
    console.log(`  📊 Total: ${allPlans.length}\n`);

    if (withoutPriceId > 0) {
      console.log('Note: Plans without Price ID will use dynamic price_data creation.\n');
    }

    console.log('✅ Verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

verifyAllPriceIds();

