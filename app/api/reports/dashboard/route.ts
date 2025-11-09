import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, users, assignments, assignmentUsers, modules, testAttempts } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.businessId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.businessId
    const userRole = session.user.role

    // Get all employees in the tenant
    const employeeUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.businessId, tenantId),
        eq(users.role, 'employee')
      ))

    // Get all assignments for the tenant (via assignedBy user's businessId)
    const tenantAssignments = await db
      .select({ assignment: assignments, assignerBusinessId: users.businessId })
      .from(assignments)
      .leftJoin(users, eq(assignments.assignedBy, users.id))
      .where(eq(users.businessId, tenantId))

    const assignmentsData = tenantAssignments.map(r => r.assignment)

    // Get all assignment_users for these assignments
    const allAssignmentUsers = await Promise.all(
      assignmentsData.map(async (assignment) => {
        const aus = await db
          .select()
          .from(assignmentUsers)
          .where(eq(assignmentUsers.assignmentId, assignment.id))
        return aus
      })
    )
    const flatAssignmentUsers = allAssignmentUsers.flat()

    // Get all test attempts for employees
    const employeeUserIds = employeeUsers.map(u => u.id)
    const allTestAttempts = employeeUserIds.length > 0
      ? await db
          .select()
          .from(testAttempts)
          .where(inArray(testAttempts.userId, employeeUserIds))
      : []

    // Calculate employee progress
    const employeeProgress = await Promise.all(
      employeeUsers.map(async (employee) => {
        // Get assignments for this employee
        const employeeAssignments = flatAssignmentUsers.filter(
          au => au.userId === employee.id
        )

        // Get assignment details
        const assignmentDetails = employeeAssignments.map(au => {
          const assignment = assignmentsData.find(a => a.id === au.assignmentId)
          return { ...au, assignment }
        })

        // Calculate status
        const hasCompleted = assignmentDetails.some(
          ad => ad.status === 'completed' || ad.status === 'passed'
        )
        const hasInProgress = assignmentDetails.some(
          ad => ad.status === 'in_progress'
        )
        const hasOverdue = assignmentDetails.some(ad => {
          if (!ad.assignment?.dueDate) return false
          const dueDate = new Date(ad.assignment.dueDate)
          const now = new Date()
          return dueDate < now && ad.status !== 'completed' && ad.status !== 'passed'
        })

        let status: 'not_started' | 'in_progress' | 'completed' | 'overdue' = 'not_started'
        if (hasOverdue) status = 'overdue'
        else if (hasCompleted) status = 'completed'
        else if (hasInProgress) status = 'in_progress'

        // Get test attempts for this employee
        const employeeAttempts = allTestAttempts.filter(ta => ta.userId === employee.id)
        
        // Calculate average score
        const scores = employeeAttempts
          .filter(ta => ta.score !== null && ta.score !== undefined)
          .map(ta => ta.score!)
        const averageScore = scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : undefined

        // Calculate total time spent (in minutes)
        const totalTimeSpent = employeeAttempts
          .filter(ta => ta.timeSpent !== null && ta.timeSpent !== undefined)
          .reduce((sum, ta) => sum + (ta.timeSpent || 0), 0) / 60 // Convert seconds to minutes

        // Get max attempts from assignments
        const maxAttempts = Math.max(
          ...assignmentDetails.map(ad => ad.assignment?.maxAttempts || 1),
          1
        )

        // Get last activity (most recent test attempt or assignment update)
        const lastAttempt = employeeAttempts
          .sort((a, b) => {
            const aTime = a.completedAt || a.startedAt || new Date(0)
            const bTime = b.completedAt || b.startedAt || new Date(0)
            return bTime.getTime() - aTime.getTime()
          })[0]

        const lastAssignmentUpdate = assignmentDetails
          .sort((a, b) => {
            const aTime = a.updatedAt || a.createdAt || new Date(0)
            const bTime = b.updatedAt || b.createdAt || new Date(0)
            return bTime.getTime() - aTime.getTime()
          })[0]

        const lastActivity = lastAttempt?.completedAt || lastAttempt?.startedAt || 
          lastAssignmentUpdate?.updatedAt || lastAssignmentUpdate?.createdAt || 
          employee.createdAt || new Date()

        return {
          id: employee.id,
          name: employee.name || employee.email,
          email: employee.email,
          status,
          score: averageScore,
          timeSpent: Math.round(totalTimeSpent),
          lastActivity: lastActivity.toISOString(),
          attempts: employeeAttempts.length,
          maxAttempts
        }
      })
    )

    // Calculate report data by module
    const modulesMap = new Map<string, {
      moduleId: string
      moduleTitle: string
      totalAssigned: number
      started: number
      completed: number
      scores: number[]
      timeSpent: number[]
      overdueCount: number
    }>()

    for (const assignment of assignmentsData) {
      if (!assignment.moduleId) continue

      const module = await db
        .select()
        .from(modules)
        .where(eq(modules.id, assignment.moduleId))
        .limit(1)

      if (module.length === 0) continue

      const moduleId = assignment.moduleId
      const moduleTitle = module[0].title

      if (!modulesMap.has(moduleId)) {
        modulesMap.set(moduleId, {
          moduleId,
          moduleTitle,
          totalAssigned: 0,
          started: 0,
          completed: 0,
          scores: [],
          timeSpent: [],
          overdueCount: 0
        })
      }

      const moduleData = modulesMap.get(moduleId)!

      // Get assignment users for this assignment
      const assignmentUsersForModule = flatAssignmentUsers.filter(
        au => au.assignmentId === assignment.id
      )

      moduleData.totalAssigned += assignmentUsersForModule.length

      for (const au of assignmentUsersForModule) {
        if (au.status === 'completed' || au.status === 'passed') {
          moduleData.completed++
        } else if (au.status === 'in_progress') {
          moduleData.started++
        }

        // Check overdue
        if (assignment.dueDate) {
          const dueDate = new Date(assignment.dueDate)
          const now = new Date()
          if (dueDate < now && au.status !== 'completed' && au.status !== 'passed') {
            moduleData.overdueCount++
          }
        }

        // Get test attempts for this user and assignment
        if (assignment.testId) {
          const attempts = allTestAttempts.filter(
            ta => ta.userId === au.userId && ta.testId === assignment.testId
          )

          for (const attempt of attempts) {
            if (attempt.score !== null && attempt.score !== undefined) {
              moduleData.scores.push(attempt.score)
            }
            if (attempt.timeSpent !== null && attempt.timeSpent !== undefined) {
              moduleData.timeSpent.push(attempt.timeSpent / 60) // Convert to minutes
            }
          }
        }
      }
    }

    // Convert modules map to report data array
    const reportData = Array.from(modulesMap.values()).map(moduleData => ({
      moduleId: moduleData.moduleId,
      moduleTitle: moduleData.moduleTitle,
      totalAssigned: moduleData.totalAssigned,
      started: moduleData.started,
      completed: moduleData.completed,
      averageScore: moduleData.scores.length > 0
        ? Math.round(moduleData.scores.reduce((sum, score) => sum + score, 0) / moduleData.scores.length)
        : 0,
      averageTimeSpent: moduleData.timeSpent.length > 0
        ? Math.round(moduleData.timeSpent.reduce((sum, time) => sum + time, 0) / moduleData.timeSpent.length)
        : 0,
      completionRate: moduleData.totalAssigned > 0
        ? Math.round((moduleData.completed / moduleData.totalAssigned) * 100)
        : 0,
      overdueCount: moduleData.overdueCount
    }))

    return NextResponse.json({
      success: true,
      data: {
        reportData,
        employeeProgress
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch reports data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
