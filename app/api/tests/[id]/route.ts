import { NextResponse } from 'next/server'
import { db, tests, questions, assignments, assignmentUsers, testAttempts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const checkDependencies = searchParams.get('checkDependencies') === 'true'
    
    console.log('GET request for test ID:', id, 'checkDependencies:', checkDependencies)

    // Find test by ID
    const test = await db.select().from(tests).where(eq(tests.id, id)).limit(1)
    console.log('Test query result:', test.length, 'tests found')
    
    if (test.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Test not found'
      }, { status: 404 })
    }

    const testData = test[0]
    
    // If just checking dependencies, return assignments info
    if (checkDependencies) {
      const relatedAssignments = await db.select().from(assignments).where(eq(assignments.testId, id))
      return NextResponse.json({
        success: true,
        hasAssignments: relatedAssignments.length > 0,
        assignmentCount: relatedAssignments.length,
        assignments: relatedAssignments
      })
    }
    
    console.log('Test data:', testData)
    console.log('Question IDs:', testData.questionIds)
    
    // If we have question IDs, fetch the actual questions
    let questionsArray = []
    if (testData.questionIds && Array.isArray(testData.questionIds) && testData.questionIds.length > 0) {
      console.log('Processing question IDs:', testData.questionIds.length)
      // Filter out non-UUID question IDs (like "q1", "q2" from mock data)
      const validQuestionIds = testData.questionIds.filter((qId: string) => 
        typeof qId === 'string' && 
        qId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      )
      console.log('Valid question IDs:', validQuestionIds)
      
      if (validQuestionIds.length > 0) {
        // Fetch questions one by one (Drizzle limitation with IN clause)
        for (const questionId of validQuestionIds) {
          console.log('Fetching question:', questionId)
          const questionResult = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1)
          if (questionResult.length > 0) {
            questionsArray.push(questionResult[0])
          }
        }
      }
    }

    console.log('Returning test data with', questionsArray.length, 'questions')
    return NextResponse.json({
      success: true,
      data: { 
        test: testData,
        questions: questionsArray
      }
    })
  } catch (error) {
    console.error('Get test API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to get test',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    console.log('PUT request for test ID:', id)
    console.log('Update data:', body)

    // Check if test exists
    const existingTest = await db.select().from(tests).where(eq(tests.id, id)).limit(1)
    
    if (existingTest.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Test not found'
      }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      title: body.title,
      description: body.description,
      passingScore: body.passingScore,
      timeLimit: body.timeLimit,
      maxAttempts: body.maxAttempts,
      shuffleQuestions: body.shuffleQuestions,
      showCorrectAnswers: body.showCorrectAnswers,
      status: body.status,
      updatedAt: new Date()
    }

    // Update the test
    await db.update(tests)
      .set(updateData)
      .where(eq(tests.id, id))

    console.log('Test updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Test updated successfully'
    })
  } catch (error) {
    console.error('Update test API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to update test',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('=== DELETE API Debug ===')
    console.log('Request URL:', request.url)
    console.log('Extracted ID:', id)
    console.log('ID type:', typeof id)
    console.log('ID length:', id?.length)

    // Check if test exists
    const existingTest = await db.select().from(tests).where(eq(tests.id, id)).limit(1)
    console.log('Found test:', existingTest)
    
    if (existingTest.length === 0) {
      console.log('Test not found in database')
      return NextResponse.json({
        success: false,
        message: 'Test not found'
      }, { status: 404 })
    }

    // Get question IDs from the test
    const test = existingTest[0]
    const questionIds = test.questionIds as string[] || []
    
    // Check if test is used in assignments - if so, block deletion
    const relatedAssignments = await db.select().from(assignments).where(eq(assignments.testId, id))
    console.log(`Found ${relatedAssignments.length} assignments using this test`)
    
    if (relatedAssignments.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Cannot delete test. It is used in ${relatedAssignments.length} assignment(s). Please delete the assignments first.`,
        error: 'HAS_ASSIGNMENTS',
        assignmentCount: relatedAssignments.length,
        assignments: relatedAssignments
      }, { status: 400 })
    }
    
    // Delete associated questions first (only if they are valid UUIDs)
    if (questionIds.length > 0) {
      console.log('Deleting associated questions:', questionIds)
      
      // Filter out non-UUID question IDs (like "q1", "q2" from mock data)
      const validQuestionIds = questionIds.filter(id => 
        typeof id === 'string' && 
        id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      )
      
      if (validQuestionIds.length > 0) {
        console.log('Deleting valid question IDs:', validQuestionIds)
        // Delete questions one by one (Drizzle doesn't support IN with delete easily)
        for (const questionId of validQuestionIds) {
          await db.delete(questions).where(eq(questions.id, questionId))
        }
      } else {
        console.log('No valid question IDs to delete (skipping mock question IDs)')
      }
    }

    // Delete the test
    await db.delete(tests).where(eq(tests.id, id))
    console.log('Test deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Test deleted successfully'
    })
  } catch (error) {
    console.error('Delete test API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to delete test',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
