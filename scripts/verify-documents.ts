import 'dotenv/config'
import { db } from '../lib/db'
import { documents } from '../lib/db'
import { sql } from 'drizzle-orm'

async function verifyDocuments() {
  try {
    console.log('Checking all documents in database...')
    
    // Get all documents
    const allDocs = await db.select().from(documents)
    
    console.log(`\nTotal documents in database: ${allDocs.length}`)
    
    if (allDocs.length > 0) {
      console.log('\nDocuments:')
      allDocs.forEach((doc, index) => {
        console.log(`${index + 1}. ID: ${doc.id}`)
        console.log(`   Title: ${doc.title || doc.originalFileName || 'N/A'}`)
        console.log(`   Status: ${doc.status}`)
        console.log(`   Created: ${doc.createdAt}`)
        if ((doc as any).deletedAt) {
          console.log(`   ⚠️  DELETED AT: ${(doc as any).deletedAt}`)
        }
        console.log('')
      })
    } else {
      console.log('No documents found in database.')
    }
    
    // Check if deleted_at column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'deleted_at'
    `)
    
    if (columnCheck.rows.length > 0) {
      console.log('⚠️  WARNING: deleted_at column still exists!')
      console.log('Run cleanup script to remove it.')
    } else {
      console.log('✅ deleted_at column does not exist (as expected)')
    }
    
  } catch (error) {
    console.error('❌ Error verifying documents:', error)
    throw error
  }
}

verifyDocuments()
  .then(() => {
    console.log('\nVerification completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Verification failed:', error)
    process.exit(1)
  })

