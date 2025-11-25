import { NextResponse } from 'next/server'
import { db, tests, questions, assignments, assignmentUsers, testAttempts, progress, users } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { auth, hasPermission } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const checkDependencies = searchParams.get('checkDependencies') === 'true'
    
    console.log('GET request for test ID:', id, 'checkDependencies:', checkDependencies)

    // Find test by ID - handle missing columns gracefully
    let testData
    try {
      const test = await db
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
        .where(eq(tests.id, id))
        .limit(1)
      console.log('Test query result:', test.length, 'tests found')
      
      if (test.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Test not found'
        }, { status: 404 })
      }

      testData = test[0]
    } catch (selectError: unknown) {
      // Fallback if new columns don't exist
      const errorMessage = selectError instanceof Error ? selectError.message : String(selectError)
      const errorCause = (selectError as any)?.cause
      const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
      const fullErrorText = `${errorMessage} ${nestedMessage}`
      
      if (fullErrorText.includes('column "type" does not exist') || 
          fullErrorText.includes('column "difficulty" does not exist') ||
          fullErrorText.includes('column "locale" does not exist')) {
        console.log('New columns not found, using fallback query')
        const test = await db
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
          .where(eq(tests.id, id))
          .limit(1)
        
        if (test.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'Test not found'
          }, { status: 404 })
        }
        
        testData = {
          ...test[0],
          type: null,
          difficulty: null,
          locale: null
        }
      } else {
        throw selectError
      }
    }
    
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
    const questionsArray = []
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
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'TESTS', 'update')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to update tests' 
      }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    
    console.log('PUT request for test ID:', id)
    console.log('Update data:', body)

    // Check if test exists and user has access
    const userRole = session.user.role
    const tenantId = session.user.businessId
    
    let existingTest
    if (userRole === 'super-admin') {
      // Super-admin can update any test
      existingTest = await db
        .select({ id: tests.id, createdBy: tests.createdBy })
        .from(tests)
        .where(eq(tests.id, id))
        .limit(1)
    } else {
      // Others can only update tests from their tenant
      if (!tenantId) {
        return NextResponse.json({
          success: false,
          message: 'Forbidden - you can only update tests from your business'
        }, { status: 403 })
      }
      
      // Get tenant user IDs
      const tenantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, tenantId))
      const tenantUserIds = tenantUsers.map(u => u.id)
      
      if (tenantUserIds.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Forbidden - you can only update tests from your business'
        }, { status: 403 })
      }
      
      existingTest = await db
        .select({ id: tests.id, createdBy: tests.createdBy })
        .from(tests)
        .where(and(
          eq(tests.id, id),
          inArray(tests.createdBy, tenantUserIds)
        ))
        .limit(1)
    }
    
    if (existingTest.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Test not found'
      }, { status: 404 })
    }

    // Get current test data to compare questionIds and important fields
    const currentTest = await db
      .select({ 
        questionIds: tests.questionIds,
        passingScore: tests.passingScore,
        timeLimit: tests.timeLimit
      })
      .from(tests)
      .where(eq(tests.id, id))
      .limit(1)
    
    const currentQuestionIds = (currentTest[0]?.questionIds as string[]) || []
    const newQuestionIds = body.questionIds || currentQuestionIds
    
    // Check if questions changed (need to reset results)
    const questionsChanged = JSON.stringify(currentQuestionIds.sort()) !== JSON.stringify(Array.isArray(newQuestionIds) ? newQuestionIds.sort() : [])
    
    // Prepare update data
    const updateData: {
      title?: string
      description?: string | null
      questionIds?: string[]
      type?: string | null
      difficulty?: string | null
      locale?: string | null
      passingScore?: number | null
      timeLimit?: number | null
      maxAttempts?: number | null
      shuffleQuestions?: boolean
      showCorrectAnswers?: boolean
      status?: string
      updatedAt: Date
    } = {
      updatedAt: new Date()
    }
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.questionIds !== undefined) updateData.questionIds = body.questionIds
    if (body.passingScore !== undefined) updateData.passingScore = body.passingScore
    if (body.timeLimit !== undefined) updateData.timeLimit = body.timeLimit
    if (body.maxAttempts !== undefined) updateData.maxAttempts = body.maxAttempts
    if (body.shuffleQuestions !== undefined) updateData.shuffleQuestions = body.shuffleQuestions
    if (body.showCorrectAnswers !== undefined) updateData.showCorrectAnswers = body.showCorrectAnswers
    if (body.status !== undefined) updateData.status = body.status
    
    // Only include new columns if they're provided (they might not exist in DB yet)
    if (body.type !== undefined) updateData.type = body.type
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty
    if (body.locale !== undefined) updateData.locale = body.locale

    // Update the test - wrap in try/catch to handle missing columns gracefully
    try {
      await db.update(tests)
        .set(updateData)
        .where(eq(tests.id, id))
    } catch (updateError: unknown) {
      // If update fails due to missing columns, try without new columns
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
      if (errorMessage.includes('column "type"') || 
          errorMessage.includes('column "difficulty"') ||
          errorMessage.includes('column "locale"')) {
        console.log('New columns not available, updating without type/difficulty/locale')
        const fallbackUpdateData: typeof updateData = {
          updatedAt: updateData.updatedAt
        }
        if (updateData.title !== undefined) fallbackUpdateData.title = updateData.title
        if (updateData.description !== undefined) fallbackUpdateData.description = updateData.description
        if (updateData.questionIds !== undefined) fallbackUpdateData.questionIds = updateData.questionIds
        if (updateData.passingScore !== undefined) fallbackUpdateData.passingScore = updateData.passingScore
        if (updateData.timeLimit !== undefined) fallbackUpdateData.timeLimit = updateData.timeLimit
        if (updateData.maxAttempts !== undefined) fallbackUpdateData.maxAttempts = updateData.maxAttempts
        if (updateData.shuffleQuestions !== undefined) fallbackUpdateData.shuffleQuestions = updateData.shuffleQuestions
        if (updateData.showCorrectAnswers !== undefined) fallbackUpdateData.showCorrectAnswers = updateData.showCorrectAnswers
        if (updateData.status !== undefined) fallbackUpdateData.status = updateData.status
        await db.update(tests)
          .set(fallbackUpdateData)
          .where(eq(tests.id, id))
      } else {
        throw updateError
      }
    }

    // Reset results if questions changed or important fields changed
    const importantFieldsChanged = questionsChanged || 
      (body.passingScore !== undefined && body.passingScore !== currentTest[0]?.passingScore) ||
      (body.timeLimit !== undefined && body.timeLimit !== currentTest[0]?.timeLimit)
    
    if (importantFieldsChanged) {
      console.log('Test questions or important fields changed, resetting results')
      
      // Delete all test attempts for this test
      try {
        await db.delete(testAttempts).where(eq(testAttempts.testId, id))
        console.log(`✅ Reset test attempts for test ${id}`)
      } catch (error) {
        console.warn(`⚠️ Failed to reset test attempts:`, error)
      }
      
      // Reset assignment statuses for all assignments using this test
      try {
        const relatedAssignments = await db.select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.testId, id))
        
        for (const assignment of relatedAssignments) {
          await db.update(assignmentUsers)
            .set({
              status: 'pending',
              completedAt: null,
              updatedAt: new Date()
            })
            .where(eq(assignmentUsers.assignmentId, assignment.id))
        }
        console.log(`✅ Reset assignment statuses for ${relatedAssignments.length} assignment(s)`)
      } catch (error) {
        console.warn(`⚠️ Failed to reset assignment statuses:`, error)
      }
    }

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
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'TESTS', 'delete')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to delete tests' 
      }, { status: 403 })
    }

    const { id } = await params
    console.log('=== DELETE API Debug ===')
    console.log('Request URL:', request.url)
    console.log('Extracted ID:', id)
    console.log('ID type:', typeof id)
    console.log('ID length:', id?.length)

    const userRole = session.user.role
    const tenantId = session.user.businessId

    // Check if test exists and user has access - select id and questionIds for deletion
    let questionIds: string[] = []
    try {
      let existingTest
      if (userRole === 'super-admin') {
        // Super-admin can delete any test
        existingTest = await db
          .select({
            id: tests.id,
            questionIds: tests.questionIds,
            createdBy: tests.createdBy
          })
          .from(tests)
          .where(eq(tests.id, id))
          .limit(1)
      } else {
        // Others can only delete tests from their tenant
        if (!tenantId) {
          return NextResponse.json({
            success: false,
            message: 'Forbidden - you can only delete tests from your business'
          }, { status: 403 })
        }
        
        // Get tenant user IDs
        const tenantUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.businessId, tenantId))
        const tenantUserIds = tenantUsers.map(u => u.id)
        
        if (tenantUserIds.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'Forbidden - you can only delete tests from your business'
          }, { status: 403 })
        }
        
        existingTest = await db
          .select({
            id: tests.id,
            questionIds: tests.questionIds,
            createdBy: tests.createdBy
          })
          .from(tests)
          .where(and(
            eq(tests.id, id),
            inArray(tests.createdBy, tenantUserIds)
          ))
          .limit(1)
      }
      
      console.log('Found test:', existingTest)
      
      if (existingTest.length === 0) {
        console.log('Test not found in database or access denied')
        return NextResponse.json({
          success: false,
          message: 'Test not found'
        }, { status: 404 })
      }

      // Get question IDs from the test
      const test = existingTest[0]
      questionIds = (test.questionIds as string[]) || []
    } catch (selectError: unknown) {
      // Fallback if columns don't exist - just check existence
      const errorMessage = selectError instanceof Error ? selectError.message : String(selectError)
      if (errorMessage.includes('column')) {
        const existingTest = await db
          .select({ id: tests.id })
          .from(tests)
          .where(eq(tests.id, id))
          .limit(1)
        if (existingTest.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'Test not found'
          }, { status: 404 })
        }
        questionIds = []
      } else {
        throw selectError
      }
    }
    
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
    
    // Delete related records first (they reference the test via foreign key)
    // This must be done before deleting the test to avoid foreign key constraint violation
    
    // Delete test attempts
    try {
      await db.delete(testAttempts).where(eq(testAttempts.testId, id))
      console.log(`✅ Deleted test attempts for test ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to delete test attempts (may not exist):`, error)
      // Continue with deletion - test attempts might not exist or might be deleted via cascade
    }
    
    // Delete progress records
    try {
      await db.delete(progress).where(eq(progress.testId, id))
      console.log(`✅ Deleted progress records for test ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to delete progress records (may not exist):`, error)
      // Continue with deletion - progress records might not exist
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
          try {
            await db.delete(questions).where(eq(questions.id, questionId))
            console.log(`✅ Deleted question ${questionId}`)
          } catch (error) {
            console.warn(`⚠️ Failed to delete question ${questionId}:`, error)
            // Continue with other questions
          }
        }
      } else {
        console.log('No valid question IDs to delete (skipping mock question IDs)')
      }
    }

    // Delete the test
    console.log(`🗑️ Deleting test ${id} from database`)
    try {
      await db.delete(tests).where(eq(tests.id, id))
      console.log(`✅ Test ${id} delete query executed`)
      
      // Verify deletion
      const verifyDeleted = await db.select().from(tests).where(eq(tests.id, id)).limit(1)
      if (verifyDeleted.length > 0) {
        console.error(`❌ Test ${id} still exists after deletion attempt`)
        return NextResponse.json({
          success: false,
          message: 'Test deletion failed - test still exists',
          error: 'DELETION_VERIFICATION_FAILED'
        }, { status: 500 })
      }
      
      console.log(`✅ Test ${id} deleted successfully and verified`)
    } catch (dbError) {
      console.error(`❌ Database error deleting test ${id}:`, dbError)
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      
      if (dbErrorMessage.includes('foreign key') || dbErrorMessage.includes('constraint') || dbErrorMessage.includes('23503')) {
        return NextResponse.json({
          success: false,
          message: 'Cannot delete test. It is still referenced by other records.',
          error: 'FOREIGN_KEY_CONSTRAINT'
        }, { status: 400 })
      }
      
      throw dbError
    }

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
