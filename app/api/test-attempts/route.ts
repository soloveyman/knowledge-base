import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, testAttempts, assignments, assignmentUsers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { testId, answers, score, timeSpent, status } = body

    if (!testId) {
      return NextResponse.json(
        { success: false, message: 'Test ID is required' },
        { status: 400 }
      )
    }

    // Insert test attempt
    const result = await db.insert(testAttempts).values({
      testId: testId,
      userId: session.user.id,
      answers: answers || {},
      score: score,
      timeSpent: timeSpent || 0,
      status: status || 'completed',
      completedAt: new Date()
    }).returning()

    // Update the user's assignment status based on score
    // First, find the assignment that contains this test
    const assignmentsWithTest = await db.select().from(assignments)
      .where(eq(assignments.testId, testId))
    
    if (assignmentsWithTest.length > 0) {
      // Determine status based on score (failed if under 70%)
      const assignmentStatus = score >= 70 ? 'completed' : 'failed'
      
      // Update the assignment_user status for this user
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
    console.error('Error creating test attempt:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
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

    let query = db.select().from(testAttempts)

    if (userId) {
      query = query.where(eq(testAttempts.userId, userId)) as any
    }

    if (testId) {
      query = query.where(eq(testAttempts.testId, testId)) as any
    }

    const attempts = await query

    return NextResponse.json({
      success: true,
      data: {
        attempts
      }
    })
  } catch (error) {
    console.error('Error fetching test attempts:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
