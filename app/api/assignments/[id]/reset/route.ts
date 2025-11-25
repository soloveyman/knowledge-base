import { NextResponse } from 'next/server'
import { db, assignmentUsers, testAttempts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { auth, hasPermission } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only owner and manager can reset assignment results
    if (!hasPermission(session.user.role, 'ASSIGNMENTS', 'update')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to reset assignment results' 
      }, { status: 403 })
    }

    const { id } = await params

    console.log(`🔄 Resetting results for assignment ${id}`)

    // Delete all test attempts for this assignment
    try {
      await db.delete(testAttempts).where(eq(testAttempts.assignmentId, id))
      console.log(`✅ Reset test attempts for assignment ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to reset test attempts:`, error)
      return NextResponse.json({
        success: false,
        message: 'Failed to reset test attempts',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // Reset assignment statuses for all users
    try {
      await db.update(assignmentUsers)
        .set({
          status: 'pending',
          completedAt: null,
          updatedAt: new Date()
        })
        .where(eq(assignmentUsers.assignmentId, id))
      console.log(`✅ Reset assignment statuses for assignment ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to reset assignment statuses:`, error)
      return NextResponse.json({
        success: false,
        message: 'Failed to reset assignment statuses',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment results reset successfully'
    })
  } catch (error) {
    console.error('Reset assignment results API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to reset assignment results',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

