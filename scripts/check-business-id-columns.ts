import 'dotenv/config'
import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function checkBusinessIdColumns() {
  try {
    console.log('Checking business_id columns...\n')

    // Check documents table
    const docColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name LIKE '%business%'
    `)
    console.log('Documents table columns:', docColumns.rows)

    // Check if there are any NULL values
    const docNulls = await db.execute(sql`
      SELECT COUNT(*) as null_count
      FROM documents
      WHERE business_id IS NULL
    `)
    console.log('Documents with NULL business_id:', docNulls.rows[0])

    // Try to query with business_id
    try {
      const testQuery = await db.execute(sql`
        SELECT id, business_id 
        FROM documents 
        LIMIT 1
      `)
      console.log('✓ Query with business_id works:', testQuery.rows[0])
    } catch (error) {
      console.error('✗ Query with business_id failed:', error)
    }

    // Check actual column name (case sensitive)
    const allColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY column_name
    `)
    console.log('\nAll columns in documents table:')
    allColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}`)
    })

  } catch (error) {
    console.error('Error:', error)
  }
}

checkBusinessIdColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

