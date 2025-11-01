#!/usr/bin/env tsx

/**
 * Script to check if Railway database schema matches the app schema
 * Compares expected columns with actual database columns
 */

import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
})

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
}

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n')

    // Check tests table
    console.log('📋 Checking tests table...')
    const testsColumns = await pool.query<ColumnInfo>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tests'
      ORDER BY column_name
    `)

    const testsColumnNames = testsColumns.rows.map(r => r.column_name)
    
    // Expected columns based on schema.ts
    const expectedTestsColumns = [
      'id',
      'module_id',
      'title',
      'description',
      'question_ids',
      'type',
      'difficulty',
      'locale',
      'passing_score',
      'time_limit',
      'max_attempts',
      'shuffle_questions',
      'show_correct_answers',
      'status',
      'is_active',
      'created_by',
      'created_at',
      'updated_at'
    ]

    console.log('\n✅ Existing columns:', testsColumnNames.join(', '))
    console.log('\n📝 Expected columns:', expectedTestsColumns.join(', '))

    const missingColumns = expectedTestsColumns.filter(
      col => !testsColumnNames.includes(col)
    )
    const extraColumns = testsColumnNames.filter(
      col => !expectedTestsColumns.includes(col)
    )

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns:', missingColumns.join(', '))
      console.log('\n💡 Run the migration script to add missing columns:')
      console.log('   npx tsx scripts/add-test-columns.ts')
      console.log('   OR run the SQL directly:')
      console.log('   psql $DATABASE_URL < scripts/add-test-columns.sql')
    } else {
      console.log('\n✅ All expected columns exist!')
    }

    if (extraColumns.length > 0) {
      console.log('\n⚠️  Extra columns (not in schema):', extraColumns.join(', '))
    }

    // Check other critical tables
    console.log('\n\n📋 Checking other tables...')
    const tables = ['users', 'documents', 'assignments', 'questions']
    
    for (const table of tables) {
      const columns = await pool.query<ColumnInfo>(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY column_name
      `, [table])
      
      console.log(`\n${table}: ${columns.rows.length} columns`)
      if (columns.rows.length === 0) {
        console.log(`  ⚠️  Table '${table}' not found or empty`)
      }
    }

    console.log('\n✅ Schema check complete!')
    
  } catch (error) {
    console.error('❌ Error checking schema:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

checkSchema()

