import { NextResponse } from 'next/server'
import { db, assignments } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch assignment by ID
    const assignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)

    if (assignment.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment: assignment[0]
      }
    })
  } catch (error) {
    console.error('Get assignment API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch assignment',
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

    const {
      moduleId,
      testId,
      assignedTo,
      dueDate,
      status = 'pending',
      assignedBy = '3e1b5c25-7785-41b3-9c1f-68453a28bc90'
    } = body

    // Check if assignment exists
    const existingAssignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
    if (existingAssignment.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 })
    }

    // Update the assignment
    const updatedAssignment = await db.update(assignments)
      .set({
        moduleId,
        testId,
        assignedTo,
        assignedBy,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'pending',
        updatedAt: new Date()
      })
      .where(eq(assignments.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        assignment: updatedAssignment[0]
      },
      message: 'Assignment updated successfully'
    })
  } catch (error) {
    console.error('Update assignment API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to update assignment',
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

    // Check if assignment exists
    const existingAssignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
    if (existingAssignment.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 })
    }

    // Delete the assignment
    await db.delete(assignments).where(eq(assignments.id, id))

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully'
    })
  } catch (error) {
    console.error('Delete assignment API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to delete assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
