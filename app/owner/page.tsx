import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { db, documents, tests, assignments, users, documentImages, assignmentUsers, testAttempts, tableExists } from "@/lib/db"
import { desc, eq, and, inArray } from "drizzle-orm"
import { formatDateShort } from "@/lib/date-format"
import { OwnerPageClient, type SavedDocument, SavedTest, SavedAssignment, SavedUser } from "./owner-page-client"

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Split data fetching for streaming SSR
async function fetchUserInfo() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  if (session.user.role !== 'owner') {
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

async function fetchOwnerData(tenantId: string | null) {
  // Fetch all data in parallel for streaming
  const [usersData, assignmentsData, testsData, documentsData] = await Promise.all([
    // Users - filter by businessId and exclude owner
    tenantId 
      ? db.select().from(users).where(eq(users.businessId, tenantId))
      : Promise.resolve([]),
    
    // Assignments - filter by businessId for tenant isolation
    tenantId
      ? (async () => {
          try {
            return await db
              .select()
              .from(assignments)
              .where(eq(assignments.businessId, tenantId))
              .orderBy(desc(assignments.createdAt))
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorCause = (error as any)?.cause
            const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
            const fullErrorText = `${errorMessage} ${nestedMessage}`
            
            // If business_id column doesn't exist or query fails, fallback to join with users
            // Suppressing warning - fallback is working correctly
            try {
              // Select only columns that exist (exclude business_id)
              const rows = await db
                .select({
                  assignment: {
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
                  }
                })
                .from(assignments)
                .leftJoin(users, eq(assignments.assignedBy, users.id))
                .where(eq(users.businessId, tenantId))
                .orderBy(desc(assignments.createdAt))
              return rows.map(r => r.assignment)
            } catch (fallbackError) {
              // If even the fallback fails, return empty array
              console.error('Fallback query also failed:', fallbackError)
              return []
            }
          }
        })()
      : Promise.resolve([]),
    
    // Tests - owner sees all (with error handling for missing columns)
    (async () => {
      try {
        return await db.select({
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
        }).from(tests).orderBy(desc(tests.createdAt))
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCause = (error as any)?.cause
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`
        
        if (fullErrorText.includes('column "type" does not exist') || 
            fullErrorText.includes('column "difficulty" does not exist') ||
            fullErrorText.includes('column "locale" does not exist')) {
          const allTests = await db.select({
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
          }).from(tests).orderBy(desc(tests.createdAt))
          
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
    
    // Documents - filter by businessId directly (tenant isolation)
    tenantId
      ? (async () => {
          try {
            return await db
              .select()
              .from(documents)
              .where(eq(documents.businessId, tenantId))
              .orderBy(desc(documents.createdAt))
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorCause = (error as any)?.cause
            const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
            const fullErrorText = `${errorMessage} ${nestedMessage}`
            
            // If business_id column doesn't exist or query fails, fallback to join with users
            // Suppressing warning - fallback is working correctly
            try {
              // Select only columns that exist (exclude business_id)
              const rows = await db
                .select({
                  document: {
                    id: documents.id,
                    moduleId: documents.moduleId,
                    title: documents.title,
                    originalFileName: documents.originalFileName,
                    fileType: documents.fileType,
                    fileUrl: documents.fileUrl,
                    fileSize: documents.fileSize,
                    parsedContent: documents.parsedContent,
                    parsingLog: documents.parsingLog,
                    status: documents.status,
                    uploadedBy: documents.uploadedBy,
                    createdAt: documents.createdAt,
                    updatedAt: documents.updatedAt
                  }
                })
                .from(documents)
                .innerJoin(users, eq(documents.uploadedBy, users.id))
                .where(eq(users.businessId, tenantId))
                .orderBy(desc(documents.createdAt))
              return rows.map(r => r.document)
            } catch (fallbackError) {
              // If even the fallback fails, return empty array
              console.error('Fallback query also failed:', fallbackError)
              return []
            }
          }
        })()
      : Promise.resolve([])
  ])
  
  // Transform users
  const savedUsers: SavedUser[] = usersData
    .filter(u => u.id !== userId)
    .map(u => ({
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
    assignmentsData.map(async (assignment) => {
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
  
  // Transform tests - fetch source documents
  const savedTests: SavedTest[] = await Promise.all(
    testsData.map(async (test) => {
            const questionCount = Array.isArray(test.questionIds) ? test.questionIds.length : 0
            
            let sourceDocument = 'Unknown'
            if (test.moduleId) {
              try {
          const doc = await db
            .select()
            .from(documents)
            .where(eq(documents.id, test.moduleId))
            .limit(1)
          
          if (doc.length > 0) {
            sourceDocument = doc[0].originalFileName || doc[0].title || 'Unknown'
                }
              } catch (error) {
                console.error('Error fetching document for test:', error)
              }
            }
            
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
  )
  
  // Transform documents
  const documentsList = documentsData || []
  
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
  
  const imagesByDocumentId = new Map<string, typeof allImages>()
  for (const image of allImages) {
    const docId = image.documentId
    if (!imagesByDocumentId.has(docId)) {
      imagesByDocumentId.set(docId, [])
    }
    imagesByDocumentId.get(docId)!.push(image)
  }
  
  const savedDocuments: SavedDocument[] = documentsList.map(doc => ({
    id: doc.id,
    name: doc.originalFileName || doc.title,
    type: doc.fileType?.toUpperCase() || 'UNKNOWN',
    uploadedAt: formatDateShort(doc.createdAt?.toISOString() || ''),
    size: doc.fileSize ? formatFileSize(doc.fileSize) : undefined,
    status: doc.status || 'ready',
    moduleId: doc.moduleId || null,
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
    users: savedUsers
  }
}

function OwnerPageSkeleton() {
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

export default async function OwnerPage() {
  // Fetch user info first (fast, no streaming needed)
  const userInfo = await fetchUserInfo()
  
  // Stream data fetching in parallel
  const data = await fetchOwnerData(userInfo.tenantId)
  
  return (
    <Suspense fallback={<OwnerPageSkeleton />}>
      <OwnerPageClient
        initialDocuments={data.documents}
        initialTests={data.tests}
        initialAssignments={data.assignments}
        initialUsers={data.users}
        userId={userInfo.userId}
        userName={userInfo.userName}
        userEmail={userInfo.userEmail}
        userImage={userInfo.userImage}
      />
    </Suspense>
  )
}
