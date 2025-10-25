import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './simple-schema';

// Create the database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the database connection
export const db = drizzle(pool, { schema });

// Test connection function
export async function testSimpleConnection() {
  try {
    const result = await db.execute('SELECT NOW() as current_time');
    console.log('✅ Simple database connection successful!');
    console.log('Current time:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Simple database connection failed:', error);
    return false;
  }
}
