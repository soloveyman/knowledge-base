import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { db, documents, tests, assignments, users, documentImages, assignmentUsers, testAttempts, tableExists } from "@/lib/db"
import { desc, eq, and, inArray } from "drizzle-orm"
import { formatDateShort } from "@/lib/date-format"
import { ManagerPageClient, type SavedDocument, SavedTest, SavedAssignment, SavedUser } from "./manager-page-client"

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function fetchManagerData() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  if (session.user.role !== 'manager') {
    redirect("/")
  }
  
  const userId = session.user.id
  const tenantId = session.user.businessId
  
  if (!tenantId) {
    return {
      documents: [],
      tests: [],
      assignments: [],
      users: [],
      userId,
      userName: session.user.name,
      userEmail: session.user.email,
      userImage: session.user.image
    }
  }
  
  // Fetch all data in parallel
  const [usersData, assignmentsData, testsData, documentsData] = await Promise.all([
    // Users - filter by businessId
    db.select().from(users).where(eq(users.businessId, tenantId)),
    
    // Assignments - filter by businessId via assigner
    db
      .select({ assignment: assignments, assignerBusinessId: users.businessId })
      .from(assignments)
      .leftJoin(users, eq(assignments.assignedBy, users.id))
      .where(eq(users.businessId, tenantId))
      .orderBy(desc(assignments.createdAt)),
    
    // Tests - filter by businessId via creator (with error handling for missing columns)
    (async () => {
      try {
        return await db
          .select({
            id: tests.id,
            moduleId: tests.moduleId,
            title: tests.title,
            description: tests.description,
            questionIds: tests.questionIds,
            type: tests.type,
            difficulty: tests.difficulty,
            locale: tests.locale,
            passingScore: tests.passingScore,
            timeLimit: tests.timeLimit,
            maxAttempts: tests.maxAttempts,
            shuffleQuestions: tests.shuffleQuestions,
            showCorrectAnswers: tests.showCorrectAnswers,
            status: tests.status,
            isActive: tests.isActive,
            createdBy: tests.createdBy,
            createdAt: tests.createdAt,
            updatedAt: tests.updatedAt
          })
          .from(tests)
          .innerJoin(users, eq(tests.createdBy, users.id))
          .where(eq(users.businessId, tenantId))
          .orderBy(desc(tests.createdAt))
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCause = (error as any)?.cause
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`
        
        if (fullErrorText.includes('column "type" does not exist') || 
            fullErrorText.includes('column "difficulty" does not exist') ||
            fullErrorText.includes('column "locale" does not exist')) {
          const allTests = await db
            .select({
              id: tests.id,
              moduleId: tests.moduleId,
              title: tests.title,
              description: tests.description,
              questionIds: tests.questionIds,
              passingScore: tests.passingScore,
              timeLimit: tests.timeLimit,
              maxAttempts: tests.maxAttempts,
              shuffleQuestions: tests.shuffleQuestions,
              showCorrectAnswers: tests.showCorrectAnswers,
              status: tests.status,
              isActive: tests.isActive,
              createdBy: tests.createdBy,
              createdAt: tests.createdAt,
              updatedAt: tests.updatedAt
            })
            .from(tests)
            .innerJoin(users, eq(tests.createdBy, users.id))
            .where(eq(users.businessId, tenantId))
            .orderBy(desc(tests.createdAt))
          
          return allTests.map(test => ({
            ...test,
            type: null,
            difficulty: null,
            locale: null
          }))
        }
        throw error
      }
    })(),
    
    // Documents - filter by businessId
    db
      .select({ document: documents, uploaderBusinessId: users.businessId })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(users.businessId, tenantId))
      .orderBy(desc(documents.createdAt))
  ])
  
  // Transform users
  const savedUsers: SavedUser[] = usersData.map(u => ({
    id: u.id,
    name: u.name || '',
    job: u.job || '',
    email: u.email,
    role: u.role || 'employee',
    createdAt: u.createdAt?.toISOString() || '',
    createdBy: u.id, // Placeholder
    status: 'active'
  }))
  
  // Fetch assignment users and test attempts
  const assignmentsWithUsers = await Promise.all(
    assignmentsData.map(async (row) => {
      const assignment = row.assignment
      const assignmentUsersData = await db
        .select()
        .from(assignmentUsers)
        .where(eq(assignmentUsers.assignmentId, assignment.id))
      
      const usersWithScores = await Promise.all(
        assignmentUsersData.map(async (au) => {
          let testScore = null
          if (assignment.testId) {
            const attempts = await db
              .select()
              .from(testAttempts)
              .where(
                and(
                  eq(testAttempts.testId, assignment.testId),
                  eq(testAttempts.userId, au.userId)
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
  
  // Transform assignments
  const savedAssignments: SavedAssignment[] = assignmentsWithUsers.map(a => ({
    id: a.id,
    title: a.title || undefined,
    description: a.description || undefined,
    moduleId: a.moduleId || '',
    testId: a.testId || null,
    assignedTo: a.groupId || '', // Using groupId as assignedTo
    assignedBy: a.assignedBy,
    dueDate: a.dueDate?.toISOString() || null,
    status: a.status,
    allowRetake: a.allowRetake || false,
    maxAttempts: a.maxAttempts || 1,
    createdAt: a.createdAt?.toISOString() || '',
    updatedAt: a.updatedAt?.toISOString() || '',
    users: (a as any).users || []
  }))
  
  // Create document lookup map for tests
  const documentMap = new Map<string, { originalFileName?: string; title?: string }>()
  const documentsList = documentsData.map(r => r.document)
  documentsList.forEach(doc => {
    documentMap.set(doc.id, { originalFileName: doc.originalFileName || undefined, title: doc.title })
  })
  
  // Transform tests
  const savedTests: SavedTest[] = testsData.map((test) => {
    const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
    const doc = documentMap.get(test.moduleId || '')
    const sourceDocument = doc?.originalFileName || doc?.title || 'Unknown'
    
    return {
      id: test.id,
      title: test.title,
      type: test.type || 'mcq',
      difficulty: test.difficulty || 'medium',
      locale: test.locale || 'en',
      questionCount,
      questions: [],
      sourceDocument,
      createdAt: test.createdAt?.toISOString() || '',
      createdBy: test.createdBy || ''
    }
  })
  
  // Fetch images for documents
  const documentIds = documentsList.map(doc => doc.id)
  let allImages: typeof documentImages.$inferSelect[] = []
  
  if (documentIds.length > 0 && await tableExists('document_images')) {
    try {
      allImages = await db
        .select()
        .from(documentImages)
        .where(inArray(documentImages.documentId, documentIds))
    } catch (error) {
      // Table might not exist - silently skip
    }
  }
  
  // Transform documents
  const savedDocuments: SavedDocument[] = documentsList.map(doc => ({
    id: doc.id,
    name: doc.originalFileName || doc.title,
    type: doc.fileType?.toUpperCase() || 'UNKNOWN',
    uploadedAt: formatDateShort(doc.createdAt?.toISOString() || ''),
    size: doc.fileSize ? formatFileSize(doc.fileSize) : undefined,
    status: doc.status || 'ready',
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
    parsedContent: doc.parsedContent as {
      metadata?: {
        enhancedBy?: string
        enhancementTimestamp?: number
      }
    } | null
  }))
  
  return {
    documents: savedDocuments,
    tests: savedTests,
    assignments: savedAssignments,
    users: savedUsers,
    userId,
    userName: session.user.name,
    userEmail: session.user.email,
    userImage: session.user.image
  }
}

function ManagerPageSkeleton() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      <div className="h-16 bg-background border-b" suppressHydrationWarning />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:py-8" suppressHydrationWarning>
        <div className="h-20 bg-muted rounded-lg animate-pulse mb-6" suppressHydrationWarning />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6" suppressHydrationWarning>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" suppressHydrationWarning />
          ))}
        </div>
      </main>
    </div>
  )
}

export default async function ManagerPage() {
  const data = await fetchManagerData()
  
  return (
    <Suspense fallback={<ManagerPageSkeleton />}>
      <ManagerPageClient
        initialDocuments={data.documents}
        initialTests={data.tests}
        initialAssignments={data.assignments}
        initialUsers={data.users}
        userId={data.userId}
        userName={data.userName}
        userEmail={data.userEmail}
        userImage={data.userImage}
      />
    </Suspense>
  )
}
