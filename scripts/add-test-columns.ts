#!/usr/bin/env tsx

/**
 * Script to add missing columns to tests table in Railway database
 * Adds: type, difficulty, locale
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

async function addColumns() {
  try {
    console.log('🚀 Adding missing columns to tests table...\n')

    // Check if columns exist
    const checkColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tests'
    `)
    
    const existingColumns = checkColumns.rows.map(r => r.column_name)
    console.log('Existing columns:', existingColumns.join(', '))

    // Add columns if they don't exist
    const columnsToAdd = [
      { name: 'type', type: 'text' },
      { name: 'difficulty', type: 'text' },
      { name: 'locale', type: 'text' }
    ]

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`➕ Adding column: ${col.name} (${col.type})`)
        await pool.query(`ALTER TABLE tests ADD COLUMN ${col.name} ${col.type}`)
        console.log(`✅ Added ${col.name}`)
      } else {
        console.log(`⏭️  Column ${col.name} already exists, skipping`)
      }
    }

    console.log('\n✅ Migration complete!')
    console.log('\n📋 Final column list:')
    const finalColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tests'
      ORDER BY column_name
    `)
    console.log(finalColumns.rows.map(r => r.column_name).join(', '))
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addColumns()

