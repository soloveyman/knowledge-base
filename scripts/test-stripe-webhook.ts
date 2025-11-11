/**
 * Test Stripe webhook endpoint
 * This script helps verify the webhook is working
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function testWebhook() {
  console.log('\n🧪 Testing Stripe Webhook Configuration...\n');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('proxy.rlwy.net') || databaseUrl.includes('railway.app')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    // Check webhook endpoint is accessible
    console.log('1️⃣ Checking webhook endpoint...');
    const webhookUrl = 'https://knowledge-base.up.railway.app/api/stripe/webhook';
    console.log(`   URL: ${webhookUrl}`);
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      
      // Webhook should return 400/500 without proper signature, but endpoint should exist
      if (response.status === 400 || response.status === 500 || response.status === 503) {
        console.log('   ✅ Webhook endpoint is accessible');
        console.log(`   Status: ${response.status} (expected - needs Stripe signature)`);
      } else {
        console.log(`   ⚠️  Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not reach webhook endpoint (may need Railway redeploy)');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check database tables
    console.log('\n2️⃣ Checking database tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscriptions', 'payments', 'subscription_plans')
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 3) {
      console.log('   ✅ All Stripe tables present');
      tables.rows.forEach((r: any) => console.log(`      - ${r.table_name}`));
    } else {
      console.log(`   ⚠️  Found ${tables.rows.length}/3 tables`);
    }

    // Check for recent webhook activity (if any)
    console.log('\n3️⃣ Checking for recent activity...');
    const recentPayments = await pool.query(`
      SELECT COUNT(*) as count 
      FROM payments 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);
    
    const recentSubs = await pool.query(`
      SELECT COUNT(*) as count 
      FROM subscriptions 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    console.log(`   Recent payments (last hour): ${recentPayments.rows[0].count}`);
    console.log(`   Recent subscriptions (last hour): ${recentSubs.rows[0].count}`);

    console.log('\n✅ Test Complete!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Go to Stripe Dashboard → Webhooks');
    console.log('   2. Click your endpoint → Send test webhook');
    console.log('   3. Select: checkout.session.completed');
    console.log('   4. Check Railway logs: railway logs');
    console.log('   5. Run this script again to see if data was created\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testWebhook();

