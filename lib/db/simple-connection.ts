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

    // Create the database connection pool with same conservative settings as main pool
    const isVercel = !!process.env.VERCEL
    const isProduction = process.env.NODE_ENV === 'production'
    const isLocalhost = process.env.DATABASE_URL?.includes('localhost') || 
                       process.env.DATABASE_URL?.includes('127.0.0.1')
    
    const maxConnections = isProduction 
      ? (isVercel ? 3 : 5) // Production: very conservative
      : (isLocalhost ? 3 : (isVercel ? 5 : 10)) // Local: very conservative, others: more generous
    
    const newPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: maxConnections,
      idleTimeoutMillis: isLocalhost ? 5000 : 10000, // 5s for local, 10s for remote - more aggressive to free connections faster
      connectionTimeoutMillis: 5000, // 5 seconds - fail fast if can't connect
      min: 0, // Start with 0, create connections as needed
      allowExitOnIdle: true, // Allow process to exit when pool is idle
      // SSL for Railway or production
      ssl:
        !isLocalhost && (
          process.env.NODE_ENV === 'production' ||
          process.env.DATABASE_URL.includes('railway.app')
        )
          ? { rejectUnauthorized: false }
          : false,
    });
    pool = newPool;
    
    // Handle pool errors
    newPool.on('error', (err) => {
      console.error('Unexpected database pool error (simple-connection):', err);
      
      // Log pool state for "too many clients" errors
      if (err.message && err.message.includes('too many clients')) {
        console.error('⚠️ Database connection pool exhausted (simple-connection)!', {
          totalCount: newPool.totalCount,
          idleCount: newPool.idleCount,
          waitingCount: newPool.waitingCount,
          max: newPool.options.max,
          min: newPool.options.min
        });
      }
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
