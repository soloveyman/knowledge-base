/**
 * Update subscription plans with Stripe Price IDs
 * 
 * Run: npx tsx scripts/update-plans-with-price-ids.ts
 * 
 * You need to provide Price IDs from Stripe Dashboard:
 * 1. Go to https://dashboard.stripe.com/products
 * 2. Click on each product
 * 3. Copy the Price ID (starts with price_...)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// Load environment variables FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Price IDs from Payment Links (you need to get these from Stripe Dashboard)
// Go to: https://dashboard.stripe.com/products
// Click on each product and copy the Price ID
const priceIds = {
  'standard-monthly': '', // Monthly: Standard - https://buy.stripe.com/8x200l7QO9Uo1Lc8axcwg00
  'pro-monthly': '',      // Monthly: PRO - https://buy.stripe.com/eVqbJ32wu0jO2Pg8axcwg01
  'standard-annual': '',  // Annual: Standard - https://buy.stripe.com/4gMdRb3AyfeI1Lc9eBcwg02
  'pro-annual': '',       // Annual: PRO - https://buy.stripe.com/5kQdRbfjg3w0gG69eBcwg03
};

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function updatePlansWithPriceIds() {
  const { db, subscriptionPlans } = await import('@/lib/db');
  const { eq, and } = await import('drizzle-orm');

  try {
    console.log('\n📋 Updating subscription plans with Stripe Price IDs\n');
    console.log('You need to get Price IDs from Stripe Dashboard:');
    console.log('1. Go to: https://dashboard.stripe.com/products');
    console.log('2. Click on each product');
    console.log('3. Copy the Price ID (starts with price_...)\n');

    // Get Price IDs interactively
    priceIds['standard-monthly'] = await askQuestion('Enter Price ID for Monthly Standard plan (or press Enter to skip): ');
    priceIds['pro-monthly'] = await askQuestion('Enter Price ID for Monthly PRO plan (or press Enter to skip): ');
    priceIds['standard-annual'] = await askQuestion('Enter Price ID for Annual Standard plan (or press Enter to skip): ');
    priceIds['pro-annual'] = await askQuestion('Enter Price ID for Annual PRO plan (or press Enter to skip): ');

    console.log('\n🔄 Updating plans...\n');

    // Update Monthly Standard
    if (priceIds['standard-monthly']) {
      const updated = await db
        .update(subscriptionPlans)
        .set({ stripePriceId: priceIds['standard-monthly'] })
        .where(and(
          eq(subscriptionPlans.name, 'standard'),
          eq(subscriptionPlans.interval, 'month')
        ))
        .returning();
      
      if (updated.length > 0) {
        console.log(`✅ Updated Monthly Standard plan: ${priceIds['standard-monthly']}`);
      } else {
        console.log(`⚠️  Monthly Standard plan not found in database`);
      }
    }

    // Update Monthly Pro
    if (priceIds['pro-monthly']) {
      const updated = await db
        .update(subscriptionPlans)
        .set({ stripePriceId: priceIds['pro-monthly'] })
        .where(and(
          eq(subscriptionPlans.name, 'pro'),
          eq(subscriptionPlans.interval, 'month')
        ))
        .returning();
      
      if (updated.length > 0) {
        console.log(`✅ Updated Monthly Pro plan: ${priceIds['pro-monthly']}`);
      } else {
        console.log(`⚠️  Monthly Pro plan not found in database`);
      }
    }

    // Update Annual Standard
    if (priceIds['standard-annual']) {
      const updated = await db
        .update(subscriptionPlans)
        .set({ stripePriceId: priceIds['standard-annual'] })
        .where(and(
          eq(subscriptionPlans.name, 'standard'),
          eq(subscriptionPlans.interval, 'year')
        ))
        .returning();
      
      if (updated.length > 0) {
        console.log(`✅ Updated Annual Standard plan: ${priceIds['standard-annual']}`);
      } else {
        console.log(`⚠️  Annual Standard plan not found in database`);
      }
    }

    // Update Annual Pro
    if (priceIds['pro-annual']) {
      const updated = await db
        .update(subscriptionPlans)
        .set({ stripePriceId: priceIds['pro-annual'] })
        .where(and(
          eq(subscriptionPlans.name, 'pro'),
          eq(subscriptionPlans.interval, 'year')
        ))
        .returning();
      
      if (updated.length > 0) {
        console.log(`✅ Updated Annual Pro plan: ${priceIds['pro-annual']}`);
      } else {
        console.log(`⚠️  Annual Pro plan not found in database`);
      }
    }

    console.log('\n✅ Update complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update plans:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

updatePlansWithPriceIds();

