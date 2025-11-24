import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, assignmentUsers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Update the assignment_user status to in_progress for the current user
    // Only update if status is 'pending' (don't overwrite 'completed' or 'failed')
    const result = await db.update(assignmentUsers)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(and(
        eq(assignmentUsers.assignmentId, id),
        eq(assignmentUsers.userId, session.user.id),
        eq(assignmentUsers.status, 'pending') // Only update if still pending
      ))
      .returning()

    if (result.length === 0) {
      // Check if assignment exists but status is not pending
      const existing = await db.select()
        .from(assignmentUsers)
        .where(and(
          eq(assignmentUsers.assignmentId, id),
          eq(assignmentUsers.userId, session.user.id)
        ))
        .limit(1)

      if (existing.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Assignment user record not found'
        }, { status: 404 })
      }

      // Assignment exists but status is not pending (already started or completed)
      return NextResponse.json({
        success: true,
        message: 'Assignment already started',
        data: existing[0]
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment started successfully',
      data: result[0]
    })
  } catch (error) {
    console.error('Start assignment API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to start assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
