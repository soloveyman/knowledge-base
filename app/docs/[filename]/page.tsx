import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { db, documents, documentImages, users, tableExists } from "@/lib/db"
import { eq, and, or, ilike } from "drizzle-orm"
import { DocumentViewerClient } from "./document-viewer-client"
import { DocumentLoadingSkeleton } from "@/components/common/loading-skeleton"

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function fetchDocumentData(filenameOrId: string) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  const userId = session.user.id
  const tenantId = session.user.businessId
  const userRole = session.user.role
  
  const decodedParam = decodeURIComponent(filenameOrId)
  
  // Try to find document by ID first (most reliable)
  let doc: typeof documents.$inferSelect | null = null
  
  if (userRole === 'super-admin') {
    // Super-admin can see all documents
    const docsById = await db
      .select()
      .from(documents)
      .where(eq(documents.id, decodedParam))
      .limit(1)
    
    if (docsById.length > 0) {
      doc = docsById[0]
    } else {
      // Try by filename
      const docsByFilename = await db
        .select()
        .from(documents)
        .where(
          or(
            ilike(documents.originalFileName, `%${decodedParam}%`),
            ilike(documents.title, `%${decodedParam}%`)
          )
        )
        .limit(1)
      
      if (docsByFilename.length > 0) {
        doc = docsByFilename[0]
      }
    }
  } else if (tenantId) {
    // Filter by businessId (tenant isolation)
    const rowsById = await db
      .select({ document: documents })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedBy, users.id))
      .where(
        and(
          eq(documents.id, decodedParam),
          eq(users.businessId, tenantId)
        )
      )
      .limit(1)
    
    if (rowsById.length > 0) {
      doc = rowsById[0].document
    } else {
      // Try by filename
      const rowsByFilename = await db
        .select({ document: documents })
        .from(documents)
        .innerJoin(users, eq(documents.uploadedBy, users.id))
        .where(
          and(
            or(
              ilike(documents.originalFileName, `%${decodedParam}%`),
              ilike(documents.title, `%${decodedParam}%`)
            ),
            eq(users.businessId, tenantId)
          )
        )
        .limit(1)
      
      if (rowsByFilename.length > 0) {
        doc = rowsByFilename[0].document
      }
    }
  }
  
  if (!doc) {
    // Document not found, redirect back
    const userRole = session.user.role || 'manager'
    if (userRole === 'owner') {
      redirect('/owner?tab=docs')
    } else if (userRole === 'manager') {
      redirect('/manager?tab=docs')
    } else {
      redirect('/employee?tab=assignments')
    }
  }
  
  // Fetch images for this document
  let images: typeof documentImages.$inferSelect[] = []
  if (await tableExists('document_images')) {
    try {
      images = await db
        .select()
        .from(documentImages)
        .where(eq(documentImages.documentId, doc.id))
    } catch (error) {
      // Table might not exist - silently skip
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
    metadata?: {
      parserVersion?: string
    }
    images?: Array<{
      filename: string
      data: string
      type: string
      position?: number
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
  
  return {
    id: doc.id,
    name: doc.originalFileName || doc.title || 'Untitled Document',
    type: doc.fileType?.toUpperCase() || 'DOCX',
    uploadedAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    uploadedBy: doc.uploadedBy || 'Unknown',
    size: doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown',
    content: content,
    tables: tables,
    filenameOrId: filenameOrId
  }
}

function DocumentViewerSkeleton() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      <div className="h-16 bg-background border-b" suppressHydrationWarning />
      <main className="max-w-[1200px] mx-auto px-2 sm:px-6 pt-6 pb-4 md:py-8" suppressHydrationWarning>
        <DocumentLoadingSkeleton />
      </main>
    </div>
  )
}

export default async function DocumentViewer({
  params
}: {
  params: Promise<{ filename: string }>
}) {
  const { filename } = await params
  
  try {
    const document = await fetchDocumentData(filename)
    
    return (
      <Suspense fallback={<DocumentViewerSkeleton />}>
        <DocumentViewerClient document={document} />
      </Suspense>
    )
  } catch (error) {
    // Error already handled in fetchDocumentData with redirect
    // This is just a fallback
    redirect('/owner?tab=docs')
  }
}
