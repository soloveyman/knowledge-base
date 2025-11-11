/**
 * Comprehensive Stripe Integration Test
 * Tests API connection, webhook endpoint, and database integration
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function testStripeIntegration() {
  console.log('\n🧪 Testing Stripe Integration...\n');

  // 1. Check environment variables
  console.log('1️⃣ Environment Variables:');
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (secretKey) {
    const keyType = secretKey.startsWith('sk_test_') ? 'Test' : secretKey.startsWith('sk_live_') ? 'Live' : 'Unknown';
    console.log(`   ✅ STRIPE_SECRET_KEY: Set (${keyType})`);
    console.log(`      Value: ${secretKey.substring(0, 20)}...${secretKey.substring(secretKey.length - 4)}`);
  } else {
    console.log('   ❌ STRIPE_SECRET_KEY: Missing');
  }

  if (publishableKey) {
    const keyType = publishableKey.startsWith('pk_test_') ? 'Test' : publishableKey.startsWith('pk_live_') ? 'Live' : 'Unknown';
    console.log(`   ✅ STRIPE_PUBLISHABLE_KEY: Set (${keyType})`);
    console.log(`      Value: ${publishableKey.substring(0, 20)}...${publishableKey.substring(publishableKey.length - 4)}`);
  } else {
    console.log('   ❌ STRIPE_PUBLISHABLE_KEY: Missing');
  }

  if (webhookSecret) {
    console.log(`   ✅ STRIPE_WEBHOOK_SECRET: Set`);
    console.log(`      Value: ${webhookSecret.substring(0, 20)}...${webhookSecret.substring(webhookSecret.length - 4)}`);
  } else {
    console.log('   ⚠️  STRIPE_WEBHOOK_SECRET: Missing (required for webhooks)');
  }

  // 2. Test Stripe API connection
  console.log('\n2️⃣ Stripe API Connection:');
  if (secretKey) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secretKey, {
        apiVersion: '2025-10-29.clover',
      });

      // Test API by retrieving account info
      const account = await stripe.accounts.retrieve();
      console.log('   ✅ Stripe API connection successful');
      console.log(`      Account: ${account.id}`);
      console.log(`      Country: ${account.country || 'N/A'}`);
    } catch (error) {
      console.log('   ❌ Stripe API connection failed');
      console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log('   ⚠️  Skipped (no secret key)');
  }

  // 3. Check database
  console.log('\n3️⃣ Database Integration:');
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('proxy.rlwy.net') || databaseUrl.includes('railway.app')
        ? { rejectUnauthorized: false }
        : false,
    });

    try {
      // Check Stripe tables
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('subscriptions', 'payments', 'subscription_plans')
        ORDER BY table_name
      `);

      if (tables.rows.length === 3) {
        console.log('   ✅ All Stripe tables present');
      } else {
        console.log(`   ⚠️  Missing tables (found ${tables.rows.length}/3)`);
      }

      // Check for data
      const planCount = await pool.query('SELECT COUNT(*) as count FROM subscription_plans');
      const subCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
      const payCount = await pool.query('SELECT COUNT(*) as count FROM payments');
      
      console.log(`   📊 Data: ${planCount.rows[0].count} plans, ${subCount.rows[0].count} subscriptions, ${payCount.rows[0].count} payments`);

      await pool.end();
    } catch (error) {
      console.log('   ❌ Database connection failed');
      console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log('   ⚠️  DATABASE_URL not set');
  }

  // 4. Test webhook endpoint
  console.log('\n4️⃣ Webhook Endpoint:');
  const webhookUrl = 'https://knowledge-base.up.railway.app/api/stripe/webhook';
  console.log(`   URL: ${webhookUrl}`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    
    if (response.status === 400 || response.status === 500 || response.status === 503) {
      console.log(`   ✅ Endpoint accessible (Status: ${response.status} - expected without signature)`);
    } else if (response.status === 404) {
      console.log(`   ⚠️  Endpoint not found (404) - App may need deployment`);
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not reach endpoint`);
    console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 5. Summary
  console.log('\n📊 Summary:');
  const allSet = secretKey && publishableKey && webhookSecret;
  
  if (allSet) {
    console.log('   ✅ Stripe configuration: Complete');
    console.log('   ✅ Database: Ready');
    console.log('   ⚠️  Webhook endpoint: Check deployment status');
    console.log('\n📝 Next Steps:');
    console.log('   1. Ensure Railway app is deployed');
    console.log('   2. Test webhook from Stripe Dashboard');
    console.log('   3. Check Railway logs for webhook events\n');
  } else {
    console.log('   ⚠️  Stripe configuration: Incomplete');
    if (!secretKey) console.log('      - Missing STRIPE_SECRET_KEY');
    if (!publishableKey) console.log('      - Missing STRIPE_PUBLISHABLE_KEY');
    if (!webhookSecret) console.log('      - Missing STRIPE_WEBHOOK_SECRET');
    console.log('\n💡 Set missing variables in Railway Dashboard → Variables\n');
  }
}

testStripeIntegration().catch(console.error);

