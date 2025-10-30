import { NextResponse } from 'next/server'
import { db, tests, questions as questionsTable, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    const tenantId = session?.user?.businessId
    const rows = await db
      .select({ test: tests, creatorBusinessId: users.businessId })
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

    // Create the test
    const newTest = await db.insert(tests).values({
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
    }).returning()

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
