import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './simple-schema';

// Lazy initialization to avoid errors during build time
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!pool) {
    // Validate DATABASE_URL only when actually needed
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create the database connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // SSL for Railway or production
      ssl:
        process.env.NODE_ENV === 'production' ||
        process.env.DATABASE_URL.includes('railway.app')
          ? { rejectUnauthorized: false }
          : false,
    });
  }
  return pool;
}

// Create the database connection (lazy)
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (!dbInstance) {
      dbInstance = drizzle(getPool(), { schema });
    }
    return dbInstance[prop as keyof typeof dbInstance];
  },
});

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
