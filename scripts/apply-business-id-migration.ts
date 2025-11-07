import 'dotenv/config'
import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function applyBusinessIdMigration() {
  try {
    console.log('Starting business_id migration...\n')

    // Check if columns already exist
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'business_id'
    `)

    if (checkColumns.rows.length > 0) {
      console.log('✓ business_id column already exists in documents')
    } else {
      console.log('Adding business_id column to documents...')
      // First add as nullable
      await db.execute(sql`ALTER TABLE "documents" ADD COLUMN "business_id" uuid`)
      console.log('✓ Added business_id column to documents')
      
      // Backfill from users
      await db.execute(sql`
        UPDATE documents d
        SET business_id = u.business_id
        FROM users u
        WHERE d.uploaded_by = u.id
          AND u.business_id IS NOT NULL
      `)
      
      // Fallback: set to uploaded_by if still NULL
      await db.execute(sql`
        UPDATE documents
        SET business_id = uploaded_by
        WHERE business_id IS NULL
      `)
      
      // Make NOT NULL
      await db.execute(sql`ALTER TABLE "documents" ALTER COLUMN "business_id" SET NOT NULL`)
      console.log('✓ Made business_id NOT NULL in documents')
    }

    // Check and add to tests
    const checkTests = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tests' 
      AND column_name = 'business_id'
    `)

    if (checkTests.rows.length > 0) {
      console.log('✓ business_id column already exists in tests')
    } else {
      console.log('Adding business_id column to tests...')
      await db.execute(sql`ALTER TABLE "tests" ADD COLUMN "business_id" uuid`)
      
      await db.execute(sql`
        UPDATE tests t
        SET business_id = u.business_id
        FROM users u
        WHERE t.created_by = u.id
          AND u.business_id IS NOT NULL
      `)
      
      await db.execute(sql`
        UPDATE tests
        SET business_id = created_by
        WHERE business_id IS NULL
      `)
      
      await db.execute(sql`ALTER TABLE "tests" ALTER COLUMN "business_id" SET NOT NULL`)
      console.log('✓ Added business_id column to tests')
    }

    // Check and add to questions
    const checkQuestions = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'questions' 
      AND column_name = 'business_id'
    `)

    if (checkQuestions.rows.length > 0) {
      console.log('✓ business_id column already exists in questions')
    } else {
      console.log('Adding business_id column to questions...')
      await db.execute(sql`ALTER TABLE "questions" ADD COLUMN "business_id" uuid`)
      
      await db.execute(sql`
        UPDATE questions q
        SET business_id = u.business_id
        FROM users u
        WHERE q.created_by = u.id
          AND u.business_id IS NOT NULL
      `)
      
      await db.execute(sql`
        UPDATE questions
        SET business_id = created_by
        WHERE business_id IS NULL
      `)
      
      await db.execute(sql`ALTER TABLE "questions" ALTER COLUMN "business_id" SET NOT NULL`)
      console.log('✓ Added business_id column to questions')
    }

    // Check and add to modules
    const checkModules = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'modules' 
      AND column_name = 'business_id'
    `)

    if (checkModules.rows.length > 0) {
      console.log('✓ business_id column already exists in modules')
    } else {
      console.log('Adding business_id column to modules...')
      await db.execute(sql`ALTER TABLE "modules" ADD COLUMN "business_id" uuid`)
      
      await db.execute(sql`
        UPDATE modules m
        SET business_id = u.business_id
        FROM users u
        WHERE m.created_by = u.id
          AND u.business_id IS NOT NULL
      `)
      
      await db.execute(sql`
        UPDATE modules
        SET business_id = created_by
        WHERE business_id IS NULL
      `)
      
      await db.execute(sql`ALTER TABLE "modules" ALTER COLUMN "business_id" SET NOT NULL`)
      console.log('✓ Added business_id column to modules')
    }

    // Check and add to assignments
    const checkAssignments = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assignments' 
      AND column_name = 'business_id'
    `)

    if (checkAssignments.rows.length > 0) {
      console.log('✓ business_id column already exists in assignments')
    } else {
      console.log('Adding business_id column to assignments...')
      await db.execute(sql`ALTER TABLE "assignments" ADD COLUMN "business_id" uuid`)
      
      await db.execute(sql`
        UPDATE assignments a
        SET business_id = u.business_id
        FROM users u
        WHERE a.assigned_by = u.id
          AND u.business_id IS NOT NULL
      `)
      
      await db.execute(sql`
        UPDATE assignments
        SET business_id = assigned_by
        WHERE business_id IS NULL
      `)
      
      await db.execute(sql`ALTER TABLE "assignments" ALTER COLUMN "business_id" SET NOT NULL`)
      console.log('✓ Added business_id column to assignments')
    }

    console.log('\n✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}

applyBusinessIdMigration()
  .then(() => {
    console.log('\nMigration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nMigration failed:', error)
    process.exit(1)
  })

