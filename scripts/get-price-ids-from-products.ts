/**
 * Get Price IDs from Product IDs
 * 
 * Run: npx tsx scripts/get-price-ids-from-products.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import Stripe from 'stripe';

// Load environment variables FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is not set');
  process.exit(1);
}

// Product IDs provided by user
const products = {
  'Monthly: Standard': 'prod_TPQGubMJx4OmFh',
  'Monthly: PRO': 'prod_TPQHE4fnT3Pjdm',
  'Annual: Standard': 'prod_TPQIv2Nbla6j2E',
  'Annual: PRO': 'prod_TPQJ8JlsZ9qGvP',
};

async function getPriceIdsFromProducts() {
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-10-29.clover',
    typescript: true,
  });

  console.log('\n🔍 Getting Price IDs from Products...\n');

  const results: Record<string, { priceId: string | null; error?: string; productName?: string }> = {};

  for (const [planName, productId] of Object.entries(products)) {
    try {
      console.log(`📋 Processing: ${planName}`);
      console.log(`   Product ID: ${productId}`);

      // Retrieve product
      const product = await stripe.products.retrieve(productId);
      console.log(`   Product Name: ${product.name}`);

      // Get all prices for this product
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
      });

      if (prices.data.length > 0) {
        // For subscription products, there's usually one active price
        // But we need to match by interval (month/year)
        const interval = planName.toLowerCase().includes('annual') ? 'year' : 'month';
        const matchingPrice = prices.data.find(p => p.recurring?.interval === interval);

        if (matchingPrice) {
          results[planName] = { 
            priceId: matchingPrice.id,
            productName: product.name,
          };
          console.log(`   ✅ Price ID: ${matchingPrice.id}`);
          console.log(`   Interval: ${matchingPrice.recurring?.interval}`);
          console.log(`   Amount: $${(matchingPrice.unit_amount || 0) / 100} ${matchingPrice.currency?.toUpperCase()}\n`);
        } else {
          // If no exact match, use first price
          const firstPrice = prices.data[0];
          results[planName] = { 
            priceId: firstPrice.id,
            productName: product.name,
            error: `No ${interval} price found, using first available price`,
          };
          console.log(`   ⚠️  Price ID: ${firstPrice.id} (interval: ${firstPrice.recurring?.interval || 'N/A'})\n`);
        }
      } else {
        results[planName] = { priceId: null, error: 'No active prices found for this product', productName: product.name };
        console.log(`   ❌ No active prices found\n`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results[planName] = { priceId: null, error: errorMessage };
      console.log(`   ❌ Error: ${errorMessage}\n`);
    }
  }

  // Summary
  console.log('\n📊 Summary:\n');
  console.log('Price IDs extracted from Products:');
  console.log('─'.repeat(80));
  
  for (const [planName, result] of Object.entries(results)) {
    if (result.priceId) {
      console.log(`${planName.padEnd(25)} → ${result.priceId}`);
      if (result.productName) {
        console.log(`${''.padEnd(25)}   Product: ${result.productName}`);
      }
    } else {
      console.log(`${planName.padEnd(25)} → ❌ ${result.error || 'Not found'}`);
    }
    console.log('');
  }

  // Generate SQL update statements
  console.log('\n📝 SQL Update Statements:\n');
  console.log('-- Copy and run these SQL statements to update your database\n');
  
  if (results['Monthly: Standard']?.priceId) {
    console.log(`UPDATE subscription_plans`);
    console.log(`SET stripe_price_id = '${results['Monthly: Standard'].priceId}'`);
    console.log(`WHERE name = 'standard' AND interval = 'month';`);
    console.log('');
  }
  
  if (results['Monthly: PRO']?.priceId) {
    console.log(`UPDATE subscription_plans`);
    console.log(`SET stripe_price_id = '${results['Monthly: PRO'].priceId}'`);
    console.log(`WHERE name = 'pro' AND interval = 'month';`);
    console.log('');
  }
  
  if (results['Annual: Standard']?.priceId) {
    console.log(`UPDATE subscription_plans`);
    console.log(`SET stripe_price_id = '${results['Annual: Standard'].priceId}'`);
    console.log(`WHERE name = 'standard' AND interval = 'year';`);
    console.log('');
  }
  
  if (results['Annual: PRO']?.priceId) {
    console.log(`UPDATE subscription_plans`);
    console.log(`SET stripe_price_id = '${results['Annual: PRO'].priceId}'`);
    console.log(`WHERE name = 'pro' AND interval = 'year';`);
    console.log('');
  }

  console.log('\n✅ Done!\n');
}

getPriceIdsFromProducts().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

