import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Lazy initialization to avoid errors during build time
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!pool) {
    // Prevent database access on the client side
    if (typeof window !== 'undefined') {
      throw new Error('Database access is not available on the client side. This module should only be imported in server components or API routes.');
    }
    
    // Validate DATABASE_URL only when actually needed
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Check if this is a local Docker connection (no SSL needed)
    const isLocalhost = process.env.DATABASE_URL?.includes('localhost') || 
                       process.env.DATABASE_URL?.includes('127.0.0.1')

    // Optimized connection pool configuration for Vercel + Railway
    // Vercel serverless functions: each instance is isolated, can scale to many concurrent instances
    // Railway connection limits:
    // - Hobby: ~20 connections
    // - Pro: ~100 connections
    // - Enterprise: Custom
    // Pool size accounts for: max connections per instance × concurrent instances
    const isVercel = !!process.env.VERCEL
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: isVercel ? 5 : 10, // Smaller pool for Vercel (more instances = more total connections)
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 10000, // 10 seconds
      // Allow pool to create connections on demand (better for serverless)
      min: 0, // Start with 0, create connections as needed
      // SSL for production and Railway (Railway uses SSL)
      // Also enable SSL if connection string contains 'railway.app' (connecting to Railway from anywhere)
      // Disable SSL for local Docker connections (localhost)
      ssl:
        !isLocalhost && (
          process.env.NODE_ENV === 'production' ||
          process.env.DATABASE_URL?.includes('railway.app')
        )
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

    // Graceful shutdown handler
    if (typeof process !== 'undefined') {
      const gracefulShutdown = async () => {
        console.log('Closing database connection pool...');
        await pool?.end();
        console.log('Database connection pool closed');
      };

      process.on('SIGTERM', gracefulShutdown);
      process.on('SIGINT', gracefulShutdown);
    }
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

// Export all schema tables for easy access
export * from './schema';
