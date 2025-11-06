import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

// Validate DATABASE_URL at startup
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is required');
}

// Railway-optimized connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway connection limits:
  // - Hobby: ~20 connections
  // - Pro: ~100 connections
  // - Enterprise: Custom
  max: 10, // Conservative limit for Railway
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 seconds
  // SSL for production and Railway (Railway uses SSL)
  // Also enable SSL if connection string contains 'railway.app' or 'rlwy.net' (connecting to Railway from anywhere)
  ssl:
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL?.includes('railway.app') ||
    process.env.DATABASE_URL?.includes('rlwy.net')
      ? { rejectUnauthorized: false }
      : false,
  // Log connections in development
  ...(process.env.NODE_ENV === 'development' &&
    process.env.DEBUG_DB === 'true' && {
      log: (msg: string) => console.log('[DB Pool]', msg),
    }),
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Handle connection events for monitoring
if (process.env.DEBUG_DB === 'true') {
  pool.on('connect', () => {
    console.log('[DB Pool] New client connected');
  });

  pool.on('remove', () => {
    console.log('[DB Pool] Client removed');
  });
}

// Create the database connection
export const db = drizzle(pool, { schema });

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  const gracefulShutdown = async () => {
    console.log('Closing database connection pool...');
    await pool.end();
    console.log('Database connection pool closed');
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Export all schema tables for easy access
export * from './schema';

// Helper to check if a table exists
let tableExistsCache: Map<string, boolean> = new Map()

export async function tableExists(tableName: string): Promise<boolean> {
  // Check cache first
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName)!
  }
  
  try {
    const result = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      )`
    )
    const exists = (result.rows[0] as { exists: boolean })?.exists ?? false
    tableExistsCache.set(tableName, exists)
    return exists
  } catch {
    // If check fails, assume table doesn't exist
    tableExistsCache.set(tableName, false)
    return false
  }
}