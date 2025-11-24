import { NextResponse } from 'next/server'
import { db, documents, assignments, documentImages, users } from '@/lib/db'
import { eq, and, or } from 'drizzle-orm'
import { deleteImageFromSpaces } from '@/lib/storage/spaces'
import { auth, hasPermission } from '@/lib/auth'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const checkDependencies = searchParams.get('checkDependencies') === 'true'
    
    console.log('GET request for document ID:', id, 'checkDependencies:', checkDependencies)

    // Find document by ID
    const doc = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    
    if (doc.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    const document = doc[0]
    console.log('GET /api/documents/[id] - Document ID:', id)
    console.log('Document parsedContent exists:', !!document.parsedContent)
    console.log('Document parsedContent type:', typeof document.parsedContent)
    if (document.parsedContent) {
      const pc = document.parsedContent as any
      console.log('ParsedContent sections:', pc?.sections?.length || 0)
      console.log('ParsedContent tables:', pc?.tables?.length || 0)
      console.log('ParsedContent metadata:', pc?.metadata)
    }

    // If just checking dependencies, return assignments info
    if (checkDependencies) {
      const moduleId = document.moduleId
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
    
    return NextResponse.json({
      success: true,
      data: { document }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'MATERIALS', 'update')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Forbidden - you do not have permission to update documents' 
      }, { status: 403 })
    }

    const { id } = await params
    
    // Check if document exists and user has access
    const existingDoc = await db
      .select({ 
        document: documents,
        uploaderBusinessId: users.businessId 
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.id, id))
      .limit(1)
    
    if (existingDoc.length === 0 || !existingDoc[0].document) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
    }

    // Check tenant isolation: super-admin can update any, others can only update their tenant's documents
    const userRole = session.user.role
    const tenantId = session.user.businessId
    if (userRole !== 'super-admin') {
      const uploaderBusinessId = existingDoc[0].uploaderBusinessId
      const isOwner = existingDoc[0].document.uploadedBy === session.user.id
      
      if (!isOwner && uploaderBusinessId !== tenantId) {
        return NextResponse.json({
          success: false,
          message: 'Forbidden - you can only update documents from your business'
        }, { status: 403 })
      }
    }

    const body = await request.json()
    const { parsedContent } = body

    if (!parsedContent) {
      return NextResponse.json({ 
        success: false, 
        message: 'parsedContent is required' 
      }, { status: 400 })
    }

    // Update document with new parsedContent
    // Note: This might still fail if parsedContent is too large, but we try
    const updated = await db
      .update(documents)
      .set({
        parsedContent,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning()
    
    if (updated.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update document' 
      }, { status: 500 })
    }

    if (updated.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update document' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { document: updated[0] }
    })
  } catch (error) {
    console.error('PATCH document API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to update document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ DELETE request received for document')
    
    // Await params first to get the ID for logging
    const { id } = await params
    console.log('🗑️ DELETE request for document ID:', id)
    
    // Check authentication
    const session = await auth()
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role, 'MATERIALS', 'delete')) {
      return NextResponse.json({
        success: false,
        message: 'Forbidden - you do not have permission to delete documents'
      }, { status: 403 })
    }

    // Check if document exists and user has access
    console.log('🔍 Checking if document exists:', id)
    const existingDocument = await db
      .select({ 
        document: documents,
        uploaderBusinessId: users.businessId 
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.id, id))
      .limit(1)

    console.log('🔍 Document query result:', existingDocument.length > 0 ? 'found' : 'not found')
    
    if (existingDocument.length === 0 || !existingDocument[0].document) {
      console.log('❌ Document not found:', id)
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }
    
    console.log('✅ Document found, proceeding with deletion checks')

    const document = existingDocument[0].document
    const userRole = session.user.role
    const tenantId = session.user.businessId

    // Check access: super-admin can delete any, others can only delete their own business documents
    if (userRole !== 'super-admin') {
      const uploaderBusinessId = existingDocument[0].uploaderBusinessId
      const isOwner = document.uploadedBy === session.user.id
      
      if (!isOwner && uploaderBusinessId !== tenantId) {
        return NextResponse.json({
          success: false,
          message: 'Forbidden - you can only delete documents from your business'
        }, { status: 403 })
      }
    }

    // Check if document's module is used in assignments - if so, block deletion
    // Only check if document has a moduleId (documents can exist without modules)
    if (document.moduleId) {
      try {
        const relatedAssignments = await db
          .select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.moduleId, document.moduleId))
        
        if (relatedAssignments.length > 0) {
          console.log(`⚠️ Document ${id} cannot be deleted: used in ${relatedAssignments.length} assignment(s)`)
          return NextResponse.json({
            success: false,
            message: `Cannot delete document. It is used in ${relatedAssignments.length} assignment(s). Please delete the assignments first.`,
            error: 'HAS_ASSIGNMENTS',
            assignmentCount: relatedAssignments.length
          }, { status: 400 })
        }
      } catch (assignmentCheckError) {
        console.error(`⚠️ Error checking assignments for document ${id}:`, assignmentCheckError)
        // Don't block deletion if we can't check assignments - continue with deletion
        console.warn(`⚠️ Continuing with deletion despite assignment check error`)
      }
    }

    // Get all images for this document before deletion
    // Select only columns that exist in the database (storageKey is the only one we need)
    let documentImagesList: Array<{ id: string; storageKey: string | null }> = []
    try {
      documentImagesList = await db
        .select({
          id: documentImages.id,
          storageKey: documentImages.storageKey
        })
        .from(documentImages)
        .where(eq(documentImages.documentId, id))
    } catch (error) {
      console.error(`⚠️ Failed to fetch document images for ${id}:`, error)
      // Continue with deletion even if we can't fetch images
    }

    // Delete images from Spaces (if they have storageKey) - non-blocking
    if (documentImagesList.length > 0) {
      console.log(`🗑️ Deleting ${documentImagesList.length} images from Spaces for document ${id}`)
      
      const imagesWithKeys = documentImagesList.filter(img => img.storageKey)
      console.log(`Found ${imagesWithKeys.length} images with storageKey to delete`)
      
      if (imagesWithKeys.length > 0) {
        const deletePromises = imagesWithKeys.map(async (img) => {
          try {
            if (!img.storageKey) {
              console.warn(`⚠️ Image ${img.id} has no storageKey, skipping`)
              return
            }
            await deleteImageFromSpaces(img.storageKey)
            console.log(`✅ Deleted image from Spaces: ${img.storageKey}`)
          } catch (error) {
            // Log error but don't fail document deletion if Spaces deletion fails
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error(`❌ Failed to delete image from Spaces (${img.storageKey}):`, errorMessage)
            // If Spaces is not configured, just log and continue
            if (errorMessage.includes('not configured')) {
              console.warn(`⚠️ Spaces not configured, skipping image deletion from S3`)
            }
          }
        })
        
        // Don't await - let it run in background, document deletion should not wait
        Promise.allSettled(deletePromises).then(() => {
          console.log(`✅ Finished deleting images from Spaces for document ${id}`)
        }).catch((error) => {
          console.error(`⚠️ Error during Promise.allSettled for image deletion:`, error)
        })
      }
    }

    // Explicitly delete documentImages first (even though cascade should handle it)
    // This ensures clean deletion and avoids any potential foreign key issues
    if (documentImagesList.length > 0) {
      console.log(`🗑️ Deleting ${documentImagesList.length} document images from database`)
      try {
        await db.delete(documentImages).where(eq(documentImages.documentId, id))
        console.log(`✅ Document images deleted from database`)
      } catch (imageDeleteError) {
        console.warn(`⚠️ Failed to delete document images (will try cascade):`, imageDeleteError)
        // Continue - cascade should handle it
      }
    }

    // Delete the document
    console.log(`🗑️ Deleting document ${id} from database`)
    try {
      const deleteResult = await db.delete(documents).where(eq(documents.id, id))
      console.log(`✅ Document ${id} delete query executed`)
      
      // Verify deletion by checking if document still exists
      const verifyDeleted = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
      if (verifyDeleted.length > 0) {
        console.error(`❌ Document ${id} still exists after deletion attempt`)
        return NextResponse.json({
          success: false,
          message: 'Document deletion failed - document still exists',
          error: 'DELETION_VERIFICATION_FAILED'
        }, { status: 500 })
      }
      
      console.log(`✅ Document ${id} deleted successfully and verified`)
    } catch (dbError) {
      console.error(`❌ Database error deleting document ${id}:`, dbError)
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      
      // Check if it's a foreign key constraint error
      if (dbErrorMessage.includes('foreign key') || dbErrorMessage.includes('constraint') || dbErrorMessage.includes('23503')) {
        // Try to get more details about what's blocking
        const relatedAssignments = document.moduleId 
          ? await db.select().from(assignments).where(eq(assignments.moduleId, document.moduleId))
          : []
        
        return NextResponse.json({
          success: false,
          message: relatedAssignments.length > 0
            ? `Cannot delete document. It is used in ${relatedAssignments.length} assignment(s). Please delete the assignments first.`
            : 'Cannot delete document. It is still referenced by other records.',
          error: 'FOREIGN_KEY_CONSTRAINT',
          assignmentCount: relatedAssignments.length
        }, { status: 400 })
      }
      
      // Re-throw to be caught by outer catch
      throw dbError
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('❌ Delete document API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Check if it's a params parsing error
    if (errorMessage.includes('params') || errorMessage.includes('id')) {
      console.error('⚠️ Possible params parsing error - this might indicate a routing issue')
    }
    
    console.error('Error details:', { 
      errorMessage, 
      errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    })
    
    // Don't return 404 for general errors - only return 404 if document not found
    // If it's a params error, it's likely a routing issue, return 500
    return NextResponse.json({
      success: false,
      message: 'Failed to delete document',
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 })
  }
}