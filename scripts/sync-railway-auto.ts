/**
 * Auto-sync Railway database using Railway CLI
 * This script automatically gets DATABASE_URL from Railway and runs migrations
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

async function syncRailwayAuto() {
  console.log('🚀 Auto-syncing Railway database...\n');

  // Step 1: Get DATABASE_URL from Railway
  console.log('📡 Getting DATABASE_URL from Railway...');
  let databaseUrl: string | null = null;

  try {
    // Try to get DATABASE_URL from Railway CLI
    // Railway automatically provides DATABASE_URL when PostgreSQL is linked
    const railwayVars = execSync('railway variables --json', { encoding: 'utf-8' });
    const vars = JSON.parse(railwayVars);
    
    // Check if DATABASE_URL exists in current service
    if (vars.DATABASE_URL) {
      databaseUrl = vars.DATABASE_URL;
      console.log('✅ Found DATABASE_URL in Railway service variables');
    } else {
      // Try to get from PostgreSQL service
      console.log('   DATABASE_URL not in app service, checking PostgreSQL service...');
      
      // List all services and find PostgreSQL
      try {
        const servicesOutput = execSync('railway service list 2>&1', { encoding: 'utf-8' });
        console.log('   Available services:', servicesOutput);
        
        // Try common PostgreSQL service names
        const postgresNames = ['postgres', 'postgresql', 'database', 'db'];
        for (const name of postgresNames) {
          try {
            const pgVars = execSync(`railway variables --service ${name} --json 2>&1`, { encoding: 'utf-8' });
            const pgVarsObj = JSON.parse(pgVars);
            if (pgVarsObj.DATABASE_URL || pgVarsObj.POSTGRES_URL) {
              databaseUrl = pgVarsObj.DATABASE_URL || pgVarsObj.POSTGRES_URL;
              console.log(`✅ Found DATABASE_URL in ${name} service`);
              break;
            }
          } catch (e) {
            // Service doesn't exist, continue
          }
        }
      } catch (e) {
        console.log('   Could not list services');
      }
    }

    if (!databaseUrl) {
      // Check if DATABASE_URL is in .env.local
      const envLocalPath = join(process.cwd(), '.env.local');
      if (existsSync(envLocalPath)) {
        const envContent = readFileSync(envLocalPath, 'utf-8');
        const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
        if (match) {
          databaseUrl = match[1];
          console.log('✅ Found DATABASE_URL in .env.local');
        }
      }
    }

    if (!databaseUrl) {
      console.error('\n❌ Could not find DATABASE_URL');
      console.error('\nPlease set DATABASE_URL manually:');
      console.error('  1. Go to Railway Dashboard → PostgreSQL Service → Variables');
      console.error('  2. Copy DATABASE_URL');
      console.error('  3. Add to .env.local: DATABASE_URL="your-connection-string"');
      console.error('\nOr run: railway variables --json and look for DATABASE_URL');
      process.exit(1);
    }

    // Mask password in logs
    const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`📍 Database: ${maskedUrl}\n`);

    // Step 2: Set DATABASE_URL and run sync
    console.log('📦 Running database sync...\n');
    
    // Set environment variable and run sync script
    process.env.DATABASE_URL = databaseUrl;
    
    // Import and run the sync script
    const syncModule = await import('./sync-railway-db');
    await syncModule.syncRailwayDatabase();

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
    process.exit(1);
  }
}

// Check if Railway CLI is available
try {
  execSync('railway --version', { stdio: 'ignore' });
} catch (e) {
  console.error('❌ Railway CLI not found');
  console.error('   Install it: npm i -g @railway/cli');
  console.error('   Then run: railway login');
  process.exit(1);
}

syncRailwayAuto();

