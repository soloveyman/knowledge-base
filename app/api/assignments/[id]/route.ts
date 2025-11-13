import { NextResponse } from 'next/server'
import { db, assignments, documents, modules, assignmentUsers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

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

    // Fetch users assigned to this assignment
    const assignmentUsersList = await db.select().from(assignmentUsers)
      .where(eq(assignmentUsers.assignmentId, id))

    return NextResponse.json({
      success: true,
      data: {
        assignment: assignment[0],
        users: assignmentUsersList
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
    console.log('Assignment API: Updating assignment', id, 'with data:', body)

    const {
      moduleId: documentId,
      testId,
      assignedTo,
      title,
      description,
      dueDate,
      status = 'pending',
      assignedBy = '3e1b5c25-7785-41b3-9c1f-68453a28bc90'
    } = body

    // Validate required fields
    if (!documentId || !assignedTo) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: documentId and assignedTo are required'
      }, { status: 400 })
    }

    // Normalize assignedTo to array
    const userIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo]
    console.log('Processing assignment updates for users:', userIds)

    // Get the document to find its moduleId
    const document = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
    
    if (document.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    // Check if assignment exists
    const existingAssignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
    if (existingAssignment.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 })
    }

    // Update assignment dueDate, title, description, and testId
    const updateFields: {
      updatedAt: Date
      dueDate?: Date | null
      title?: string
      description?: string
      testId?: string | null
    } = { updatedAt: new Date() }
    if (dueDate !== undefined) {
      updateFields.dueDate = dueDate ? new Date(dueDate) : null
    }
    if (title) {
      updateFields.title = title
    }
    if (description !== undefined) {
      updateFields.description = description
    }
    if (testId !== undefined) {
      updateFields.testId = testId || null
    }
    
    if (Object.keys(updateFields).length > 1) {
      await db.update(assignments)
        .set(updateFields)
        .where(eq(assignments.id, id))
    }

    // Check existing users for this assignment
    const existingAssignmentUsers = await db.select().from(assignmentUsers)
      .where(eq(assignmentUsers.assignmentId, id))
    
    const existingUserIds = new Set(existingAssignmentUsers.map(au => au.userId))
    const newUserIds = new Set(userIds)
    
    // Find users to remove (in existing but not in new list)
    const usersToRemove = existingAssignmentUsers.filter(au => !newUserIds.has(au.userId))
    
    // Find users to add (in new list but not in existing)
    const usersToAssign = userIds.filter(userId => !existingUserIds.has(userId))

    // Remove users who were unchecked
    let removedCount = 0
    for (const assignmentUser of usersToRemove) {
      try {
        await db.delete(assignmentUsers)
          .where(and(
            eq(assignmentUsers.assignmentId, id),
            eq(assignmentUsers.userId, assignmentUser.userId)
          ))
        removedCount++
      } catch (error) {
        console.error(`Failed to remove user ${assignmentUser.userId} from assignment:`, error)
      }
    }

    // Add users to the assignment
    interface AssignmentUserRow {
      id: string
      assignmentId: string
      userId: string
      status: string
      completedAt: Date | null
      createdAt: Date | null
      updatedAt: Date | null
    }
    
    const newAssignmentUsers: AssignmentUserRow[] = []
    for (const userId of usersToAssign) {
      try {
        const result = await db.insert(assignmentUsers).values({
          assignmentId: id,
          userId,
          status: status || 'pending'
        }).returning()
        if (result[0]) {
          newAssignmentUsers.push(result[0])
        }
      } catch (error) {
        console.error(`Failed to add user ${userId} to assignment:`, error)
      }
    }

    console.log('Users removed:', removedCount, 'Users added:', newAssignmentUsers.length)

    // Build response message
    const messages: string[] = []
    if (removedCount > 0) {
      messages.push(`Removed ${removedCount} user(s)`)
    }
    if (newAssignmentUsers.length > 0) {
      messages.push(`Added ${newAssignmentUsers.length} user(s)`)
    }
    if (removedCount === 0 && newAssignmentUsers.length === 0) {
      messages.push('No changes made to assigned users')
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment: existingAssignment[0],
        addedCount: newAssignmentUsers.length,
        removedCount
      },
      message: messages.join('. ')
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
