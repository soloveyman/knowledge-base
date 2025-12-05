import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, testAttempts, assignments, assignmentUsers, tests } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { submitTestAttemptSchema } from '@/lib/schemas/test-attempts'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'
import { validateTestAnswers } from '@/lib/test-validation'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate request body
    const validation = await validateRequest(request, submitTestAttemptSchema)
    if (!validation.success) {
      return validation.response
    }

    const { testId, assignmentId, answers, timeSpent } = validation.data

    // Load test to check maxAttempts and get passingScore
    const testResult = await db
      .select({
        id: tests.id,
        maxAttempts: tests.maxAttempts,
        passingScore: tests.passingScore,
        timeLimit: tests.timeLimit,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Test not found' },
        { status: 404 }
      )
    }

    const test = testResult[0]
    const maxAttempts = test.maxAttempts ?? 1
    const passingScore = test.passingScore ?? 70

    // Check maxAttempts limit
    const existingAttempts = await db
      .select()
      .from(testAttempts)
      .where(and(
        eq(testAttempts.testId, testId),
        eq(testAttempts.userId, session.user.id),
        eq(testAttempts.status, 'completed')
      ))

    if (existingAttempts.length >= maxAttempts) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Maximum attempts (${maxAttempts}) exceeded for this test` 
        },
        { status: 403 }
      )
    }

    // Validate timeSpent if timeLimit is set
    if (test.timeLimit && timeSpent) {
      const timeLimitSeconds = test.timeLimit * 60
      if (timeSpent > timeLimitSeconds) {
        // Log suspicious activity but don't block (might be network delay)
        console.warn(`User ${session.user.id} exceeded time limit for test ${testId}: ${timeSpent}s > ${timeLimitSeconds}s`)
      }
    }

    // Server-side validation of answers
    const validationResult = await validateTestAnswers(testId, answers || {})
    const finalScore = validationResult.score

    // Insert test attempt with server-calculated score
    const result = await db.insert(testAttempts).values({
      testId: testId,
      userId: session.user.id,
      assignmentId: assignmentId || null,
      answers: answers || {},
      score: finalScore,
      timeSpent: timeSpent || 0,
      status: 'completed',
      completedAt: new Date()
    }).returning()

    // Update the user's assignment status based on best score
    // First, find the assignment that contains this test
    const assignmentsWithTest = assignmentId
      ? await db.select().from(assignments).where(eq(assignments.id, assignmentId))
      : await db.select().from(assignments).where(eq(assignments.testId, testId))
    
    if (assignmentsWithTest.length > 0) {
      // Get all attempts for this user and test to find the best score
      const allUserAttempts = await db.select()
        .from(testAttempts)
        .where(and(
          eq(testAttempts.testId, testId),
          eq(testAttempts.userId, session.user.id),
          eq(testAttempts.status, 'completed')
        ))
      
      // Find the best score (highest)
      const bestScore = allUserAttempts.length > 0
        ? Math.max(...allUserAttempts.map(a => a.score ?? 0))
        : finalScore
      
      // Determine status based on best score using test.passingScore
      const assignmentStatus = bestScore >= passingScore ? 'completed' : 'failed'
      
      // Update the assignment_user status for this user
      // Note: testScore is stored in testAttempts, not assignmentUsers
      for (const assignment of assignmentsWithTest) {
        await db.update(assignmentUsers)
          .set({
            status: assignmentStatus,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(
            eq(assignmentUsers.assignmentId, assignment.id),
            eq(assignmentUsers.userId, session.user.id)
          ))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        testAttempt: result[0],
        score: finalScore,
        passingScore,
        passed: finalScore >= passingScore
      }
    })
  } catch (error) {
    return handleApiError(error, 'Failed to create test attempt', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const userId = searchParams.get('userId')
    const userRole = session.user.role

    // Check if user is owner or manager - they can view any user's attempts
    // Employees can only view their own attempts
    const canViewOtherUsers = userRole === 'owner' || userRole === 'manager'

    let attempts
    
    if (userId && testId) {
      // Both filters - check permission if viewing other user's attempts
      if (userId !== session.user.id && !canViewOtherUsers) {
        return NextResponse.json(
          { success: false, message: 'Forbidden' },
          { status: 403 }
        )
      }
      attempts = await db
        .select()
        .from(testAttempts)
        .where(
          and(
            eq(testAttempts.userId, userId),
            eq(testAttempts.testId, testId)
          )
        )
    } else if (userId) {
      // Only userId filter - check permission if viewing other user's attempts
      if (userId !== session.user.id && !canViewOtherUsers) {
        return NextResponse.json(
          { success: false, message: 'Forbidden' },
          { status: 403 }
        )
      }
      attempts = await db.select().from(testAttempts)
        .where(eq(testAttempts.userId, userId))
    } else if (testId) {
      // Only testId filter - owner/manager can see all, employee only their own
      if (canViewOtherUsers) {
        attempts = await db.select().from(testAttempts)
          .where(eq(testAttempts.testId, testId))
      } else {
        attempts = await db.select().from(testAttempts)
          .where(and(
            eq(testAttempts.testId, testId),
            eq(testAttempts.userId, session.user.id)
          ))
      }
    } else {
      // No filters - get all for current user
      attempts = await db.select().from(testAttempts)
        .where(eq(testAttempts.userId, session.user.id))
    }

    return NextResponse.json({
      success: true,
      data: {
        attempts
      }
    })
  } catch (error) {
    // Extract underlying database error if available
    let dbError: string | undefined
    if (error instanceof Error) {
      // Drizzle errors often have the original error in cause or message
      const errorMessage = error.message
      const errorCause = (error as any).cause
      
      // Try to extract PostgreSQL error details
      if (errorCause instanceof Error) {
        dbError = errorCause.message
      } else if (errorMessage.includes('relation') || errorMessage.includes('column')) {
        dbError = errorMessage
      }
      
      // Log full error details for debugging
      console.error('Database query error details:', {
        message: error.message,
        cause: errorCause,
        stack: error.stack,
        originalError: error,
      })
    }
    
    return handleApiError(
      error,
      dbError ? `Database error: ${dbError}` : 'Failed to fetch test attempts',
      500
    )
  }
}
