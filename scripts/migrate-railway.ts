import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../lib/db/schema';

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🚀 Starting Railway database migration...');
  console.log(`📍 Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

  const pool = new Pool({
    connectionString: databaseUrl,
    // Railway-optimized connection settings
    max: 2, // Use minimal connections for migration
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  try {
    // Test connection first
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Run migrations
    console.log('📦 Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

runMigrations();

