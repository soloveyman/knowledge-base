/**
 * Get Stripe Price IDs from Payment Links
 * 
 * Payment Links contain Price IDs, but we need to extract them via Stripe API
 * 
 * Run: tsx scripts/get-price-ids-from-payment-links.ts
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

// Payment Links provided by user
const paymentLinks = {
  'Monthly: Standard': 'https://buy.stripe.com/8x200l7QO9Uo1Lc8axcwg00',
  'Monthly: PRO': 'https://buy.stripe.com/eVqbJ32wu0jO2Pg8axcwg01',
  'Annual: Standard': 'https://buy.stripe.com/4gMdRb3AyfeI1Lc9eBcwg02',
  'Annual: PRO': 'https://buy.stripe.com/5kQdRbfjg3w0gG69eBcwg03',
};

async function getPriceIdsFromPaymentLinks() {
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-10-29.clover',
    typescript: true,
  });

  console.log('\n🔍 Extracting Price IDs from Payment Links...\n');

  const results: Record<string, { priceId: string | null; error?: string }> = {};

  for (const [planName, paymentLink] of Object.entries(paymentLinks)) {
    try {
      // Extract payment link ID from URL
      // Format: https://buy.stripe.com/{payment_link_id}
      const paymentLinkId = paymentLink.split('/').pop()?.split('?')[0];
      
      if (!paymentLinkId) {
        results[planName] = { priceId: null, error: 'Invalid payment link URL' };
        continue;
      }

      console.log(`📋 Processing: ${planName}`);
      console.log(`   Payment Link ID: ${paymentLinkId}`);

      // Retrieve payment link from Stripe
      const link = await stripe.paymentLinks.retrieve(paymentLinkId);
      
      // Payment links can have multiple line items, but for subscriptions usually one
      if (link.line_items && link.line_items.data.length > 0) {
        const priceId = link.line_items.data[0].price?.id;
        
        if (priceId) {
          results[planName] = { priceId };
          console.log(`   ✅ Price ID: ${priceId}\n`);
        } else {
          results[planName] = { priceId: null, error: 'No price ID found in payment link' };
          console.log(`   ⚠️  No price ID found\n`);
        }
      } else {
        results[planName] = { priceId: null, error: 'No line items in payment link' };
        console.log(`   ⚠️  No line items found\n`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results[planName] = { priceId: null, error: errorMessage };
      console.log(`   ❌ Error: ${errorMessage}\n`);
    }
  }

  // Summary
  console.log('\n📊 Summary:\n');
  console.log('Price IDs extracted from Payment Links:');
  console.log('─'.repeat(60));
  
  for (const [planName, result] of Object.entries(results)) {
    if (result.priceId) {
      console.log(`${planName.padEnd(25)} → ${result.priceId}`);
    } else {
      console.log(`${planName.padEnd(25)} → ❌ ${result.error || 'Not found'}`);
    }
  }

  console.log('\n📝 Next steps:');
  console.log('1. Add stripe_price_id column to database:');
  console.log('   tsx scripts/add-stripe-price-id-column.ts');
  console.log('\n2. Update plans in database with these Price IDs');
  console.log('\n3. SQL example:');
  console.log('   UPDATE subscription_plans');
  console.log('   SET stripe_price_id = \'price_xxx\'');
  console.log('   WHERE name = \'standard\' AND interval = \'month\';');
  
  console.log('\n');
}

getPriceIdsFromPaymentLinks().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

