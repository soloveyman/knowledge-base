// Script to check what tables exist in Railway database
const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:KmsCHlaYPXiYjGCSiauFtXDnwQFScoDw@turntable.proxy.rlwy.net:57698/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function checkTables() {
  console.log('🔍 Checking tables in Railway database...');
  console.log('📍 Database: Railway (turntable.proxy.rlwy.net)\n');
  
  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📊 Found ${tablesResult.rows.length} tables:\n`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    
    // Check specifically for document_images
    console.log('\n🔍 Checking document_images table...');
    const documentImagesExists = tablesResult.rows.some(r => r.table_name === 'document_images');
    
    if (documentImagesExists) {
      console.log('✅ document_images table exists');
      
      // Check columns
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'document_images'
        ORDER BY ordinal_position
      `);
      
      console.log(`\n📋 Columns in document_images (${columnsResult.rows.length}):\n`);
      columnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Check row count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM document_images');
      console.log(`\n📊 Rows in document_images: ${countResult.rows[0].count}`);
    } else {
      console.log('❌ document_images table does NOT exist');
      console.log('\n⚠️  You may need to run all migrations first');
    }
    
    // Check for documents table
    console.log('\n🔍 Checking documents table...');
    const documentsExists = tablesResult.rows.some(r => r.table_name === 'documents');
    if (documentsExists) {
      console.log('✅ documents table exists');
      const countResult = await pool.query('SELECT COUNT(*) as count FROM documents');
      console.log(`📊 Rows in documents: ${countResult.rows[0].count}`);
    } else {
      console.log('❌ documents table does NOT exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

checkTables();

