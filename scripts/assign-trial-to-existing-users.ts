/**
 * Script to assign free trial plan to existing users who don't have a subscription
 * Run this to give existing owners a free trial
 */

// IMPORTANT: Load environment variables using require() to ensure it runs before imports
// Using require() instead of import ensures synchronous execution before module evaluation
const dotenv = require('dotenv');
const { resolve } = require('path');

// Load environment variables from .env.local (primary)
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

// Load .env.local first, then .env as fallback
const envLocal = dotenv.config({ path: envLocalPath });
const env = dotenv.config({ path: envPath });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error(`   Checked: ${envLocalPath} (${envLocal.error ? 'not found' : 'loaded'})`);
  console.error(`   Checked: ${envPath} (${env.error ? 'not found' : 'loaded'})`);
  console.error('   Please ensure .env.local exists with DATABASE_URL set');
  console.error('   Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_base');
  process.exit(1);
}

async function assignTrialToExistingUsers() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { db } = await import('@/lib/db');
  const { eq, sql } = await import('drizzle-orm');
  const { assignFreeTrialToOwner, getOrCreateTrialPlan } = await import('@/lib/subscription/trial');
  
  try {
    console.log('Setting up free trial plan...');
    
    // Ensure trial plan exists
    const trialPlan = await getOrCreateTrialPlan();
    console.log(`✅ Trial plan ready: ${trialPlan.displayName} (${trialPlan.id})`);
    
    // Get all owners who don't have a subscription
    // Note: subscriptions table uses 'user_id' column (mapped to ownerId in schema)
    const ownersWithoutSubscription = await db.execute(sql`
      SELECT u.id, u.email, u.name
      FROM users u
      WHERE u.role = 'owner'
        AND u.id NOT IN (
          SELECT DISTINCT s.user_id
          FROM subscriptions s
          WHERE s.user_id IS NOT NULL
        )
    `);

    console.log(`\nFound ${ownersWithoutSubscription.rows.length} owners without subscriptions`);
    
    if (ownersWithoutSubscription.rows.length === 0) {
      console.log('✅ All owners already have subscriptions');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    console.log('\nAssigning free trials...\n');

    for (const owner of ownersWithoutSubscription.rows as Array<{
      id: string;
      email: string;
      name: string | null;
    }>) {
      try {
        const result = await assignFreeTrialToOwner(owner.id);
        
        if (result) {
          successCount++;
          console.log(`✅ Assigned trial to: ${owner.email} (${owner.name || 'No name'})`);
        } else {
          // Already has subscription (edge case - may have been added between queries)
          console.log(`⏭️  Skipped: ${owner.email} (already has subscription)`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to assign trial to ${owner.email}:`, error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`✅ Successfully assigned: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⏭️  Skipped: ${ownersWithoutSubscription.rows.length - successCount - errorCount}`);
    console.log('='.repeat(50));

    if (errorCount > 0) {
      console.warn('\n⚠️  Some assignments failed. Check the errors above.');
      process.exit(1);
    }

    console.log('\n✅ All eligible owners have been assigned free trials!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to assign trials:', error);
    process.exit(1);
  }
}

assignTrialToExistingUsers();

