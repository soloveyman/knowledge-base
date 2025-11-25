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
    // IMPORTANT: With multiple serverless instances, total connections = max × instances
    // For Railway Hobby (20 connections), we need very conservative pool sizes
    const isVercel = !!process.env.VERCEL
    const isProduction = process.env.NODE_ENV === 'production'
    
    // Very conservative pool sizes to avoid "too many clients" error
    // Railway Hobby: ~20 connections total
    // Local PostgreSQL default: ~100 connections, but can be lower
    // If we have 4-5 serverless instances, each should use max 3-4 connections
    const maxConnections = isProduction 
      ? (isVercel ? 3 : 5) // Production: very conservative
      : (isLocalhost ? 3 : (isVercel ? 5 : 10)) // Local: very conservative, others: more generous
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: maxConnections,
      idleTimeoutMillis: isLocalhost ? 5000 : 10000, // 5s for local, 10s for remote - more aggressive to free connections faster
      connectionTimeoutMillis: 5000, // 5 seconds - fail fast if can't connect
      // Allow pool to create connections on demand (better for serverless)
      min: 0, // Start with 0, create connections as needed
      // Close idle connections more aggressively
      allowExitOnIdle: true, // Allow process to exit when pool is idle
      // Force close connections that are idle too long
      ...(isLocalhost && {
        // For localhost, be even more aggressive
        statement_timeout: 30000, // 30 seconds max query time
      }),
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
      
      // Log pool state for "too many clients" errors
      if (err.message && err.message.includes('too many clients')) {
        console.error('⚠️ Database connection pool exhausted!', {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
          max: pool.options.max,
          min: pool.options.min
        });
      }
    });

    // Handle connection events for monitoring
    const shouldLog = process.env.DEBUG_DB === 'true' || process.env.NODE_ENV === 'production'
    if (shouldLog) {
      pool.on('connect', (client) => {
        console.log('[DB Pool] New client connected', {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        });
      });

      pool.on('remove', () => {
        console.log('[DB Pool] Client removed', {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        });
      });
      
      // Log pool state periodically in production (every 5 minutes)
      if (process.env.NODE_ENV === 'production') {
        setInterval(() => {
          console.log('[DB Pool] State:', {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            max: pool.options.max,
            min: pool.options.min
          });
        }, 5 * 60 * 1000); // Every 5 minutes
      }
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
