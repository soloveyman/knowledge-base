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

    // Update the assignment_user status to completed for the current user
    const result = await db.update(assignmentUsers)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(assignmentUsers.assignmentId, id),
        eq(assignmentUsers.userId, session.user.id)
      ))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment user record not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment completed successfully',
      data: result[0]
    })
  } catch (error) {
    console.error('Complete assignment API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to complete assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
