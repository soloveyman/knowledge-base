import { NextResponse } from 'next/server'
import { db, assignments, documents, modules, assignmentUsers, progress, testAttempts, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth, hasPermission } from '@/lib/auth'

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
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'ASSIGNMENTS', 'update')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to update assignments' 
      }, { status: 403 })
    }

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
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'ASSIGNMENTS', 'delete')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to delete assignments' 
      }, { status: 403 })
    }

    const { id } = await params

    // Check if assignment exists and user has access
    const userRole = session.user.role
    const tenantId = session.user.businessId
    
    let existingAssignment
    if (userRole === 'super-admin') {
      // Super-admin can delete any assignment
      existingAssignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
    } else {
      // Others can only delete assignments from their tenant
      if (!tenantId) {
        return NextResponse.json({
          success: false,
          message: 'Forbidden - you can only delete assignments from your business'
        }, { status: 403 })
      }
      
      // Fetch assignments scoped to tenant via the assigner
      const rows = await db
        .select({ assignment: assignments, assignerBusinessId: users.businessId })
        .from(assignments)
        .leftJoin(users, eq(assignments.assignedBy, users.id))
        .where(and(
          eq(assignments.id, id),
          eq(users.businessId, tenantId)
        ))
        .limit(1)
      
      existingAssignment = rows.length > 0 ? [rows[0].assignment] : []
    }
    
    if (existingAssignment.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 })
    }

    console.log(`🗑️ Deleting assignment ${id} and related records`)

    // Explicitly delete related records first (even though cascade should handle it)
    // This ensures clean deletion and avoids any potential foreign key issues
    
    // Delete assignment users
    try {
      await db.delete(assignmentUsers).where(eq(assignmentUsers.assignmentId, id))
      console.log(`✅ Deleted assignment users for assignment ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to delete assignment users (will try cascade):`, error)
    }

    // Delete progress records
    try {
      await db.delete(progress).where(eq(progress.assignmentId, id))
      console.log(`✅ Deleted progress records for assignment ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to delete progress (will try cascade):`, error)
    }

    // Delete test attempts
    try {
      await db.delete(testAttempts).where(eq(testAttempts.assignmentId, id))
      console.log(`✅ Deleted test attempts for assignment ${id}`)
    } catch (error) {
      console.warn(`⚠️ Failed to delete test attempts (will try cascade):`, error)
    }

    // Delete the assignment
    console.log(`🗑️ Deleting assignment ${id} from database`)
    try {
      await db.delete(assignments).where(eq(assignments.id, id))
      console.log(`✅ Assignment ${id} delete query executed`)
      
      // Verify deletion
      const verifyDeleted = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
      if (verifyDeleted.length > 0) {
        console.error(`❌ Assignment ${id} still exists after deletion attempt`)
        return NextResponse.json({
          success: false,
          message: 'Assignment deletion failed - assignment still exists',
          error: 'DELETION_VERIFICATION_FAILED'
        }, { status: 500 })
      }
      
      console.log(`✅ Assignment ${id} deleted successfully and verified`)
    } catch (dbError) {
      console.error(`❌ Database error deleting assignment ${id}:`, dbError)
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      
      if (dbErrorMessage.includes('foreign key') || dbErrorMessage.includes('constraint') || dbErrorMessage.includes('23503')) {
        return NextResponse.json({
          success: false,
          message: 'Cannot delete assignment. It is still referenced by other records.',
          error: 'FOREIGN_KEY_CONSTRAINT'
        }, { status: 400 })
      }
      
      throw dbError
    }

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
