import { NextResponse } from 'next/server'
import { db, tests, questions as questionsTable, users, usage } from '@/lib/db'
import { eq, desc, sql, inArray, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { createTestSchema, type QuestionInput } from '@/lib/schemas/tests'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'

/**
 * Get owner ID for usage counting - if user is owner, return their ID,
 * if user is manager/employee, find owner with same businessId
 */
async function getOwnerIdForUsage(userId: string, userRole: string, businessId: string | null): Promise<string | null> {
  // If user is owner, use their ID
  if (userRole === 'owner') {
    return userId
  }
  
  // If user is manager/employee, find owner with same businessId
  if (businessId) {
    const owner = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, 'owner'),
          eq(users.businessId, businessId)
        )
      )
      .limit(1)
    
    if (owner.length > 0) {
      return owner[0].id
    }
  }
  
  return null
}

// Route segment config
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)
export const maxDuration = 60 // 60 seconds for test creation with many questions

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 })
    }
    
    const userRole = session?.user?.role
    
    // Explicitly select columns that exist (handle case where new columns don't exist yet)
    // Try with all columns first, fallback to excluding new columns if they don't exist
    try {
      // All roles filter by businessId for tenant isolation (except super-admin)
      const tenantId = session?.user?.businessId
      
      // Super-admin sees all tests
      if (userRole === 'super-admin') {
        const allTests = await db
          .select({
            id: tests.id,
            moduleId: tests.moduleId,
            title: tests.title,
            description: tests.description,
            questionIds: tests.questionIds,
            type: tests.type,
            difficulty: tests.difficulty,
            locale: tests.locale,
            passingScore: tests.passingScore,
            timeLimit: tests.timeLimit,
            maxAttempts: tests.maxAttempts,
            shuffleQuestions: tests.shuffleQuestions,
            showCorrectAnswers: tests.showCorrectAnswers,
            status: tests.status,
            isActive: tests.isActive,
            createdBy: tests.createdBy,
            createdAt: tests.createdAt,
            updatedAt: tests.updatedAt
          })
          .from(tests)
          .orderBy(desc(tests.createdAt))
        
        return NextResponse.json({
          success: true,
          data: {
            tests: allTests
          }
        })
      }
      
      if (!tenantId) {
        // If no businessId, return empty array for non-owner users
        return NextResponse.json({
          success: true,
          data: {
            tests: []
          }
        })
      }
      
      // Get user IDs for the tenant first
      const tenantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, tenantId))
      
      const tenantUserIds = tenantUsers.map(u => u.id)
      
      if (tenantUserIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            tests: []
          }
        })
      }
      
      // Query tests created by users in the tenant
      const allTests = await db
        .select({
          id: tests.id,
          moduleId: tests.moduleId,
          title: tests.title,
          description: tests.description,
          questionIds: tests.questionIds,
          type: tests.type,
          difficulty: tests.difficulty,
          locale: tests.locale,
          passingScore: tests.passingScore,
          timeLimit: tests.timeLimit,
          maxAttempts: tests.maxAttempts,
          shuffleQuestions: tests.shuffleQuestions,
          showCorrectAnswers: tests.showCorrectAnswers,
          status: tests.status,
          isActive: tests.isActive,
          createdBy: tests.createdBy,
          createdAt: tests.createdAt,
          updatedAt: tests.updatedAt
        })
        .from(tests)
        .where(inArray(tests.createdBy, tenantUserIds))
        .orderBy(desc(tests.createdAt))

      return NextResponse.json({
        success: true,
        data: {
          tests: allTests
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch (selectError: unknown) {
      // If columns don't exist, fallback to selecting without new columns
      const errorMessage = selectError instanceof Error ? selectError.message : String(selectError)
      const errorCause = (selectError as any)?.cause
      const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
      const fullErrorText = `${errorMessage} ${nestedMessage}`
      
      if (fullErrorText.includes('column "type" does not exist') || 
          fullErrorText.includes('column "difficulty" does not exist') ||
          fullErrorText.includes('column "locale" does not exist')) {
        console.log('New columns not found, using fallback query without type/difficulty/locale')
        
        // Fallback: select without new columns
        if (userRole === 'owner') {
          const allTests = await db
            .select({
              id: tests.id,
              moduleId: tests.moduleId,
              title: tests.title,
              description: tests.description,
              questionIds: tests.questionIds,
              passingScore: tests.passingScore,
              timeLimit: tests.timeLimit,
              maxAttempts: tests.maxAttempts,
              shuffleQuestions: tests.shuffleQuestions,
              showCorrectAnswers: tests.showCorrectAnswers,
              status: tests.status,
              isActive: tests.isActive,
              createdBy: tests.createdBy,
              createdAt: tests.createdAt,
              updatedAt: tests.updatedAt
            })
            .from(tests)
            .orderBy(desc(tests.createdAt))
          
          // Add default values for missing columns
          const testsWithDefaults = allTests.map(test => ({
            ...test,
            type: null,
            difficulty: null,
            locale: null
          }))
          
          return NextResponse.json({
            success: true,
            data: {
              tests: testsWithDefaults
            }
          })
        }
        
        const tenantId = session?.user?.businessId
        
        if (!tenantId) {
          // If no businessId, return empty array for non-owner users
          return NextResponse.json({
            success: true,
            data: {
              tests: []
            }
          })
        }
        
        // Get user IDs for the tenant first
        const tenantUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.businessId, tenantId))
        
        const tenantUserIds = tenantUsers.map(u => u.id)
        
        if (tenantUserIds.length === 0) {
          return NextResponse.json({
            success: true,
            data: {
              tests: []
            }
          })
        }
        
        // Query tests created by users in the tenant
        const allTests = await db
          .select({
            id: tests.id,
            moduleId: tests.moduleId,
            title: tests.title,
            description: tests.description,
            questionIds: tests.questionIds,
            passingScore: tests.passingScore,
            timeLimit: tests.timeLimit,
            maxAttempts: tests.maxAttempts,
            shuffleQuestions: tests.shuffleQuestions,
            showCorrectAnswers: tests.showCorrectAnswers,
            status: tests.status,
            isActive: tests.isActive,
            createdBy: tests.createdBy,
            createdAt: tests.createdAt,
            updatedAt: tests.updatedAt
          })
          .from(tests)
          .where(inArray(tests.createdBy, tenantUserIds))
          .orderBy(desc(tests.createdAt))
        
        // Add default values for missing columns
        const testsWithDefaults = allTests.map(test => ({
          ...test,
          type: null,
          difficulty: null,
          locale: null
        }))

        return NextResponse.json({
          success: true,
          data: {
            tests: testsWithDefaults
          }
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
          }
        })
      }
      throw selectError
    }
  } catch (error) {
    return handleApiError(error, 'Failed to fetch tests', 500)
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { hasPermission } = await import('@/lib/auth')
    if (!hasPermission(session.user.role, 'TESTS', 'create')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to create tests' 
      }, { status: 403 })
    }
    // Validate request body
    const validation = await validateRequest(request, createTestSchema)
    if (!validation.success) {
      return validation.response
    }

    const {
      title,
      description,
      moduleId,
      questionIds,
      questions,
      type,
      difficulty,
      locale,
      passingScore,
      timeLimit,
      maxAttempts,
      shuffleQuestions,
      showCorrectAnswers,
      status,
    } = validation.data

    console.log('Creating test:', {
      title,
      description,
      moduleId,
      questionIdsCount: questionIds?.length,
      questionsCount: questions?.length,
      type,
      difficulty,
      locale
    })

    let finalQuestionIds: string[] = questionIds || []
    // Use Drizzle's inferred type for questions
    type SavedQuestion = typeof questionsTable.$inferSelect
    let savedQuestions: SavedQuestion[] = []

    // If questions are provided, save them to database first
    if (questions && questions.length > 0) {
      try {
        console.log('Saving questions to database...')
        console.log('Questions data:', JSON.stringify(questions, null, 2))
        
        const questionData = questions
          .map((q: QuestionInput, index: number) => {
            try {
              console.log(`Processing question ${index}:`, q)
              console.log(`Question ${index} correct_answer:`, q.correct_answer, 'correctAnswer:', q.correctAnswer)
              
              // Get correct answer - prioritize correct_answer over correctAnswer
              const correctAnswerValue = q.correct_answer ?? q.correctAnswer ?? ''
              
              // Validate correct answer for multiple choice questions
              // Indices start from 1 (A=1, B=2, C=3, D=4)
              let finalCorrectAnswer = correctAnswerValue
              
              // Handle complete and cloze types - preserve text answers as-is
              if (q.type === 'complete' || q.type === 'cloze') {
                // For text-based questions, keep the answer as-is (trimmed)
                if (correctAnswerValue && typeof correctAnswerValue === 'string') {
                  finalCorrectAnswer = correctAnswerValue.trim()
                  console.log(`Question ${index}: Preserved text answer for ${q.type}: "${finalCorrectAnswer}"`)
                } else {
                  console.warn(`Question ${index}: Empty or invalid correct_answer for ${q.type} question`)
                }
              }
              // Handle match and order types - preserve comma-separated answers as-is
              else if ((q.type === 'match' || q.type === 'order') && correctAnswerValue) {
                // For match and order, correct_answer should be comma-separated indices like "1,2,3,4"
                // Validate that all indices are valid
                const parts = correctAnswerValue.split(/[,;\s]+/).filter(p => p.length > 0)
                const validParts: string[] = []
                for (const part of parts) {
                  if (/^\d+$/.test(part)) {
                    const index = parseInt(part, 10)
                    if (q.choices && index >= 1 && index <= q.choices.length) {
                      validParts.push(part)
                    }
                  } else if (/^[A-Z]$/i.test(part)) {
                    // Convert letter to index
                    const letterIndex = part.toUpperCase().charCodeAt(0) - 65
                    const oneBasedIndex = letterIndex + 1
                    if (q.choices && oneBasedIndex >= 1 && oneBasedIndex <= q.choices.length) {
                      validParts.push(String(oneBasedIndex))
                    }
                  }
                }
                if (validParts.length > 0) {
                  finalCorrectAnswer = validParts.join(',')
                }
              } else if ((q.type === 'mcq' || q.type === 'mcq_multi') && q.choices && q.choices.length > 0) {
                // If correct answer is a letter (A, B, C, D), convert to 1-based index
                if (/^[A-Z]$/.test(correctAnswerValue)) {
                  const letterIndex = correctAnswerValue.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
                  const oneBasedIndex = letterIndex + 1 // A=1, B=2, C=3, D=4
                  if (oneBasedIndex >= 1 && oneBasedIndex <= q.choices.length) {
                    finalCorrectAnswer = String(oneBasedIndex)
                    console.log(`Question ${index}: Converted letter "${correctAnswerValue}" to index ${oneBasedIndex}`)
                  } else {
                    console.warn(`Question ${index}: Invalid letter "${correctAnswerValue}", using first option (1)`)
                    finalCorrectAnswer = '1'
                  }
                }
                // If correct answer is a number string (index), validate it (1-based)
                else if (/^\d+$/.test(correctAnswerValue)) {
                  const index = parseInt(correctAnswerValue, 10)
                  if (index < 1 || index > q.choices.length) {
                    console.warn(`Question ${index}: Invalid correct_answer index ${index}, using first option (1)`)
                    finalCorrectAnswer = '1'
                  } else {
                    finalCorrectAnswer = correctAnswerValue // Keep as string index (1-based)
                  }
                } else if (correctAnswerValue) {
                  // If it's text, try to find it in choices
                  const choiceIndex = q.choices.findIndex(
                    choice => choice.trim().toLowerCase() === correctAnswerValue.trim().toLowerCase()
                  )
                  if (choiceIndex >= 0) {
                    const oneBasedIndex = choiceIndex + 1 // Convert 0-based to 1-based
                    finalCorrectAnswer = String(oneBasedIndex)
                    console.log(`Question ${index}: Converted text answer "${correctAnswerValue}" to index ${oneBasedIndex}`)
                  } else {
                    console.warn(`Question ${index}: Could not find correct answer "${correctAnswerValue}" in choices, using first option (1)`)
                    finalCorrectAnswer = '1'
                  }
                }
              }
              
              // Convert frontend question types to database types
              let dbType = 'multiple_choice' // default
              if (q.type === 'mcq' || q.type === 'mcq_multi') {
                dbType = 'multiple_choice'
              } else if (q.type === 'tf') {
                dbType = 'true_false'
              } else if (q.type === 'complete' || q.type === 'cloze') {
                dbType = 'text'
              } else if (q.type === 'match' || q.type === 'order' || q.type === 'mixed') {
                dbType = 'multiple_choice' // These complex types are stored as multiple_choice for now
              } else if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'text') {
                dbType = q.type // Already in database format
              }
              
              // Save original question type in tags for proper restoration
              const tags = q.type ? { originalType: q.type } : null
              
              const processed = {
                title: q.prompt || q.title || 'Untitled Question',
                content: q.prompt || q.content || '',
                type: dbType,
                options: q.choices || null,
                correctAnswer: finalCorrectAnswer,
                explanation: q.explanation || '',
                difficulty: 'medium',
                tags: tags,
                moduleId: null, // Documents are not modules, so set to null
                createdBy: session.user.id
              }
              console.log(`Processed question ${index} - correctAnswer:`, processed.correctAnswer)
              return processed
            } catch (mapError) {
              console.error(`Error processing question ${index}:`, mapError)
              throw new Error(`Failed to process question ${index}: ${mapError instanceof Error ? mapError.message : 'Unknown error'}`)
            }
          })
        
        console.log('Processed question data:', JSON.stringify(questionData, null, 2))
        
        savedQuestions = await db.insert(questionsTable).values(
          questionData.map((q) => ({ ...q, createdBy: session.user.id }))
        ).returning()

        finalQuestionIds = savedQuestions.map(q => q.id)
        console.log('Questions saved:', savedQuestions.length)
      } catch (questionError) {
        console.error('Error saving questions:', questionError)
        const errorMessage = questionError instanceof Error ? questionError.message : String(questionError)
        const errorCause = questionError instanceof Error && 'cause' in questionError ? questionError.cause : undefined
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`
        console.error('Full question error:', fullErrorText)
        throw new Error(`Failed to save questions: ${fullErrorText}`)
      }
    }

    // Create the test - handle missing columns gracefully
    // Don't include type, difficulty, locale initially (they might not exist in DB)
    const baseTestValues = {
      title,
      description: description || '',
      moduleId: null, // Documents are not modules, so set to null
      questionIds: finalQuestionIds, // Array of question IDs
      passingScore: passingScore || 70,
      timeLimit: timeLimit || null,
      maxAttempts: maxAttempts || 1,
      shuffleQuestions: shuffleQuestions || false,
      showCorrectAnswers: showCorrectAnswers !== false, // Default to true
      status: status || 'draft',
      createdBy: session.user.id
    }
    
    let newTest
    try {
      // First try with new columns if provided
      const testValuesWithNewColumns = {
        ...baseTestValues,
        ...(type !== undefined && { type: type || null }),
        ...(difficulty !== undefined && { difficulty: difficulty || null }),
        ...(locale !== undefined && { locale: locale || null })
      }
      newTest = await db.insert(tests).values(testValuesWithNewColumns).returning()
    } catch (insertError: unknown) {
      // If insert fails due to missing columns, try without new columns
      // Drizzle errors can be deeply nested, so we need to check all levels
      const errorMessage = insertError instanceof Error ? insertError.message : String(insertError)
      let errorCause: unknown = insertError instanceof Error && 'cause' in insertError ? insertError.cause : undefined
      let nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
      
      // Check for nested causes (Drizzle can nest errors deeply)
      while (errorCause && typeof errorCause === 'object' && 'cause' in errorCause) {
        const deeperCause = (errorCause as { cause: unknown }).cause
        if (deeperCause instanceof Error) {
          nestedMessage += ' ' + deeperCause.message
          errorCause = deeperCause
        } else if (typeof deeperCause === 'string') {
          nestedMessage += ' ' + deeperCause
          errorCause = null
        } else {
          break
        }
      }
      
      // Also check the error object's string representation
      const errorString = insertError?.toString() || ''
      const fullErrorText = `${errorMessage} ${nestedMessage} ${errorString}`.trim()
      
      console.log('Insert error details:', { 
        errorMessage, 
        nestedMessage, 
        errorString,
        fullErrorText,
        errorObject: JSON.stringify(insertError, Object.getOwnPropertyNames(insertError))
      })
      
      // Check for missing column errors - handle various quote formats and relation text
      // Pattern: column "type" of relation "tests" does not exist
      const hasTypeError = /column\s+["\']type["\']/i.test(fullErrorText) && 
                          /does not exist/i.test(fullErrorText)
      const hasDifficultyError = /column\s+["\']difficulty["\']/i.test(fullErrorText) && 
                                /does not exist/i.test(fullErrorText)
      const hasLocaleError = /column\s+["\']locale["\']/i.test(fullErrorText) && 
                            /does not exist/i.test(fullErrorText)
      
      console.log('Column error checks:', { hasTypeError, hasDifficultyError, hasLocaleError })
      
      if (hasTypeError || hasDifficultyError || hasLocaleError) {
        console.log('New columns not available, creating test without type/difficulty/locale')
        
        try {
          // Use raw SQL to insert without the non-existent columns
          // This bypasses Drizzle's schema inference
          const result = await db.execute(sql`
            INSERT INTO tests (
              module_id, title, description, question_ids,
              passing_score, time_limit, max_attempts,
              shuffle_questions, show_correct_answers, status, created_by
            )
            VALUES (
              ${baseTestValues.moduleId}, ${baseTestValues.title}, ${baseTestValues.description}, ${JSON.stringify(baseTestValues.questionIds)}::jsonb,
              ${baseTestValues.passingScore}, ${baseTestValues.timeLimit}, ${baseTestValues.maxAttempts},
              ${baseTestValues.shuffleQuestions}, ${baseTestValues.showCorrectAnswers}, ${baseTestValues.status}, ${baseTestValues.createdBy}
            )
            RETURNING id, module_id, title, description, question_ids,
              passing_score, time_limit, max_attempts,
              shuffle_questions, show_correct_answers, status, is_active,
              created_by, created_at, updated_at
          `)
          
          // Transform the result to match the expected format
          const inserted = result.rows[0]
          newTest = [{
            id: inserted.id,
            moduleId: inserted.module_id,
            title: inserted.title,
            description: inserted.description,
            questionIds: inserted.question_ids,
            passingScore: inserted.passing_score,
            timeLimit: inserted.time_limit,
            maxAttempts: inserted.max_attempts,
            shuffleQuestions: inserted.shuffle_questions,
            showCorrectAnswers: inserted.show_correct_answers,
            status: inserted.status,
            isActive: inserted.is_active,
            createdBy: inserted.created_by,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
            type: null,
            difficulty: null,
            locale: null
          }]
        } catch (retryError: unknown) {
          console.error('Retry insert also failed:', retryError)
          throw retryError
        }
      } else {
        throw insertError
      }
    }

    console.log('Test created successfully:', newTest[0])

    // Check usage limit before allowing generation (for owners and managers - count in owner's usage)
    if (session.user.role === 'owner' || session.user.role === 'manager') {
      const ownerId = await getOwnerIdForUsage(session.user.id, session.user.role, session.user.businessId)
      
      if (ownerId) {
        const { checkUsageLimit } = await import('@/lib/subscription/usage-check')
        const limitCheck = await checkUsageLimit(ownerId, 'generations')
        
        if (!limitCheck.allowed) {
          return NextResponse.json({
            success: false,
            message: limitCheck.message || 'Generation limit reached. Please upgrade your plan to continue.',
            error: 'USAGE_LIMIT_EXCEEDED',
            current: limitCheck.current,
            max: limitCheck.max
          }, { status: 403 })
        }

        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        
        // Check if usage record exists for current month
        const existingUsage = await db
          .select()
          .from(usage)
          .where(
            and(
              eq(usage.userId, ownerId),
              eq(usage.month, currentMonth)
            )
          )
          .limit(1)

        if (existingUsage.length > 0) {
          // Update existing usage record
          await db
            .update(usage)
            .set({
              generationsCount: (existingUsage[0].generationsCount || 0) + 1,
              updatedAt: new Date()
            })
            .where(eq(usage.id, existingUsage[0].id))
          
          console.log(`[Usage Update] Test generation by ${session.user.role} (${session.user.id}) counted in owner's (${ownerId}) usage. New generationsCount: ${(existingUsage[0].generationsCount || 0) + 1}`)
        } else {
          // Create new usage record
          await db.insert(usage).values({
            userId: ownerId,
            month: currentMonth,
            importsCount: 0,
            generationsCount: 1
          })
          
          console.log(`[Usage Update] Test generation by ${session.user.role} (${session.user.id}) counted in owner's (${ownerId}) usage. Created new usage record with generationsCount: 1`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        test: newTest[0],
        questions: savedQuestions || []
      },
      message: 'Test saved successfully'
    })
  } catch (error) {
    return handleApiError(error, 'Failed to save test', 500)
  }
}
