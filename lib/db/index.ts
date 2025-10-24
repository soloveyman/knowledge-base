import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create the database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the database connection
export const db = drizzle(pool, { schema });

// Export all schema tables for easy access
export * from './schema';
