import 'dotenv/config'
import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function cleanupSoftDeletedDocs() {
  try {
    console.log('Checking for deleted_at column...')
    
    // Check if column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'deleted_at'
    `)
    
    if (columnCheck.rows.length === 0) {
      console.log('✅ deleted_at column does not exist - nothing to clean up')
      return
    }
    
    console.log('Found deleted_at column. Checking for soft-deleted documents...')
    
    // Count documents with deletedAt set
    const deletedCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM documents
      WHERE deleted_at IS NOT NULL
    `)
    
    const count = (deletedCount.rows[0] as { count: string })?.count || '0'
    console.log(`Found ${count} soft-deleted documents`)
    
    if (parseInt(count) === 0) {
      console.log('✅ No soft-deleted documents to clean up')
      
      // Remove the column since it's not needed
      console.log('Removing deleted_at column...')
      await db.execute(sql`
        ALTER TABLE documents 
        DROP COLUMN IF EXISTS deleted_at
      `)
      console.log('✅ Removed deleted_at column')
      return
    }
    
    // Permanently delete documents with deletedAt set
    console.log(`Permanently deleting ${count} soft-deleted documents...`)
    const deleteResult = await db.execute(sql`
      DELETE FROM documents
      WHERE deleted_at IS NOT NULL
    `)
    
    console.log(`✅ Permanently deleted ${count} documents`)
    
    // Remove the column since it's not needed anymore
    console.log('Removing deleted_at column...')
    await db.execute(sql`
      ALTER TABLE documents 
      DROP COLUMN IF EXISTS deleted_at
    `)
    console.log('✅ Removed deleted_at column')
    
  } catch (error) {
    console.error('❌ Error cleaning up soft-deleted documents:', error)
    throw error
  }
}

cleanupSoftDeletedDocs()
  .then(() => {
    console.log('Cleanup completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Cleanup failed:', error)
    process.exit(1)
  })

