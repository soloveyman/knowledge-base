import { NextResponse } from 'next/server'
import { db, assignments, documents, modules, assignmentUsers, testAttempts, users } from '@/lib/db'
import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { InferSelectModel } from 'drizzle-orm'
import { createAssignmentSchema } from '@/lib/schemas/assignments'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)

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
    
    // Optimize: Fetch all assignment users in one query instead of N queries
    const assignmentIds = assignmentsData.map(a => a.id)
    const allAssignmentUsers = assignmentIds.length > 0
      ? await db
          .select()
          .from(assignmentUsers)
          .where(inArray(assignmentUsers.assignmentId, assignmentIds))
      : []

    // Group assignment users by assignmentId for O(1) lookup
    const usersByAssignment = new Map<string, typeof allAssignmentUsers>()
    for (const au of allAssignmentUsers) {
      if (!usersByAssignment.has(au.assignmentId)) {
        usersByAssignment.set(au.assignmentId, [])
      }
      usersByAssignment.get(au.assignmentId)!.push(au)
    }

    // Collect all test attempts in parallel (batch query instead of N queries)
    const assignmentsWithTests = assignmentsData.filter(a => a.testId)
    const testIds = [...new Set(assignmentsWithTests.map(a => a.testId!))]
    const userIds = [...new Set(allAssignmentUsers.map(au => au.userId))]
    
    const allTestAttempts = testIds.length > 0 && userIds.length > 0
      ? await db
          .select()
          .from(testAttempts)
          .where(
            and(
              inArray(testAttempts.testId, testIds),
              inArray(testAttempts.userId, userIds)
            )
          )
          .orderBy(desc(testAttempts.completedAt))
      : []

    // Group test attempts by testId and userId for O(1) lookup
    const attemptsByTestAndUser = new Map<string, typeof allTestAttempts[0]>()
    for (const attempt of allTestAttempts) {
      const key = `${attempt.testId}:${attempt.userId}`
      // Keep only the latest attempt (already sorted by completedAt desc)
      if (!attemptsByTestAndUser.has(key)) {
        attemptsByTestAndUser.set(key, attempt)
      }
    }

    // Build assignments with users and scores (no more database queries)
    const assignmentsWithUsers = assignmentsData.map((assignment) => {
      const users = usersByAssignment.get(assignment.id) || []
      
      const usersWithScores = users.map((user) => {
        if (assignment.testId) {
          const key = `${assignment.testId}:${user.userId}`
          const attempt = attemptsByTestAndUser.get(key)
          
          if (attempt) {
            return {
              ...user,
              testScore: attempt.score
            }
          }
        }
        return user
      })
      
      return { ...assignment, users: usersWithScores }
    })

    return NextResponse.json({
      success: true,
      data: {
        assignments: assignmentsWithUsers
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    return handleApiError(error, 'Failed to fetch assignments', 500)
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { hasPermission } = await import('@/lib/auth')
    if (!hasPermission(session.user.role, 'ASSIGNMENTS', 'create')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to create assignments' 
      }, { status: 403 })
    }
    // Validate request body
    const validation = await validateRequest(request, createAssignmentSchema)
    if (!validation.success) {
      return validation.response
    }

    const {
      moduleId: documentId, // Frontend sends documentId as moduleId
      testId,
      assignedTo, // Can be a single user ID or array of user IDs
      title,
      description,
      dueDate,
      status = 'pending',
    } = validation.data

    const assignedBy = session.user.id

    console.log('Parsed assignment data:', {
      documentId,
      testId,
      assignedTo,
      dueDate,
      status,
      assignedBy
    })

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
    const whereConditions = [eq(assignments.moduleId, moduleId)]
    if (testId) {
      whereConditions.push(eq(assignments.testId, testId))
    } else {
      whereConditions.push(isNull(assignments.testId))
    }
    const existingAssignments = await db.select().from(assignments)
      .where(and(...whereConditions))

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
    type AssignmentUserRow = InferSelectModel<typeof assignmentUsers>
    
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
    return handleApiError(error, 'Failed to create assignment', 500)
  }
}
