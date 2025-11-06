import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { db, documents, assignments, users, tests } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { DocumentReaderClient } from "./document-reader-client"

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function fetchDocumentAndAssignment(documentId: string) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  const userId = session.user.id
  const tenantId = session.user.businessId
  const userRole = session.user.role
  
  // Fetch document by ID
  let doc: typeof documents.$inferSelect | null = null
  
  if (userRole === 'super-admin') {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)
    
    if (docs.length > 0) {
      doc = docs[0]
    }
  } else if (tenantId) {
    const rows = await db
      .select({ document: documents })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedBy, users.id))
      .where(
        and(
          eq(documents.id, documentId),
          eq(users.businessId, tenantId)
        )
      )
      .limit(1)
    
    if (rows.length > 0) {
      doc = rows[0].document
    }
  }
  
  if (!doc) {
    // Document not found, redirect back
    if (userRole === 'owner') {
      redirect('/owner?tab=docs')
    } else if (userRole === 'manager') {
      redirect('/manager?tab=docs')
    } else {
      redirect('/employee?tab=assignments')
    }
  }
  
  // Extract content from sections
  let content = ''
  const parsedContent = doc.parsedContent as {
    sections?: Array<{ title?: string; content: string; level?: number }>
    tables?: Array<{
      title: string
      headers: string[]
      rows: string[][]
    }>
  } | null
  
  if (parsedContent?.sections && parsedContent.sections.length > 0) {
    content = parsedContent.sections
      .map((s) => {
        const sectionParts: string[] = []
        const contentTrimmed = s.content?.trim() || ''
        
        if (s.title && !contentTrimmed.startsWith('#')) {
          const level = s.level || 2
          const headingPrefix = '#'.repeat(Math.min(level, 6))
          sectionParts.push(`${headingPrefix} ${s.title}`)
        }
        
        if (s.content) {
          sectionParts.push(s.content)
        }
        
        return sectionParts.join('\n')
      })
      .filter(Boolean)
      .join('\n\n')
    
    // Clean artifacts (preserve legitimate lists)
    content = content
      .replace(/;\s*1\./g, '')
      .replace(/\.\s*1\./g, '.')
      .replace(/\s+1\.\s*$/gm, '')
  }
  
  // Extract tables
  const tables = parsedContent?.tables || []
  
  if (!content && tables.length === 0) {
    content = 'Document content will be displayed here...'
  }
  
  const documentData = {
    id: String(doc.id),
    name: doc.originalFileName || doc.title || 'Untitled',
    type: doc.fileType?.toUpperCase() || 'DOCX',
    uploadedAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    uploadedBy: doc.uploadedBy || 'Unknown',
    size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
    content: content,
    tables: tables.length > 0 ? tables : undefined
  }
  
  // Find assignment that has this document
  let assignmentData = null
  
  if (doc.moduleId) {
    const assignmentRows = await db
      .select({ assignment: assignments })
      .from(assignments)
      .where(eq(assignments.moduleId, doc.moduleId))
      .limit(1)
    
    if (assignmentRows.length > 0) {
      const assignment = assignmentRows[0].assignment
      
      // Fetch test data if testId exists
      let testData = null
      if (assignment.testId) {
        const testRows = await db
          .select()
          .from(tests)
          .where(eq(tests.id, assignment.testId))
          .limit(1)
        
        if (testRows.length > 0) {
          const test = testRows[0]
          testData = {
            id: test.id,
            title: test.title,
            questionCount: Array.isArray(test.questionIds) ? test.questionIds.length : 0
          }
        }
      }
      
      assignmentData = {
        id: assignment.id,
        name: assignment.title || 'Assignment',
        description: assignment.description || '',
        test: testData,
        dueDate: assignment.dueDate?.toISOString() || '',
        status: assignment.status || 'in_progress'
      }
    }
  }
  
  // If no assignment found, create a minimal one for display
  if (!assignmentData) {
    assignmentData = {
      id: String(doc.id),
      name: doc.title || 'Document',
      description: '',
      test: null,
      dueDate: '',
      status: 'completed'
    }
  }
  
  return {
    document: documentData,
    assignment: assignmentData
  }
}

function DocumentReaderSkeleton() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      <div className="h-16 bg-background border-b" suppressHydrationWarning />
      <main className="max-w-[1200px] mx-auto px-2 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 md:py-8 lg:py-10" suppressHydrationWarning>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
        </div>
      </main>
    </div>
  )
}

export default async function DocumentReaderPage({
  params
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  
  try {
    const data = await fetchDocumentAndAssignment(documentId)
    
    return (
      <Suspense fallback={<DocumentReaderSkeleton />}>
        <DocumentReaderClient document={data.document} assignment={data.assignment} />
      </Suspense>
    )
  } catch (error) {
    // Error already handled in fetchDocumentAndAssignment with redirect
    // This is just a fallback
    redirect('/employee?tab=assignments')
  }
}
