// One-time script to apply Spaces migration to Railway database
// This script has the Railway DATABASE_URL hardcoded for convenience

const { Pool } = require('pg');

// Railway database URL
const databaseUrl = 'postgresql://postgres:KmsCHlaYPXiYjGCSiauFtXDnwQFScoDw@turntable.proxy.rlwy.net:57698/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }, // Railway requires SSL
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function applyMigration() {
  console.log('🚀 Applying Spaces migration to Railway database...');
  console.log('📍 Database: Railway (turntable.proxy.rlwy.net)');
  
  try {
    // Test connection first
    console.log('\n🔌 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    
    // Check if columns already exist
    console.log('\n🔍 Checking existing columns...');
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'document_images' 
      AND column_name IN ('url', 'storage_key')
    `);
    
    const existingColumns = checkColumns.rows.map(r => r.column_name);
    console.log(`   Found columns: ${existingColumns.length > 0 ? existingColumns.join(', ') : 'none'}`);
    
    await pool.query('BEGIN');
    
    // Add url and storage_key columns if they don't exist
    if (!existingColumns.includes('url')) {
      await pool.query(`
        ALTER TABLE "document_images" 
        ADD COLUMN "url" text;
      `);
      console.log('✅ Added url column');
    } else {
      console.log('ℹ️  url column already exists, skipping');
    }
    
    if (!existingColumns.includes('storage_key')) {
      await pool.query(`
        ALTER TABLE "document_images" 
        ADD COLUMN "storage_key" text;
      `);
      console.log('✅ Added storage_key column');
    } else {
      console.log('ℹ️  storage_key column already exists, skipping');
    }
    
    // Make data column nullable (safe to run multiple times)
    try {
      await pool.query(`
        ALTER TABLE "document_images" 
        ALTER COLUMN "data" DROP NOT NULL;
      `);
      console.log('✅ Made data column nullable');
    } catch (error) {
      // Column might already be nullable, that's fine
      if (error.message.includes('does not exist') || error.message.includes('already')) {
        console.log('ℹ️  data column is already nullable');
      } else {
        throw error;
      }
    }
    
    await pool.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Verify columns were added
    const verifyColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'document_images' 
      AND column_name IN ('url', 'storage_key', 'data')
      ORDER BY column_name
    `);
    
    console.log('\n📊 Verification:');
    verifyColumns.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyMigration();

