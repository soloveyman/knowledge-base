import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { db, assignments, assignmentUsers, testAttempts, users } from "@/lib/db"
import { eq, and, desc, inArray } from "drizzle-orm"
import { EmployeePageClient, type Assignment, TestAttempt } from "./employee-page-client"

// Split data fetching into separate async components for streaming SSR
async function fetchUserInfo() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  if (session.user.role !== 'employee') {
    redirect("/")
  }
  
  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    userImage: session.user.image,
    tenantId: session.user.businessId
  }
}

async function fetchAssignments(userId: string, tenantId: string | null): Promise<Assignment[]> {
  if (!tenantId) {
    return []
  }
  
  // Fetch all assignments for the tenant
  const assignmentsData = await db
    .select({ assignment: assignments, assignerBusinessId: users.businessId })
    .from(assignments)
    .leftJoin(users, eq(assignments.assignedBy, users.id))
    .where(eq(users.businessId, tenantId))
  
  // Fetch assignment users for all assignments
  const assignmentIds = assignmentsData.map(row => row.assignment.id)
  
  let allAssignmentUsers: typeof assignmentUsers.$inferSelect[] = []
  if (assignmentIds.length > 0) {
    allAssignmentUsers = await db
      .select()
      .from(assignmentUsers)
      .where(inArray(assignmentUsers.assignmentId, assignmentIds))
  }
  
  // Fetch test scores for assignments
  const assignmentsWithUsers = await Promise.all(
    assignmentsData.map(async (row) => {
      const assignment = row.assignment
      const assignmentUsersForThis = allAssignmentUsers.filter(au => au.assignmentId === assignment.id)
      
      const usersWithScores = await Promise.all(
        assignmentUsersForThis.map(async (au) => {
          let testScore = null
          if (assignment.testId && au.userId === userId) {
            const attempts = await db
              .select()
              .from(testAttempts)
              .where(
                and(
                  eq(testAttempts.testId, assignment.testId),
                  eq(testAttempts.userId, userId)
                )
              )
              .orderBy(desc(testAttempts.completedAt))
              .limit(1)
            
            if (attempts.length > 0) {
              testScore = attempts[0].score
            }
          }
          
          return {
            userId: au.userId,
            id: au.id,
            status: au.status,
            testScore
          }
        })
      )
      
      return {
        ...assignment,
        users: usersWithScores
      }
    })
  )
  
  // Filter assignments for current user
  const userAssignments = assignmentsWithUsers.filter(assignment => {
    if (assignment.users && Array.isArray(assignment.users)) {
      return assignment.users.some(au => au.userId === userId)
    }
    return false
  })
  
  // Transform assignments
  return userAssignments.map(a => ({
    id: a.id,
    title: a.title || undefined,
    description: a.description || undefined,
    moduleId: a.moduleId || null,
    testId: a.testId || null,
    dueDate: a.dueDate?.toISOString() || null,
    createdAt: a.createdAt?.toISOString(),
    createdBy: a.assignedBy,
    status: a.status,
    users: (a as any).users || []
  }))
}

async function fetchTestAttempts(userId: string): Promise<TestAttempt[]> {
  const attemptsData = await db
    .select()
    .from(testAttempts)
    .where(eq(testAttempts.userId, userId))
  
  return attemptsData.map(attempt => ({
    id: attempt.id,
    testId: attempt.testId,
    userId: attempt.userId,
    score: attempt.score,
    status: attempt.status || 'completed',
    completedAt: attempt.completedAt?.toISOString() || null
  }))
}

function EmployeePageSkeleton() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      <div className="h-16 bg-background border-b" suppressHydrationWarning />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8" suppressHydrationWarning>
        <div className="h-20 bg-muted rounded-lg animate-pulse mb-6" suppressHydrationWarning />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6" suppressHydrationWarning>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" suppressHydrationWarning />
          ))}
        </div>
      </main>
    </div>
  )
}

export default async function EmployeePage() {
  // Fetch user info first (fast, no streaming needed)
  const userInfo = await fetchUserInfo()
  
  // Stream assignments and test attempts independently
  const [assignments, testAttempts] = await Promise.all([
    fetchAssignments(userInfo.userId, userInfo.tenantId),
    fetchTestAttempts(userInfo.userId)
  ])
  
  return (
    <Suspense fallback={<EmployeePageSkeleton />}>
      <EmployeePageClient
        initialAssignments={assignments}
        initialTestAttempts={testAttempts}
        userId={userInfo.userId}
        userName={userInfo.userName}
        userEmail={userInfo.userEmail}
        userImage={userInfo.userImage}
      />
    </Suspense>
  )
}
