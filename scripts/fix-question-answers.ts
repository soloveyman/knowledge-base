/**
 * Script to fix correct answers for complete and cloze question types
 * This script checks and fixes questions where correct_answer might be incorrectly stored as an index instead of text
 */

// IMPORTANT: Load environment variables using require() to ensure it runs before imports
const dotenv = require('dotenv')
const { resolve } = require('path')

// Load environment variables from .env.local (primary) and .env (fallback)
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

// Load .env.local first, then .env as fallback
const envLocal = dotenv.config({ path: envLocalPath })
const env = dotenv.config({ path: envPath })

async function fixQuestionAnswers() {
  // Use dynamic imports AFTER env vars are loaded to avoid hoisting issues
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const { questions } = await import('../lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set')
    console.error(`   Checked: ${envLocalPath} (${envLocal.error ? 'not found' : 'loaded'})`)
    console.error(`   Checked: ${envPath} (${env.error ? 'not found' : 'loaded'})`)
    console.error('   Please ensure .env.local exists with DATABASE_URL set')
    console.error('   Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_base')
    process.exit(1)
  }

  // Detect if this is a cloud database (Railway, Vercel, etc.) that requires SSL
  const isCloudDb = databaseUrl.includes('railway') || 
                    databaseUrl.includes('proxy.rlwy.net') || 
                    databaseUrl.includes('railway.app') ||
                    databaseUrl.includes('vercel') ||
                    databaseUrl.includes('neon.tech') ||
                    databaseUrl.includes('supabase.co') ||
                    process.env.NODE_ENV === 'production'
  
  console.log('🚀 Starting question answers fix...')
  console.log(`📍 Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`)
  console.log(`🌐 Cloud database: ${isCloudDb ? 'Yes (SSL enabled)' : 'No (local connection)'}`)
  
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Cloud databases (Railway, Vercel, Neon, Supabase) require SSL
    ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
  })

  const db = drizzle(pool)

  try {
    console.log('🔌 Testing database connection...')
    await pool.query('SELECT 1')
    console.log('✅ Database connection successful')

    // Find all questions with type 'text' (which includes complete and cloze)
    // that have tags indicating they are complete or cloze types
    console.log('\n📋 Finding questions that need fixing...')
    
    const allQuestions = await db.select().from(questions)
    
    console.log(`Found ${allQuestions.length} total questions`)
    
    let fixedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    for (const question of allQuestions) {
      try {
        // Check if this is a complete or cloze question based on tags
        const tags = question.tags as { originalType?: string } | null
        const originalType = tags?.originalType
        
        // Log all questions for debugging
        console.log(`\n📝 Question ${question.id}:`)
        console.log(`   Type: ${question.type}`)
        console.log(`   Original Type: ${originalType || 'none'}`)
        console.log(`   Correct Answer: ${question.correctAnswer || 'empty'}`)
        
        const correctAnswer = question.correctAnswer
        const options = question.options as string[] | null
        
        // Process multiple choice questions (mcq and mcq_multi)
        if (question.type === 'multiple_choice' && (originalType === 'mcq' || originalType === 'mcq_multi' || !originalType)) {
          console.log(`   ✅ Processing multiple choice question (${originalType || 'mcq'})...`)
          
          if (!correctAnswer || correctAnswer.trim() === '') {
            console.log(`   ⚠️  Empty correct_answer`)
            skippedCount++
            continue
          }
          
          if (!options || options.length === 0) {
            console.log(`   ⚠️  No options available`)
            skippedCount++
            continue
          }
          
          let needsFix = false
          let fixedAnswer = correctAnswer.trim()
          const originalAnswer = fixedAnswer
          
          // Handle mcq_multi (comma-separated answers)
          if (originalType === 'mcq_multi' || /[,;]/.test(fixedAnswer)) {
            console.log(`   Processing multiple correct answers...`)
            const parts = fixedAnswer.split(/[,;\s]+/).filter(p => p.length > 0)
            const fixedParts: string[] = []
            
            for (const part of parts) {
              let fixedPart = part.trim()
              
              // If it's a letter (A, B, C, D), convert to 1-based index
              if (/^[A-Z]$/i.test(fixedPart)) {
                const letterIndex = fixedPart.toUpperCase().charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
                const oneBasedIndex = letterIndex + 1 // A=1, B=2, C=3, D=4
                if (oneBasedIndex >= 1 && oneBasedIndex <= options.length) {
                  fixedPart = String(oneBasedIndex)
                  needsFix = true
                  console.log(`     Converted letter "${part}" to index ${fixedPart}`)
                }
              }
              // If it's 0-based index (0, 1, 2, 3), convert to 1-based (1, 2, 3, 4)
              else if (/^\d+$/.test(fixedPart)) {
                const index = parseInt(fixedPart, 10)
                if (index === 0) {
                  // "0" is invalid, convert to "1"
                  fixedPart = '1'
                  needsFix = true
                  console.log(`     Fixed invalid index "0" to "1"`)
                } else if (index >= 1 && index <= options.length) {
                  // Already 1-based, keep as-is
                  fixedPart = String(index)
                } else if (index < 0 || index > options.length) {
                  // Out of range, set to 1
                  fixedPart = '1'
                  needsFix = true
                  console.log(`     Fixed out-of-range index "${index}" to "1"`)
                }
              }
              // If it's text, try to find in options
              else if (fixedPart) {
                const choiceIndex = options.findIndex(
                  opt => opt.trim().toLowerCase() === fixedPart.toLowerCase()
                )
                if (choiceIndex >= 0) {
                  fixedPart = String(choiceIndex + 1) // Convert to 1-based
                  needsFix = true
                  console.log(`     Found text "${part}" in options at index ${fixedPart}`)
                }
              }
              
              if (fixedPart && /^\d+$/.test(fixedPart)) {
                const index = parseInt(fixedPart, 10)
                if (index >= 1 && index <= options.length) {
                  fixedParts.push(fixedPart)
                }
              }
            }
            
            if (needsFix && fixedParts.length > 0) {
              fixedAnswer = fixedParts.join(',')
            }
          }
          // Handle single choice (mcq)
          else {
            // If it's a letter (A, B, C, D), convert to 1-based index
            if (/^[A-Z]$/i.test(fixedAnswer)) {
              const letterIndex = fixedAnswer.toUpperCase().charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
              const oneBasedIndex = letterIndex + 1 // A=1, B=2, C=3, D=4
              if (oneBasedIndex >= 1 && oneBasedIndex <= options.length) {
                fixedAnswer = String(oneBasedIndex)
                needsFix = true
                console.log(`   Converted letter "${originalAnswer}" to index ${fixedAnswer}`)
              }
            }
            // If it's 0-based index (0, 1, 2, 3), convert to 1-based (1, 2, 3, 4)
            else if (/^\d+$/.test(fixedAnswer)) {
              const index = parseInt(fixedAnswer, 10)
              if (index === 0) {
                // "0" is invalid, convert to "1"
                fixedAnswer = '1'
                needsFix = true
                console.log(`   Fixed invalid index "0" to "1"`)
              } else if (index >= 1 && index <= options.length) {
                // Already 1-based, keep as-is
                fixedAnswer = String(index)
              } else if (index < 0 || index > options.length) {
                // Out of range, set to 1
                fixedAnswer = '1'
                needsFix = true
                console.log(`   Fixed out-of-range index "${index}" to "1"`)
              }
            }
            // If it's text, try to find in options
            else if (fixedAnswer) {
              const choiceIndex = options.findIndex(
                opt => opt.trim().toLowerCase() === fixedAnswer.toLowerCase()
              )
              if (choiceIndex >= 0) {
                fixedAnswer = String(choiceIndex + 1) // Convert to 1-based
                needsFix = true
                console.log(`   Found text "${originalAnswer}" in options at index ${fixedAnswer}`)
              }
            }
          }
          
          if (needsFix && fixedAnswer !== originalAnswer) {
            await db
              .update(questions)
              .set({
                correctAnswer: fixedAnswer,
                requiresReview: true,
                updatedAt: new Date()
              })
              .where(eq(questions.id, question.id))
            
            console.log(`   ✅ Fixed: Updated correct_answer from "${originalAnswer}" to "${fixedAnswer}"`)
            fixedCount++
          } else {
            console.log(`   ✅ Already correct: "${originalAnswer}"`)
          }
          
          continue
        }
        
        // Process complete and cloze questions
        if (originalType === 'complete' || originalType === 'cloze') {
          console.log(`   ✅ Processing ${originalType} question...`)
          
          // Skip if correct answer is empty
          if (!correctAnswer || correctAnswer.trim() === '') {
            console.log(`⚠️  Question ${question.id}: Empty correct_answer for ${originalType} question`)
            skippedCount++
            continue
          }
          
          // Check if correct answer looks like an index (single digit 1-9)
          // For complete/cloze, correct answer should be text, not an index
          if (/^[1-9]$/.test(correctAnswer.trim())) {
            console.log(`⚠️  Question ${question.id}: correct_answer looks like an index ("${correctAnswer}") for ${originalType} question`)
            
            // Try to find the answer in options if available
            if (options && options.length > 0) {
              const index = parseInt(correctAnswer, 10) - 1 // Convert to 0-based
              if (index >= 0 && index < options.length) {
                const textAnswer = options[index]
                console.log(`   Found answer in options: "${textAnswer}"`)
                
                // Update the question with the text answer
                await db
                  .update(questions)
                  .set({
                    correctAnswer: textAnswer,
                    requiresReview: true, // Mark for review since we had to fix it
                    updatedAt: new Date()
                  })
                  .where(eq(questions.id, question.id))
                
                console.log(`   ✅ Fixed: Updated correct_answer from "${correctAnswer}" to "${textAnswer}"`)
                fixedCount++
              } else {
                console.log(`   ❌ Index ${correctAnswer} is out of range for options array`)
                // Mark as requiring review
                await db
                  .update(questions)
                  .set({
                    requiresReview: true,
                    updatedAt: new Date()
                  })
                  .where(eq(questions.id, question.id))
                errorCount++
              }
            } else {
              console.log(`   ⚠️  No options available, cannot fix automatically`)
              // Mark as requiring review
              await db
                .update(questions)
                .set({
                  requiresReview: true,
                  updatedAt: new Date()
                })
                .where(eq(questions.id, question.id))
              errorCount++
            }
          } else {
            // Correct answer looks like text, which is correct
            console.log(`✅ Question ${question.id}: correct_answer is text ("${correctAnswer.substring(0, 50)}...") - OK`)
          }
        }
      } catch (error) {
        console.error(`❌ Error processing question ${question.id}:`, error)
        errorCount++
      }
    }
    
    console.log('\n📊 Summary:')
    console.log(`   ✅ Fixed: ${fixedCount}`)
    console.log(`   ⚠️  Skipped (empty): ${skippedCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   ✅ Total processed: ${fixedCount + skippedCount + errorCount}`)
    
    if (fixedCount > 0 || errorCount > 0) {
      console.log('\n💡 Note: Questions that were fixed or had errors have been marked with requiresReview=true')
      console.log('   Please review these questions manually to ensure correctness.')
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await pool.end()
    console.log('\n🔌 Database connection closed')
  }
}

fixQuestionAnswers()

