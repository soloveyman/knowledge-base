import { NextResponse } from 'next/server'
import { db, tests, questions as questionsTable, users } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    const userRole = session?.user?.role
    
    // Explicitly select columns that exist (handle case where new columns don't exist yet)
    // Try with all columns first, fallback to excluding new columns if they don't exist
    try {
      // Owner sees all tests regardless of businessId
      if (userRole === 'owner') {
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
      
      // Manager and other roles filter by businessId (tenant isolation)
      const tenantId = session?.user?.businessId
      const rows = await db
        .select({ 
          test: {
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
          },
          creatorBusinessId: users.businessId 
        })
        .from(tests)
        .leftJoin(users, eq(tests.createdBy, users.id))
        .where(tenantId ? eq(users.businessId, tenantId) : undefined as unknown as never)
      const allTests = rows.map(r => r.test)

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
        const rows = await db
          .select({ 
            test: {
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
            },
            creatorBusinessId: users.businessId 
          })
          .from(tests)
          .leftJoin(users, eq(tests.createdBy, users.id))
          .where(tenantId ? eq(users.businessId, tenantId) : undefined as unknown as never)
        const allTests = rows.map(r => ({
          ...r.test,
          type: null,
          difficulty: null,
          locale: null
        }))

        return NextResponse.json({
          success: true,
          data: {
            tests: allTests
          }
        })
      }
      throw selectError
    }
  } catch (error) {
    console.error('Tests API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch tests',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
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

    let finalQuestionIds = questionIds

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
                options: q.choices ? JSON.stringify(q.choices) : null,
                correctAnswer: q.correct_answer || q.correctAnswer || '',
                explanation: q.explanation || '',
                difficulty: 'medium',
                moduleId: null, // Documents are not modules, so set to null
                createdBy: '3e1b5c25-7785-41b3-9c1f-68453a28bc90' // Owner user ID
              }
              console.log(`Processed question ${index}:`, processed)
              return processed
            } catch (mapError) {
              console.error(`Error processing question ${index}:`, mapError)
              throw new Error(`Failed to process question ${index}: ${mapError instanceof Error ? mapError.message : 'Unknown error'}`)
            }
          })
        
        console.log('Processed question data:', JSON.stringify(questionData, null, 2))
        
        const savedQuestions = await db.insert(questionsTable).values(
          questionData.map((q: typeof questionData[number]) => ({ ...q, createdBy: session.user.id }))
        ).returning()

        finalQuestionIds = savedQuestions.map(q => q.id)
        console.log('Questions saved:', savedQuestions.length)
      } catch (questionError) {
        console.error('Error saving questions:', questionError)
        throw new Error(`Failed to save questions: ${questionError instanceof Error ? questionError.message : 'Unknown error'}`)
      }
    }

    // Create the test - handle missing columns gracefully
    const testValues: {
      title: string
      description: string
      moduleId: null
      questionIds: string[]
      type?: string | null
      difficulty?: string | null
      locale?: string | null
      passingScore: number
      timeLimit: number | null
      maxAttempts: number
      shuffleQuestions: boolean
      showCorrectAnswers: boolean
      status: string
      createdBy: string
    } = {
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
    
    // Only add new columns if they're provided (they might not exist in DB yet)
    if (type !== undefined) testValues.type = type || null
    if (difficulty !== undefined) testValues.difficulty = difficulty || null
    if (locale !== undefined) testValues.locale = locale || null
    
    let newTest
    try {
      newTest = await db.insert(tests).values(testValues).returning()
    } catch (insertError: unknown) {
      // If insert fails due to missing columns, try without new columns
      const errorMessage = insertError instanceof Error ? insertError.message : String(insertError)
      const errorCause = (insertError as any)?.cause
      const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
      const fullErrorText = `${errorMessage} ${nestedMessage}`
      
      if (fullErrorText.includes('column "type"') || 
          fullErrorText.includes('column "difficulty"') ||
          fullErrorText.includes('column "locale"')) {
        console.log('New columns not available, creating test without type/difficulty/locale')
        delete testValues.type
        delete testValues.difficulty
        delete testValues.locale
        newTest = await db.insert(tests).values(testValues).returning()
        // Add default values to returned test
        newTest = newTest.map(test => ({
          ...test,
          type: null,
          difficulty: null,
          locale: null
        }))
      } else {
        throw insertError
      }
    }

    console.log('Test created successfully:', newTest[0])

    return NextResponse.json({
      success: true,
      data: {
        test: newTest[0]
      },
      message: 'Test saved successfully'
    })
  } catch (error) {
    console.error('Create test API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to save test',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
