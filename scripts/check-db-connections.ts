#!/usr/bin/env tsx
/**
 * Script to check and kill idle database connections
 * Usage: 
 *   npm run db:check-connections  - Check connections
 *   npm run db:kill-idle          - Kill idle connections
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then .env
const envPath = resolve(process.cwd(), '.env.local');
const envPathFallback = resolve(process.cwd(), '.env');
config({ path: envPath });
config({ path: envPathFallback });

import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function checkConnections() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('💡 Make sure .env.local or .env file exists with DATABASE_URL');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Use only 1 connection for this script
    connectionTimeoutMillis: 10000, // 10 seconds timeout
  });

  try {
    // Test connection first
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');
    // Get current connection count and limit
    const statsResult = await pool.query(sql`
      SELECT 
        count(*) as total_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    const stats = statsResult.rows[0];
    console.log('\n📊 Database Connection Statistics:');
    console.log('=====================================');
    console.log(`Total connections: ${stats.total_connections} / ${stats.max_connections}`);
    console.log(`Active: ${stats.active_connections}`);
    console.log(`Idle: ${stats.idle_connections}`);
    console.log(`Idle in transaction: ${stats.idle_in_transaction}`);
    console.log(`Available: ${Number(stats.max_connections) - Number(stats.total_connections)}`);

    // Get detailed connection list
    const connectionsResult = await pool.query(sql`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        state_change,
        query_start,
        LEFT(query, 100) as query_preview
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
      ORDER BY state_change DESC
    `);

    if (connectionsResult.rows.length > 0) {
      console.log('\n📋 Active Connections:');
      console.log('=====================================');
      connectionsResult.rows.forEach((conn, idx) => {
        console.log(`\n${idx + 1}. PID: ${conn.pid}`);
        console.log(`   User: ${conn.usename}`);
        console.log(`   Application: ${conn.application_name || 'N/A'}`);
        console.log(`   State: ${conn.state}`);
        console.log(`   Client: ${conn.client_addr || 'local'}`);
        console.log(`   State changed: ${conn.state_change}`);
        if (conn.query_preview) {
          console.log(`   Query: ${conn.query_preview}...`);
        }
      });
    }

    // Check if we should kill idle connections
    const shouldKill = process.argv.includes('--kill-idle');
    if (shouldKill) {
      console.log('\n🔪 Killing idle connections...');
      
      // Kill idle connections older than 2 minutes (more aggressive)
      const killResult = await pool.query(sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle'
          AND state_change < NOW() - INTERVAL '2 minutes'
      `);

      const killedCount = killResult.rowCount || 0;
      console.log(`✅ Killed ${killedCount} idle connection(s)`);

      // Also kill idle in transaction connections older than 30 seconds
      const killIdleInTransactionResult = await pool.query(sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle in transaction'
          AND state_change < NOW() - INTERVAL '30 seconds'
      `);

      const killedIdleInTransaction = killIdleInTransactionResult.rowCount || 0;
      console.log(`✅ Killed ${killedIdleInTransaction} idle in transaction connection(s)`);
      
      // Kill all connections from same application (except current)
      // This helps if multiple instances are holding connections
      const killSameAppResult = await pool.query(sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND application_name = (SELECT application_name FROM pg_stat_activity WHERE pid = pg_backend_pid())
          AND state IN ('idle', 'idle in transaction')
      `);
      
      const killedSameApp = killSameAppResult.rowCount || 0;
      if (killedSameApp > 0) {
        console.log(`✅ Killed ${killedSameApp} connection(s) from same application`);
      }
      
      const totalKilled = killedCount + killedIdleInTransaction + killedSameApp;
      console.log(`\n✅ Total: ${totalKilled} connection(s) killed`);
      
      // Show updated stats
      const updatedStats = await pool.query(sql`
        SELECT 
          count(*) as total_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      const updated = updatedStats.rows[0];
      console.log(`\n📊 Updated: ${updated.total_connections} / ${updated.max_connections} connections`);
    } else {
      console.log('\n💡 Tip: Run "npm run db:kill-idle" to automatically kill idle connections');
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to database');
      console.error('💡 Make sure:');
      console.error('   1. Database server is running');
      console.error('   2. DATABASE_URL is correct');
      if (process.env.DATABASE_URL?.includes('localhost')) {
        console.error('   3. For local database, run: npm run docker:up');
      }
    } else if (error.message?.includes('too many clients')) {
      console.error('❌ Database connection limit reached!');
      console.error('💡 Try:');
      console.error('   1. Restart the database server');
      console.error('   2. Increase max_connections in PostgreSQL config');
      console.error('   3. Check for connection leaks in your application');
    } else {
      console.error('❌ Error checking connections:', error.message || error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkConnections();

