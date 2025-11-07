import 'dotenv/config'
import { db } from '../lib/db'
import { documents, tests, questions, modules, assignments, users } from '../lib/db'
import { eq, sql, isNull } from 'drizzle-orm'

async function backfillBusinessId() {
  try {
    console.log('Starting business_id backfill...\n')

    // Check if business_id column exists in documents
    try {
      await db.execute(sql`SELECT business_id FROM documents LIMIT 1`)
      console.log('✓ business_id column exists in documents')
    } catch (error) {
      console.error('✗ business_id column does not exist in documents')
      console.error('Please run the migration first: npm run db:push')
      return
    }

    // Backfill documents
    console.log('\n1. Backfilling documents...')
    const documentsResult = await db.execute(sql`
      UPDATE documents d
      SET business_id = u.business_id
      FROM users u
      WHERE d.uploaded_by = u.id
        AND d.business_id IS NULL
        AND u.business_id IS NOT NULL
    `)
    console.log(`   Updated ${documentsResult.rowCount || 0} documents`)

    // For documents where businessId is still NULL, set it to uploadedBy (owner's ID)
    const documentsFallback = await db.execute(sql`
      UPDATE documents
      SET business_id = uploaded_by
      WHERE business_id IS NULL
    `)
    console.log(`   Fallback: Updated ${documentsFallback.rowCount || 0} documents with uploaded_by as business_id`)

    // Backfill tests
    console.log('\n2. Backfilling tests...')
    const testsResult = await db.execute(sql`
      UPDATE tests t
      SET business_id = u.business_id
      FROM users u
      WHERE t.created_by = u.id
        AND t.business_id IS NULL
        AND u.business_id IS NOT NULL
    `)
    console.log(`   Updated ${testsResult.rowCount || 0} tests`)

    const testsFallback = await db.execute(sql`
      UPDATE tests
      SET business_id = created_by
      WHERE business_id IS NULL
    `)
    console.log(`   Fallback: Updated ${testsFallback.rowCount || 0} tests with created_by as business_id`)

    // Backfill questions
    console.log('\n3. Backfilling questions...')
    const questionsResult = await db.execute(sql`
      UPDATE questions q
      SET business_id = u.business_id
      FROM users u
      WHERE q.created_by = u.id
        AND q.business_id IS NULL
        AND u.business_id IS NOT NULL
    `)
    console.log(`   Updated ${questionsResult.rowCount || 0} questions`)

    const questionsFallback = await db.execute(sql`
      UPDATE questions
      SET business_id = created_by
      WHERE business_id IS NULL
    `)
    console.log(`   Fallback: Updated ${questionsFallback.rowCount || 0} questions with created_by as business_id`)

    // Backfill modules
    console.log('\n4. Backfilling modules...')
    const modulesResult = await db.execute(sql`
      UPDATE modules m
      SET business_id = u.business_id
      FROM users u
      WHERE m.created_by = u.id
        AND m.business_id IS NULL
        AND u.business_id IS NOT NULL
    `)
    console.log(`   Updated ${modulesResult.rowCount || 0} modules`)

    const modulesFallback = await db.execute(sql`
      UPDATE modules
      SET business_id = created_by
      WHERE business_id IS NULL
    `)
    console.log(`   Fallback: Updated ${modulesFallback.rowCount || 0} modules with created_by as business_id`)

    // Backfill assignments
    console.log('\n5. Backfilling assignments...')
    const assignmentsResult = await db.execute(sql`
      UPDATE assignments a
      SET business_id = u.business_id
      FROM users u
      WHERE a.assigned_by = u.id
        AND a.business_id IS NULL
        AND u.business_id IS NOT NULL
    `)
    console.log(`   Updated ${assignmentsResult.rowCount || 0} assignments`)

    const assignmentsFallback = await db.execute(sql`
      UPDATE assignments
      SET business_id = assigned_by
      WHERE business_id IS NULL
    `)
    console.log(`   Fallback: Updated ${assignmentsFallback.rowCount || 0} assignments with assigned_by as business_id`)

    console.log('\n✅ Business ID backfill completed!')
  } catch (error) {
    console.error('❌ Error backfilling business_id:', error)
    throw error
  }
}

backfillBusinessId()
  .then(() => {
    console.log('\nBackfill completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error)
    process.exit(1)
  })

