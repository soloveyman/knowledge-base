import { NextResponse } from 'next/server'
import { db, documents, documentImages, assignments, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { ParsedContent } from '@/lib/parsers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const checkDependencies = searchParams.get('checkDependencies') === 'true'
    
    console.log('GET request for document ID:', id, 'checkDependencies:', checkDependencies)

    // Find document by ID with access control
    const userRole = session.user.role
    const tenantId = session.user.businessId
    
    let doc: typeof documents.$inferSelect[] = []
    
    if (userRole === 'super-admin') {
      // Super-admin can see all documents
      doc = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    } else if (tenantId) {
      // Filter by businessId (tenant isolation) - all other roles
      const rows = await db
        .select({ document: documents })
        .from(documents)
        .innerJoin(users, eq(documents.uploadedBy, users.id))
        .where(and(
          eq(documents.id, id),
          eq(users.businessId, tenantId)
        ))
        .limit(1)
      doc = rows.map(r => r.document)
    }
    
    if (doc.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    // If just checking dependencies, return assignments info
    if (checkDependencies) {
      const moduleId = doc[0].moduleId
      const relatedAssignments = moduleId 
        ? await db.select().from(assignments).where(eq(assignments.moduleId, moduleId))
        : []
      return NextResponse.json({
        success: true,
        hasAssignments: relatedAssignments.length > 0,
        assignmentCount: relatedAssignments.length,
        assignments: relatedAssignments
      })
    }
    
    // Fetch images for this document
    const images = await db
      .select()
      .from(documentImages)
      .where(eq(documentImages.documentId, id))
    
    // Merge images into parsedContent
    const document = doc[0]
    const parsedContent = document.parsedContent as ParsedContent | null
    
    if (parsedContent && images.length > 0) {
      parsedContent.images = images
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(img => ({
          filename: img.filename,
          data: img.data,
          type: img.type,
          position: img.position ?? undefined
        }))
      parsedContent.metadata.totalImages = images.length
    }
    
    return NextResponse.json({
      success: true,
      data: { document }
    })
  } catch (error) {
    console.error('Get document API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to get document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    
    const { id } = await params
    const userRole = session.user.role
    const tenantId = session.user.businessId

    // Check if document exists with access control
    let existingDocument: typeof documents.$inferSelect[] = []
    
    if (userRole === 'super-admin') {
      // Super-admin can delete all documents
      existingDocument = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    } else if (tenantId) {
      // Filter by businessId (tenant isolation) - all other roles
      const rows = await db
        .select({ document: documents })
        .from(documents)
        .innerJoin(users, eq(documents.uploadedBy, users.id))
        .where(and(
          eq(documents.id, id),
          eq(users.businessId, tenantId)
        ))
        .limit(1)
      existingDocument = rows.map(r => r.document)
    }
    
    if (existingDocument.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    // Check if document's module is used in assignments - if so, block deletion
    const document = existingDocument[0]
    if (document.moduleId) {
      const relatedAssignments = await db.select().from(assignments).where(eq(assignments.moduleId, document.moduleId))
      
      if (relatedAssignments.length > 0) {
        return NextResponse.json({
          success: false,
          message: `Cannot delete document. It is used in ${relatedAssignments.length} assignment(s). Please delete the assignments first.`,
          error: 'HAS_ASSIGNMENTS',
          assignmentCount: relatedAssignments.length,
          assignments: relatedAssignments
        }, { status: 400 })
      }
    }

    // Delete the document
    await db.delete(documents).where(eq(documents.id, id))

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('Delete document API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to delete document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}