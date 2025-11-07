import { NextResponse } from 'next/server'
import { db, assignments, documents, modules, assignmentUsers, testAttempts, users } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { InferSelectModel } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()
    const userRole = session?.user?.role
    
    const tenantId = session?.user?.businessId
    
    let assignmentsData: InferSelectModel<typeof assignments>[] = []
    
    // Super-admin sees all assignments
    if (userRole === 'super-admin') {
      assignmentsData = await db
        .select()
        .from(assignments)
        .orderBy(desc(assignments.createdAt))
    } else {
      // All other roles (owner, manager, employee) filter by businessId (tenant isolation)
      if (!tenantId) {
        assignmentsData = []
      } else {
        // Fetch assignments scoped to tenant via the assigner (owner/manager within tenant)
        const rows = await db
          .select({ assignment: assignments, assignerBusinessId: users.businessId })
          .from(assignments)
          .leftJoin(users, eq(assignments.assignedBy, users.id))
          .where(eq(users.businessId, tenantId))
        
        assignmentsData = rows.map(r => r.assignment)
      }
    }
    
    // Fetch users for each assignment
    const assignmentsWithUsers = await Promise.all(
      assignmentsData.map(async (assignment) => {
        const users = await db.select().from(assignmentUsers)
          .where(eq(assignmentUsers.assignmentId, assignment.id))
        
        // For each user, check if there are test attempts and get the latest score
        const usersWithScores = await Promise.all(
          users.map(async (user) => {
            if (assignment.testId) {
              // Get the latest test attempt for this user and this test
              const attempts = await db.select().from(testAttempts)
                .where(
                  and(
                    eq(testAttempts.testId, assignment.testId),
                    eq(testAttempts.userId, user.userId)
                  )
                )
                .orderBy(desc(testAttempts.completedAt))
                .limit(1)
              
              if (attempts.length > 0) {
                return {
                  ...user,
                  testScore: attempts[0].score
                }
              }
            }
            return user
          })
        )
        
        return { ...assignment, users: usersWithScores }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        assignments: assignmentsWithUsers
      }
    })
  } catch (error) {
    console.error('Assignments API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    console.log('Create assignment request:', body)

    const {
      moduleId: documentId, // Frontend sends documentId as moduleId
      testId,
      assignedTo, // Can be a single user ID or array of user IDs
      title,
      description,
      dueDate,
      status = 'pending',
      assignedBy = session.user.id
    } = body

    console.log('Parsed assignment data:', {
      documentId,
      testId,
      assignedTo,
      dueDate,
      status,
      assignedBy
    })

    // Validate required fields
    if (!documentId || !assignedTo) {
      console.log('Validation failed - missing required fields')
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: documentId and assignedTo are required'
      }, { status: 400 })
    }

    // Normalize assignedTo to array
    const userIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo]
    console.log('Processing assignments for users:', userIds)

    console.log('Fetching document to get moduleId...')
    
    // Get the document to find its moduleId
    const document = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
    
    if (document.length === 0) {
      console.log('Document not found:', documentId)
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    let moduleId = document[0].moduleId
    if (!moduleId) {
      console.log('Document has no moduleId, creating default module...')
      
      // Create a default module for this document
      const defaultModule = await db.insert(modules).values({
        title: `Module for ${document[0].title}`,
        description: `Auto-generated module for document: ${document[0].title}`,
        content: '',
        status: 'published',
        createdBy: assignedBy // Use the same user who is creating the assignment
      }).returning()
      
      const newModuleId = defaultModule[0].id
      console.log('Created default module:', newModuleId)
      
      // Update the document to reference the new module
      await db.update(documents)
        .set({ moduleId: newModuleId })
        .where(eq(documents.id, documentId))
      
      console.log('Updated document with moduleId:', newModuleId)
      moduleId = newModuleId
    }

    console.log('Found moduleId:', moduleId)
    console.log('Checking for existing assignments...')

    // Check for existing assignments with same module and test
    const existingAssignments = await db.select().from(assignments)
      .where(and(
        eq(assignments.moduleId, moduleId),
        eq(assignments.testId, testId)
      ))

    let assignmentId: string | undefined

    if (existingAssignments.length > 0) {
      // Use existing assignment
      assignmentId = existingAssignments[0].id
      console.log('Found existing assignment:', assignmentId)
    } else {
      // Create a new assignment
      const newAssignment = await db.insert(assignments).values({
        title: title || `Assignment for ${document[0].title}`,
        description: description || '',
        moduleId,
        testId,
        assignedBy,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'pending'
      }).returning()
      
      assignmentId = newAssignment[0].id
      console.log('Created new assignment:', assignmentId)
    }

    // Check existing users for this assignment
    const existingAssignmentUsers = await db.select().from(assignmentUsers)
      .where(eq(assignmentUsers.assignmentId, assignmentId))
    
    const existingUserIds = new Set(existingAssignmentUsers.map(au => au.userId))
    
    // Filter out users who already have this assignment
    const usersToAssign = userIds.filter(userId => !existingUserIds.has(userId))
    
    if (usersToAssign.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          assignment: existingAssignments[0],
          count: 0
        },
        message: 'All selected users already have this assignment',
        warning: 'No new users were added'
      })
    }

    const skippedCount = userIds.length - usersToAssign.length
    console.log(`Adding ${usersToAssign.length} users to assignment, skipping ${skippedCount} existing ones`)

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
          assignmentId,
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

    console.log('Users added successfully:', newAssignmentUsers.length, 'users')

    const responseMessage = usersToAssign.length === userIds.length
      ? `Successfully added ${newAssignmentUsers.length} user(s) to assignment`
      : `Added ${newAssignmentUsers.length} user(s) to assignment. ${skippedCount} user(s) already had this assignment.`

    return NextResponse.json({
      success: true,
      data: {
        assignment: existingAssignments[0] || { id: assignmentId },
        count: newAssignmentUsers.length,
        skippedCount
      },
      message: responseMessage
    })
  } catch (error) {
    console.error('Create assignment API error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json({
      success: false,
      message: 'Failed to create assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
