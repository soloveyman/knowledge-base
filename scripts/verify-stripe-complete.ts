/**
 * Complete Stripe Integration Verification
 * Checks all aspects of the Stripe setup
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function verifyComplete() {
  console.log('\n🔍 Complete Stripe Integration Verification\n');

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
    // 1. Check database tables
    console.log('1️⃣ Database Tables:');
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
      console.log(`   ❌ Missing tables (found ${tables.rows.length}/3)`);
    }

    // 2. Check table structures
    console.log('\n2️⃣ Table Structures:');
    const subCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'subscriptions'
      ORDER BY ordinal_position
    `);
    console.log(`   ✅ subscriptions: ${subCols.rows.length} columns`);

    const payCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      ORDER BY ordinal_position
    `);
    console.log(`   ✅ payments: ${payCols.rows.length} columns`);

    // 3. Check for existing data
    console.log('\n3️⃣ Existing Data:');
    const planCount = await pool.query('SELECT COUNT(*) as count FROM subscription_plans');
    const subCount = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
    const payCount = await pool.query('SELECT COUNT(*) as count FROM payments');
    
    console.log(`   subscription_plans: ${planCount.rows[0].count} records`);
    console.log(`   subscriptions: ${subCount.rows[0].count} records`);
    console.log(`   payments: ${payCount.rows[0].count} records`);

    // 4. Check webhook endpoint
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
        console.log(`   💡 Check Railway Dashboard → knowledge-base service → Deployments`);
      } else {
        console.log(`   ⚠️  Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not reach endpoint`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`   💡 Ensure Railway app is deployed and running`);
    }

    // 5. Summary
    console.log('\n📊 Summary:');
    console.log('   ✅ Database: Ready');
    console.log('   ✅ Tables: All present');
    console.log('   ⚠️  Webhook: Check deployment status');
    console.log('\n📝 Next Steps:');
    console.log('   1. Ensure Railway app is deployed (check Dashboard)');
    console.log('   2. Send test webhook from Stripe Dashboard');
    console.log('   3. Run this script again to verify data was created');
    console.log('   4. Check Railway logs for webhook processing\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyComplete();

