import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../lib/db/schema';

/**
 * Syncs local database schema to Railway database
 * This script pushes the current schema directly to Railway
 */
export async function syncRailwayDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Set it to your Railway PostgreSQL connection string');
    process.exit(1);
  }

  // Check if this is a Railway connection
  const isRailway = databaseUrl.includes('railway.app') || databaseUrl.includes('proxy.rlwy.net');
  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const isRailwayInternal = databaseUrl.includes('railway.internal');

  // Warn if using internal domain from outside Railway
  if (isRailwayInternal && !process.env.RAILWAY_ENVIRONMENT) {
    console.error('\n❌ ERROR: Cannot connect to Railway internal domain from local machine');
    console.error('   The connection string uses "railway.internal" which only works inside Railway.');
    console.error('\n📝 To fix this:');
    console.error('   1. Go to Railway Dashboard → PostgreSQL Service → Variables');
    console.error('   2. Look for connection string with "proxy.rlwy.net" or "*.railway.app"');
    console.error('   3. Copy that public connection string');
    console.error('   4. Add to .env.local: DATABASE_URL="postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway"');
    console.error('\n   Or use Railway CLI to get public URL:');
    console.error('   railway variables --service postgres');
    process.exit(1);
  }

  console.log('🚀 Syncing database schema to Railway...');
  console.log(`📍 Database: ${isRailway ? 'Railway' : isLocalhost ? 'Local' : 'Unknown'}`);
  console.log(`📍 URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Railway requires SSL, local doesn't
    ssl: !isLocalhost && (isRailway || process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : false,
  });

  const db = drizzle(pool, { schema });

  try {
    // Test connection
    console.log('\n🔌 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');

    // Check existing tables
    console.log('\n📊 Checking existing tables...');
    const existingTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`   Found ${existingTables.rows.length} existing tables`);

    // Verify Stripe-related tables
    const stripeTables = ['subscriptions', 'payments', 'subscription_plans'];
    const existingTableNames = existingTables.rows.map((r: any) => r.table_name);
    const missingStripeTables = stripeTables.filter(t => !existingTableNames.includes(t));

    if (missingStripeTables.length > 0) {
      console.log(`\n⚠️  Missing Stripe tables: ${missingStripeTables.join(', ')}`);
      console.log('   These will be created during schema push...');
    } else {
      console.log('✅ All Stripe tables present');
    }

    // Run migrations to sync schema
    console.log('\n📦 Running migrations to sync schema...');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');

    // Verify Stripe tables after push
    console.log('\n🔍 Verifying Stripe tables...');
    const finalTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscriptions', 'payments', 'subscription_plans')
      ORDER BY table_name
    `);
    
    const finalTableNames = finalTables.rows.map((r: any) => r.table_name);
    console.log(`   Stripe tables: ${finalTableNames.join(', ')}`);

    if (finalTableNames.length === 3) {
      console.log('✅ All Stripe tables verified!');
    } else {
      console.warn(`⚠️  Expected 3 Stripe tables, found ${finalTableNames.length}`);
    }

    // Check columns in subscriptions table
    console.log('\n🔍 Verifying subscriptions table structure...');
    const subscriptionColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'subscriptions'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['id', 'user_id', 'plan_id', 'status', 'current_period_start', 'current_period_end'];
    const existingColumns = subscriptionColumns.rows.map((r: any) => r.column_name);
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c));

    if (missingColumns.length === 0) {
      console.log('✅ All required subscription columns present');
    } else {
      console.warn(`⚠️  Missing columns: ${missingColumns.join(', ')}`);
    }

    // Check columns in payments table
    console.log('\n🔍 Verifying payments table structure...');
    const paymentColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
      ORDER BY ordinal_position
    `);
    
    const requiredPaymentColumns = ['id', 'owner_id', 'subscription_id', 'provider', 'provider_payment_id', 'amount', 'currency', 'status'];
    const existingPaymentCols = paymentColumns.rows.map((r: any) => r.column_name);
    const missingPaymentCols = requiredPaymentColumns.filter(c => !existingPaymentCols.includes(c));

    if (missingPaymentCols.length === 0) {
      console.log('✅ All required payment columns present');
    } else {
      console.warn(`⚠️  Missing columns: ${missingPaymentCols.join(', ')}`);
    }

    console.log('\n✅ Database sync completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify Stripe webhook endpoint is configured in Railway');
    console.log('   2. Set STRIPE_WEBHOOK_SECRET in Railway environment variables');
    console.log('   3. Test webhook endpoint: npm run verify:stripe');

  } catch (error) {
    console.error('\n❌ Database sync failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Only run if called directly (not imported)
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  syncRailwayDatabase();
}

