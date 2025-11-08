import { NextResponse } from 'next/server'
import { db, tests, questions as questionsTable, users, usage } from '@/lib/db'
import { eq, desc, sql, inArray, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

// Route segment config
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
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
        })
      }
      throw selectError
    }
  } catch (error) {
    console.error('Tests API error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCause = (error as any)?.cause
    const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
    const fullErrorText = `${errorMessage} ${nestedMessage}`
    console.error('Full tests API error:', fullErrorText)
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch tests',
      error: fullErrorText || 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    // Parse request body with error handling for large payloads
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return NextResponse.json({ 
        success: false, 
        message: 'Request body too large. Maximum payload size is 4.5MB (Vercel limit).' 
      }, { status: 413 })
    }
    const { 
      title, 
      description, 
      moduleId, 
      questionIds, 
      questions, // The actual question objects
      type,
      difficulty,
      locale,
      passingScore, 
      timeLimit, 
      maxAttempts, 
      shuffleQuestions, 
      showCorrectAnswers, 
      status 
    } = body

    console.log('Creating test:', { 
      title, 
      description, 
      moduleId, 
      questionIdsCount: questionIds?.length,
      questionsCount: questions?.length,
      questions: questions
    })

    // Validate required fields
    if (!title || (!questionIds && !questions)) {
      return NextResponse.json({
        success: false,
        message: 'Title and questions are required'
      }, { status: 400 })
    }

    let finalQuestionIds: string[] = questionIds || []
    let savedQuestions: any[] = []

    // If questions are provided, save them to database first
    if (questions && questions.length > 0) {
      try {
        console.log('Saving questions to database...')
        console.log('Questions data:', JSON.stringify(questions, null, 2))
        
        interface QuestionInput {
          prompt?: string
          title?: string
          content?: string
          type?: string
          choices?: string[]
          correct_answer?: string
          correctAnswer?: string // Support both snake_case and camelCase
          explanation?: string
        }
        
        const questionData = questions
          .filter((q: unknown): q is QuestionInput => q !== null && typeof q === 'object')
          .map((q: QuestionInput, index: number) => {
            try {
              console.log(`Processing question ${index}:`, q)
              const processed = {
                title: q.prompt || q.title || 'Untitled Question',
                content: q.prompt || q.content || '',
                type: q.type === 'mcq' ? 'multiple_choice' : 
                      q.type === 'tf' ? 'true_false' : 
                      q.type === 'complete' ? 'text' : 'multiple_choice',
                options: q.choices || null,
                correctAnswer: q.correct_answer || q.correctAnswer || '',
                explanation: q.explanation || '',
                difficulty: 'medium',
                moduleId: null, // Documents are not modules, so set to null
                createdBy: session.user.id
              }
              console.log(`Processed question ${index}:`, processed)
              return processed
            } catch (mapError) {
              console.error(`Error processing question ${index}:`, mapError)
              throw new Error(`Failed to process question ${index}: ${mapError instanceof Error ? mapError.message : 'Unknown error'}`)
            }
          })
        
        console.log('Processed question data:', JSON.stringify(questionData, null, 2))
        
        savedQuestions = await db.insert(questionsTable).values(
          questionData.map((q: typeof questionData[number]) => ({ ...q, createdBy: session.user.id }))
        ).returning()

        finalQuestionIds = savedQuestions.map(q => q.id)
        console.log('Questions saved:', savedQuestions.length)
      } catch (questionError) {
        console.error('Error saving questions:', questionError)
        const errorMessage = questionError instanceof Error ? questionError.message : String(questionError)
        const errorCause = (questionError as any)?.cause
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
      let errorCause = (insertError as any)?.cause
      let nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
      
      // Check for nested causes (Drizzle can nest errors deeply)
      while (errorCause && typeof errorCause === 'object' && 'cause' in errorCause) {
        const deeperCause = errorCause.cause
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

    // Update usage counter for AI generations (only for owners)
    if (session.user.role === 'owner') {
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // Check if usage record exists for current month
      const existingUsage = await db
        .select()
        .from(usage)
        .where(
          and(
            eq(usage.userId, session.user.id),
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
      } else {
        // Create new usage record
        await db.insert(usage).values({
          userId: session.user.id,
          month: currentMonth,
          importsCount: 0,
          generationsCount: 1
        })
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
    console.error('Create test API error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCause = (error as any)?.cause
    const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
    const fullErrorText = `${errorMessage} ${nestedMessage}`
    console.error('Full test creation error:', fullErrorText)
    
    return NextResponse.json({
      success: false,
      message: 'Failed to save test',
      error: fullErrorText || 'Unknown error'
    }, { status: 500 })
  }
}
