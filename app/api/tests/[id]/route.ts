import { NextResponse } from 'next/server'
import { db, tests, questions, assignments, assignmentUsers, testAttempts, progress, users } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { auth, hasPermission } from '@/lib/auth'
import { handleApiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined
  try {
    const resolvedParams = await params
    id = resolvedParams.id
    const { searchParams } = new URL(request.url)
    const checkDependencies = searchParams.get('checkDependencies') === 'true'
    
    logger.log('GET request for test ID:', id, 'checkDependencies:', checkDependencies)

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
      logger.log('Test query result:', test.length, 'tests found')
      
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
        logger.log('New columns not found, using fallback query')
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
    
    logger.log('Test data:', testData)
    logger.log('Question IDs:', testData.questionIds)
    
    // If we have question IDs, fetch the actual questions
    const questionsArray = []
    if (testData.questionIds && Array.isArray(testData.questionIds) && testData.questionIds.length > 0) {
      logger.log('Processing question IDs:', testData.questionIds.length)
      // Filter out non-UUID question IDs (like "q1", "q2" from mock data)
      const validQuestionIds = testData.questionIds.filter((qId: string) => 
        typeof qId === 'string' && 
        qId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      )
      logger.log('Valid question IDs:', validQuestionIds)
      
      if (validQuestionIds.length > 0) {
        // Fetch questions one by one (Drizzle limitation with IN clause)
        for (const questionId of validQuestionIds) {
          logger.log('Fetching question:', questionId)
          const questionResult = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1)
          if (questionResult.length > 0) {
            questionsArray.push(questionResult[0])
          }
        }
      }
    }

    logger.log('Returning test data with', questionsArray.length, 'questions')
    return NextResponse.json({
      success: true,
      data: { 
        test: testData,
        questions: questionsArray
      }
    })
  } catch (error) {
    return handleApiError(error, 'Failed to get test', 500)
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
    
    logger.log('PUT request for test ID:', id)
    logger.log('Update data:', body)

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
    
    // Update questions first if provided (before updating test)
    const updatedQuestionIds: string[] = []
    if (body.questions && Array.isArray(body.questions) && body.questions.length > 0) {
      try {
        logger.log('Updating questions for test:', id)
        const { questionSchema } = await import('@/lib/schemas/tests')
        
        // Process and update each question
        for (const q of body.questions) {
          // Validate question data
          const validatedQuestion = questionSchema.parse(q)
          
          // Get correct answer - prioritize correct_answer over correctAnswer
          const correctAnswerValue = validatedQuestion.correct_answer ?? validatedQuestion.correctAnswer ?? ''
          
          // Validate correct answer for multiple choice questions
          // Indices start from 1 (A=1, B=2, C=3, D=4)
          let finalCorrectAnswer = correctAnswerValue
          // Handle match and order types - preserve comma-separated answers as-is
          if ((validatedQuestion.type === 'match' || validatedQuestion.type === 'order') && correctAnswerValue) {
            // For match and order, correct_answer should be comma-separated indices like "1,2,3,4"
            // Validate that all indices are valid
            const parts = correctAnswerValue.split(/[,;\s]+/).filter(p => p.length > 0)
            const validParts: string[] = []
            for (const part of parts) {
              if (/^\d+$/.test(part)) {
                const index = parseInt(part, 10)
                if (validatedQuestion.choices && index >= 1 && index <= validatedQuestion.choices.length) {
                  validParts.push(part)
                }
              } else if (/^[A-Z]$/i.test(part)) {
                // Convert letter to index
                const letterIndex = part.toUpperCase().charCodeAt(0) - 65
                const oneBasedIndex = letterIndex + 1
                if (validatedQuestion.choices && oneBasedIndex >= 1 && oneBasedIndex <= validatedQuestion.choices.length) {
                  validParts.push(String(oneBasedIndex))
                }
              }
            }
            if (validParts.length > 0) {
              finalCorrectAnswer = validParts.join(',')
            }
          } else if ((validatedQuestion.type === 'mcq' || validatedQuestion.type === 'mcq_multi') && validatedQuestion.choices && validatedQuestion.choices.length > 0) {
            // If correct answer is a letter (A, B, C, D), convert to 1-based index
            if (/^[A-Z]$/.test(correctAnswerValue)) {
              const letterIndex = correctAnswerValue.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
              const oneBasedIndex = letterIndex + 1 // A=1, B=2, C=3, D=4
              if (oneBasedIndex >= 1 && oneBasedIndex <= validatedQuestion.choices.length) {
                finalCorrectAnswer = String(oneBasedIndex)
                logger.log(`Question ${q.id}: Converted letter "${correctAnswerValue}" to index ${oneBasedIndex}`)
              } else {
                console.warn(`Question ${q.id}: Invalid letter "${correctAnswerValue}", using first option (1)`)
                finalCorrectAnswer = '1'
              }
            }
            // If correct answer is a number string (index), validate it (1-based)
            else if (/^\d+$/.test(correctAnswerValue)) {
              const index = parseInt(correctAnswerValue, 10)
              if (index < 1 || index > validatedQuestion.choices.length) {
                console.warn(`Question ${q.id}: Invalid correct_answer index ${index}, using first option (1)`)
                finalCorrectAnswer = '1'
              } else {
                finalCorrectAnswer = correctAnswerValue
              }
            } else if (correctAnswerValue) {
              // If it's text, try to find it in choices
              const choiceIndex = validatedQuestion.choices.findIndex(
                choice => choice.trim().toLowerCase() === correctAnswerValue.trim().toLowerCase()
              )
              if (choiceIndex >= 0) {
                const oneBasedIndex = choiceIndex + 1 // Convert 0-based to 1-based
                finalCorrectAnswer = String(oneBasedIndex)
                logger.log(`Question ${q.id}: Converted text answer "${correctAnswerValue}" to index ${oneBasedIndex}`)
              } else {
                console.warn(`Question ${q.id}: Could not find correct answer "${correctAnswerValue}" in choices, using first option (1)`)
                finalCorrectAnswer = '1'
              }
            }
          }
          
          // Convert frontend question types to database types
          let dbType = 'multiple_choice' // default
          if (validatedQuestion.type === 'mcq' || validatedQuestion.type === 'mcq_multi') {
            dbType = 'multiple_choice'
          } else if (validatedQuestion.type === 'tf') {
            dbType = 'true_false'
          } else if (validatedQuestion.type === 'complete' || validatedQuestion.type === 'cloze') {
            dbType = 'text'
          } else if (validatedQuestion.type === 'match' || validatedQuestion.type === 'order' || validatedQuestion.type === 'mixed') {
            dbType = 'multiple_choice' // These complex types are stored as multiple_choice for now
          } else if (validatedQuestion.type === 'multiple_choice' || validatedQuestion.type === 'true_false' || validatedQuestion.type === 'text') {
            dbType = validatedQuestion.type // Already in database format
          }
          
          // Save original question type in tags for proper restoration
          const tags = validatedQuestion.type ? { originalType: validatedQuestion.type } : null
          
          // Prepare question update data
          const questionUpdateData = {
            title: validatedQuestion.prompt || validatedQuestion.title || 'Untitled Question',
            content: validatedQuestion.prompt || validatedQuestion.content || '',
            type: dbType,
            options: validatedQuestion.choices || null,
            correctAnswer: finalCorrectAnswer,
            explanation: validatedQuestion.explanation || '',
            tags: tags,
            updatedAt: new Date()
          }
          
          console.log(`Updating question ${q.id}: correctAnswer = "${finalCorrectAnswer}" (from "${correctAnswerValue}")`)
          
          // Check if question exists (has id and it's a valid UUID)
          if (q.id && typeof q.id === 'string' && q.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Update existing question
            try {
              await db.update(questions)
                .set(questionUpdateData)
                .where(eq(questions.id, q.id))
              updatedQuestionIds.push(q.id)
              console.log(`✅ Updated question ${q.id}`)
            } catch (updateError) {
              console.warn(`⚠️ Failed to update question ${q.id}, trying to create new:`, updateError)
              // If update fails (question doesn't exist), create new
              const newQuestion = await db.insert(questions).values({
                ...questionUpdateData,
                createdBy: session.user.id
              }).returning()
              updatedQuestionIds.push(newQuestion[0].id)
              console.log(`✅ Created new question ${newQuestion[0].id}`)
            }
          } else {
            // Create new question (no valid ID provided)
            const newQuestion = await db.insert(questions).values({
              ...questionUpdateData,
              createdBy: session.user.id
            }).returning()
            updatedQuestionIds.push(newQuestion[0].id)
            console.log(`✅ Created new question ${newQuestion[0].id}`)
          }
        }
        
        console.log(`✅ Updated ${body.questions.length} question(s)`)
      } catch (questionError) {
        console.error('Error updating questions:', questionError)
        // Don't throw - allow test update to succeed even if question update fails
        // Questions can be updated separately if needed
      }
    }
    
    // Determine final questionIds: use updated question IDs if questions were updated, otherwise use provided or current
    const finalQuestionIds = updatedQuestionIds.length > 0 
      ? updatedQuestionIds 
      : (body.questionIds || currentQuestionIds)
    const newQuestionIds = finalQuestionIds
    
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
    // Use finalQuestionIds if questions were updated or questionIds were provided
    if (updatedQuestionIds.length > 0 || body.questionIds !== undefined) {
      updateData.questionIds = finalQuestionIds
    }
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
      (body.timeLimit !== undefined && body.timeLimit !== currentTest[0]?.timeLimit) ||
      (body.questions && Array.isArray(body.questions) && body.questions.length > 0) // Questions were updated
    
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
