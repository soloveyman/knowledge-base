import { NextResponse } from 'next/server'
import { db, assignments, documents, modules, assignmentUsers, testAttempts, users } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { InferSelectModel } from 'drizzle-orm'

type Assignment = InferSelectModel<typeof assignments>
type AssignmentWithSelectedFields = Pick<Assignment, 'id' | 'title' | 'description' | 'moduleId' | 'testId' | 'assignedBy' | 'groupId' | 'dueDate' | 'status' | 'allowRetake' | 'maxAttempts' | 'createdAt' | 'updatedAt'>

export async function GET() {
  try {
    const session = await auth()
    const userRole = session?.user?.role
    
    let assignmentsData: Assignment[] | AssignmentWithSelectedFields[] = []
    
    // All roles (including owner) filter by businessId for tenant isolation
    // Only super-admin should see all assignments across all businesses
    const tenantId = session?.user?.businessId
    
    if (userRole === 'super-admin') {
      assignmentsData = await db
        .select()
        .from(assignments)
        .orderBy(desc(assignments.createdAt))
    } else if (tenantId) {
      // Filter by businessId directly (tenant isolation) - all other roles
      try {
        assignmentsData = await db
          .select()
          .from(assignments)
          .where(eq(assignments.businessId, tenantId))
          .orderBy(desc(assignments.createdAt))
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCause = (error as any)?.cause
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`
        
        // If business_id column doesn't exist, fallback to join with users
        if (fullErrorText.includes('column "business_id" does not exist') || 
            fullErrorText.includes('column "businessId" does not exist')) {
          // Suppressing warning - fallback is working correctly
          const rows = await db
            .select({
              id: assignments.id,
              title: assignments.title,
              description: assignments.description,
              moduleId: assignments.moduleId,
              testId: assignments.testId,
              assignedBy: assignments.assignedBy,
              groupId: assignments.groupId,
              dueDate: assignments.dueDate,
              status: assignments.status,
              allowRetake: assignments.allowRetake,
              maxAttempts: assignments.maxAttempts,
              createdAt: assignments.createdAt,
              updatedAt: assignments.updatedAt
            })
            .from(assignments)
            .leftJoin(users, eq(assignments.assignedBy, users.id))
            .where(eq(users.businessId, tenantId))
            .orderBy(desc(assignments.createdAt))
          assignmentsData = rows
        } else {
          throw error
        }
      }
    } else {
      // No businessId - return empty array for security
      assignmentsData = []
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
      
      // Get user's businessId for tenant isolation
      const businessId = session.user.businessId || session.user.id
      
      // Create a default module for this document
      const defaultModule = await db.insert(modules).values({
        title: `Module for ${document[0].title}`,
        description: `Auto-generated module for document: ${document[0].title}`,
        content: '',
        status: 'published',
        businessId, // Set businessId for tenant isolation
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
      // Get user's businessId for tenant isolation
      const businessId = session.user.businessId || session.user.id
      
      if (!businessId) {
        return NextResponse.json({
          success: false,
          message: 'User must have a businessId to create assignments'
        }, { status: 400 })
      }
      
      // Create a new assignment
      const newAssignment = await db.insert(assignments).values({
        title: title || `Assignment for ${document[0].title}`,
        description: description || '',
        moduleId,
        testId,
        businessId, // Set businessId for tenant isolation
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
