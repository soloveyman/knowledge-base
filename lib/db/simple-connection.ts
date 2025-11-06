import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './simple-schema';

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is required');
}

// Create the database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL for Railway or production
  ssl:
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL.includes('railway.app') ||
    process.env.DATABASE_URL.includes('rlwy.net')
      ? { rejectUnauthorized: false }
      : false,
});

// Create the database connection
export const db = drizzle(pool, { schema });

// Test connection function
export async function testSimpleConnection() {
  try {
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    console.log('✅ Simple database connection successful!');
    console.log('Current time:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Simple database connection failed:', error);
    return false;
  }
}
