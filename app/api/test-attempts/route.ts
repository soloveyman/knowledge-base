import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, testAttempts, assignments, assignmentUsers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { submitTestAttemptSchema } from '@/lib/schemas/test-attempts'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'

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

    const { testId, assignmentId, answers, timeSpent, score } = validation.data

    // Use score from client (already calculated client-side)
    // Score is validated to be 0-100 in the schema
    const finalScore: number | null = score ?? null

    // Insert test attempt
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
        : finalScore ?? 0
      
      // Determine status based on best score (failed if under 70%, completed if 70% or higher)
      const assignmentStatus = bestScore >= 70 ? 'completed' : 'failed'
      
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
        testAttempt: result[0]
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
      attempts = await db.select().from(testAttempts)
        .where(and(
          eq(testAttempts.userId, userId),
          eq(testAttempts.testId, testId)
        ))
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
    return handleApiError(error, 'Failed to fetch test attempts', 500)
  }
}
