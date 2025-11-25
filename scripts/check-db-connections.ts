#!/usr/bin/env tsx
/**
 * Script to check and kill idle database connections
 * Usage: npx tsx scripts/check-db-connections.ts [--kill-idle]
 */

import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function checkConnections() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Use only 1 connection for this script
  });

  try {
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
      
      // Kill idle connections older than 5 minutes
      const killResult = await pool.query(sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle'
          AND state_change < NOW() - INTERVAL '5 minutes'
      `);

      const killedCount = killResult.rowCount || 0;
      console.log(`✅ Killed ${killedCount} idle connection(s)`);

      // Also kill idle in transaction connections older than 1 minute
      const killIdleInTransactionResult = await pool.query(sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
          AND state = 'idle in transaction'
          AND state_change < NOW() - INTERVAL '1 minute'
      `);

      const killedIdleInTransaction = killIdleInTransactionResult.rowCount || 0;
      console.log(`✅ Killed ${killedIdleInTransaction} idle in transaction connection(s)`);
    } else {
      console.log('\n💡 Tip: Use --kill-idle flag to kill idle connections older than 5 minutes');
    }

  } catch (error) {
    console.error('❌ Error checking connections:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkConnections();

