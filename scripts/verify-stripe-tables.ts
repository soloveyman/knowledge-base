import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function verifyStripeTables() {
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
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscriptions', 'payments', 'subscription_plans')
      ORDER BY table_name
    `);

    console.log('\n✅ Stripe tables in Railway database:');
    result.rows.forEach((r: any) => console.log(`   ✓ ${r.table_name}`));

    if (result.rows.length === 3) {
      console.log('\n✅ All Stripe tables are present!');
    } else {
      console.log(`\n⚠️  Expected 3 tables, found ${result.rows.length}`);
    }

    // Check columns in subscriptions
    const subCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'subscriptions'
      ORDER BY ordinal_position
    `);
    console.log(`\n📋 Subscriptions table has ${subCols.rows.length} columns`);

    // Check columns in payments
    const payCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      ORDER BY ordinal_position
    `);
    console.log(`📋 Payments table has ${payCols.rows.length} columns`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyStripeTables();

