import { auth } from "@/lib/auth"
import { db, assignments, documents, assignmentUsers, tests, users } from "@/lib/db"
import { eq, inArray, or } from "drizzle-orm"
import { getTenantDb } from "@/lib/db/tenant"
import { redirect } from "next/navigation"
import AssignmentBuilderClient from "./assignment-builder-client"

interface AssignmentBuilderPageProps {
  searchParams: Promise<{ edit?: string; returnTo?: string }>
}

export default async function AssignmentBuilderPage({ searchParams }: AssignmentBuilderPageProps) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }

  const params = await searchParams
  const editingId = params.edit

  const tenantId = session.user.businessId

  if (!tenantId) {
    redirect("/auth/signin")
  }

  // Fetch all data server-side in parallel
  const [testsResult, usersResult, documentsResult, assignmentData] = await Promise.all([
    // Fetch tests - get tenant users first, then their tests
    (async () => {
      const tenantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, tenantId))
      
      const tenantUserIds = tenantUsers.map(u => u.id)
      
      if (tenantUserIds.length === 0) {
        return { success: true, data: { tests: [] } }
      }
      
      const allTests = await db
        .select()
        .from(tests)
        .where(inArray(tests.createdBy, tenantUserIds))
      
      return { success: true, data: { tests: allTests } }
    })(),
    
    // Fetch users
    (async () => {
      const tenantDb = getTenantDb(tenantId)
      const allUsers = await tenantDb
        .select()
        .from(users)
        .where(eq(users.businessId, tenantId))
      return { success: true, data: { users: allUsers } }
    })(),
    
    // Fetch documents - filter by tenant
    (async () => {
      if (session.user.role === 'super-admin') {
        const allDocs = await db.select().from(documents)
        return { success: true, data: { documents: allDocs } }
      }
      
      // Get documents where uploader's businessId matches
      const tenantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, tenantId))
      
      const tenantUserIds = tenantUsers.map(u => u.id)
      
      if (tenantUserIds.length === 0) {
        return { success: true, data: { documents: [] } }
      }
      
      // Use join like the API route does to get documents where uploader's businessId matches
      const rows = await db
        .select({ document: documents, uploaderBusinessId: users.businessId })
        .from(documents)
        .leftJoin(users, eq(documents.uploadedBy, users.id))
        .where(
          or(
            eq(users.businessId, tenantId),
            inArray(documents.uploadedBy, tenantUserIds)
          )
        )
      
      const allDocs = rows.map(r => r.document).filter(doc => doc !== null)
      
      return { success: true, data: { documents: allDocs } }
    })(),
    
    // Fetch assignment data if editing
    (async () => {
      if (!editingId) return null
      
      try {
        const assignment = await db
          .select()
          .from(assignments)
          .where(eq(assignments.id, editingId))
          .limit(1)
        
        if (assignment.length === 0) return null
        
        const assignmentUsersList = await db
          .select()
          .from(assignmentUsers)
          .where(eq(assignmentUsers.assignmentId, editingId))
        
        // Find document by moduleId
        let documentId = ''
        if (session.user.role === 'super-admin') {
          const allDocs = await db.select().from(documents)
          const doc = allDocs.find(d => d.moduleId === assignment[0].moduleId)
          documentId = doc ? String(doc.id) : ''
        } else {
          const tenantUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.businessId, tenantId))
          
          const tenantUserIds = tenantUsers.map(u => u.id)
          
          if (tenantUserIds.length > 0) {
            const rows = await db
              .select({ document: documents, uploaderBusinessId: users.businessId })
              .from(documents)
              .leftJoin(users, eq(documents.uploadedBy, users.id))
              .where(
                or(
                  eq(users.businessId, tenantId),
                  inArray(documents.uploadedBy, tenantUserIds)
                )
              )
            
            const allDocs = rows.map(r => r.document).filter(doc => doc !== null)
            const doc = allDocs.find(d => d.moduleId === assignment[0].moduleId)
            documentId = doc ? String(doc.id) : ''
          }
        }
        
        return {
          assignment: assignment[0],
          users: assignmentUsersList,
          documentId
        }
      } catch (error) {
        console.error('Error fetching assignment:', error)
        return null
      }
    })()
  ])

  // Transform data for client component
  const initialAssignmentData = assignmentData ? {
    name: assignmentData.assignment.title || `Assignment ${assignmentData.assignment.id.slice(0, 8)}`,
    documentId: assignmentData.documentId,
    testId: assignmentData.assignment.testId || '',
    selectedUsers: assignmentData.users.map(u => u.userId).filter(Boolean) as string[],
    dueDate: assignmentData.assignment.dueDate ? new Date(assignmentData.assignment.dueDate) : undefined,
    description: assignmentData.assignment.description || ''
  } : null

  // Transform tests to match SavedTest interface
  const testsData = testsResult.success ? testsResult.data.tests.map((test: any) => {
    const questionIds = Array.isArray(test.questionIds) ? test.questionIds : []
    return {
      id: test.id,
      title: test.title || '',
      type: test.type || '',
      difficulty: test.difficulty || '',
      locale: test.locale || '',
      questionCount: questionIds.length,
      questions: [], // Not needed for the dropdown, but required by interface
      sourceDocument: test.moduleId || '',
      createdAt: test.createdAt ? new Date(test.createdAt).toISOString() : new Date().toISOString(),
      createdBy: test.createdBy || ''
    }
  }) : []
  
  // Transform users to match User interface (add department if missing)
  const usersData = usersResult.success ? usersResult.data.users.map((user: any) => ({
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'employee',
    job: user.job || '',
    department: user.department || '' // Add department field
  })) : []
  
  // Transform documents to match Document interface (convert null to undefined)
  const documentsData = documentsResult.success ? documentsResult.data.documents.map((doc: any) => ({
    id: doc.id,
    originalFileName: doc.originalFileName ?? undefined,
    title: doc.title || '',
    fileType: doc.fileType ?? undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    fileSize: doc.fileSize ?? undefined,
    status: doc.status || 'ready'
  })) : []

  return (
    <AssignmentBuilderClient
      initialAssignmentData={initialAssignmentData}
      initialTests={testsData}
      initialUsers={usersData}
      initialDocuments={documentsData}
      editingId={editingId || null}
      returnTo={params.returnTo || null}
    />
  )
}
