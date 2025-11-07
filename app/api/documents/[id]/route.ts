import { NextResponse } from 'next/server'
import { db, documents, documentImages, assignments, users, tableExists } from '@/lib/db'
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
      // Filter by businessId directly (tenant isolation) - all other roles
      try {
        doc = await db
          .select()
          .from(documents)
          .where(and(
            eq(documents.id, id),
            eq(documents.businessId, tenantId)
          ))
          .limit(1)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCause = (error as any)?.cause
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`.toLowerCase()
        
        // If business_id column doesn't exist, fallback to join with users
        if (fullErrorText.includes('business_id') && fullErrorText.includes('does not exist') ||
            fullErrorText.includes('businessid') && fullErrorText.includes('does not exist') ||
            fullErrorText.includes('column') && fullErrorText.includes('business') && fullErrorText.includes('not exist')) {
          // Suppressing warning - fallback is working correctly
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
        } else {
          throw error
        }
      }
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
    let images: typeof documentImages.$inferSelect[] = []
    if (await tableExists('document_images')) {
      try {
        images = await db
          .select()
          .from(documentImages)
          .where(eq(documentImages.documentId, id))
      } catch (error) {
        // Table might not exist yet - silently skip
        // Continue without images
      }
    }
    
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

    console.log('DELETE request for document ID:', id, 'userRole:', userRole, 'tenantId:', tenantId)

    // Check if document exists with access control
    let existingDocument: typeof documents.$inferSelect[] = []
    
    if (userRole === 'super-admin') {
      // Super-admin can delete all documents
      existingDocument = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    } else if (tenantId) {
      // Filter by businessId directly (tenant isolation) - all other roles
      try {
        existingDocument = await db
          .select()
          .from(documents)
          .where(and(
            eq(documents.id, id),
            eq(documents.businessId, tenantId)
          ))
          .limit(1)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCause = (error as any)?.cause
        const nestedMessage = errorCause instanceof Error ? errorCause.message : String(errorCause || '')
        const fullErrorText = `${errorMessage} ${nestedMessage}`.toLowerCase()
        
        // If business_id column doesn't exist, fallback to join with users
        if (fullErrorText.includes('business_id') && fullErrorText.includes('does not exist') ||
            fullErrorText.includes('businessid') && fullErrorText.includes('does not exist') ||
            fullErrorText.includes('column') && fullErrorText.includes('business') && fullErrorText.includes('not exist')) {
          // Suppressing warning - fallback is working correctly
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
        } else {
          throw error
        }
      }
    }
    
    if (existingDocument.length === 0) {
      // Check if document exists at all (without tenant filtering) for better error message
      const anyDocument = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
      
      if (anyDocument.length === 0) {
        console.log('Document does not exist:', id)
        return NextResponse.json({
          success: false,
          message: 'Document not found. It may have already been deleted.'
        }, { status: 404 })
      } else {
        console.log('Document exists but access denied:', id, 'userRole:', userRole, 'tenantId:', tenantId)
        return NextResponse.json({
          success: false,
          message: 'You do not have permission to delete this document'
        }, { status: 403 })
      }
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

    // Hard delete: permanently remove document from database
    // Also delete associated images
    if (await tableExists('document_images')) {
      try {
        await db.delete(documentImages).where(eq(documentImages.documentId, id))
      } catch (error) {
        // Table might not exist - silently skip
      }
    }
    
    // Permanently delete the document
    await db.delete(documents).where(eq(documents.id, id))
    
    console.log('Document permanently deleted:', id)

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