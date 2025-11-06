import { NextResponse } from 'next/server'
import { db, documents, documentImages, users, usage, tableExists } from '@/lib/db'
import { desc, eq, and, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { ParsedContent } from '@/lib/parsers'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    
    const userRole = session.user.role
    const tenantId = session.user.businessId
    
    let allDocuments: typeof documents.$inferSelect[] = []
    
    // All roles (including owner) filter by businessId for tenant isolation
    // Only super-admin should see all documents across all businesses
    // Hard delete is used, so no need to filter by deleted_at
    if (userRole === 'super-admin') {
      allDocuments = await db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
    } else if (tenantId) {
      // Filter by businessId (tenant isolation) - all other roles
      const rows = await db
        .select({ document: documents, uploaderBusinessId: users.businessId })
        .from(documents)
        .innerJoin(users, eq(documents.uploadedBy, users.id))
        .where(eq(users.businessId, tenantId))
        .orderBy(desc(documents.createdAt))
      allDocuments = rows.map(r => r.document)
    }

    // Fetch images for all documents and merge them into parsedContent
    const documentIds = allDocuments.map(doc => doc.id)
    let allImages: typeof documentImages.$inferSelect[] = []
    
    if (documentIds.length > 0 && await tableExists('document_images')) {
      try {
        allImages = await db
          .select()
          .from(documentImages)
          .where(inArray(documentImages.documentId, documentIds))
      } catch (error) {
        // Table might not exist yet - silently skip
        // Continue without images
      }
    }

    // Group images by documentId
    const imagesByDocumentId = new Map<string, typeof allImages>()
    for (const image of allImages) {
      const docId = image.documentId
      if (!imagesByDocumentId.has(docId)) {
        imagesByDocumentId.set(docId, [])
      }
      imagesByDocumentId.get(docId)!.push(image)
    }

    // Merge images into parsedContent for each document
    const documentsWithImages = allDocuments.map(doc => {
      const docImages = imagesByDocumentId.get(doc.id) || []
      const parsedContent = doc.parsedContent as ParsedContent | null
      
      if (parsedContent && docImages.length > 0) {
        // Convert database images to ParsedContent format
        parsedContent.images = docImages
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map(img => ({
            filename: img.filename,
            data: img.data,
            type: img.type,
            position: img.position ?? undefined
          }))
        parsedContent.metadata.totalImages = docImages.length
      }
      
      return doc
    })

    return NextResponse.json({
      success: true,
      data: {
        documents: documentsWithImages
      }
    })
  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { title, originalFileName, fileType, fileUrl, fileSize, parsedContent, parsingLog } = body

    // Validate required fields
    if (!title) {
      return NextResponse.json({
        success: false,
        message: 'Title is required'
      }, { status: 400 })
    }

    // Extract images from parsedContent before saving
    const content = parsedContent as ParsedContent | null
    const images = content?.images || []
    
    // Remove images from parsedContent (they'll be stored separately)
    const parsedContentWithoutImages = content ? {
      ...content,
      images: [], // Remove images from JSON
      metadata: {
        ...content.metadata,
        totalImages: images.length // Keep count in metadata
      }
    } : null

    // Check if document with same title already exists
    const existingDocument = await db
      .select()
      .from(documents)
      .where(eq(documents.title, title))
      .limit(1)

    let savedDocument: typeof existingDocument[0] | undefined

    if (existingDocument.length > 0) {
      const documentId = existingDocument[0].id
      
      // Delete existing images for this document (if table exists)
      if (await tableExists('document_images')) {
        try {
          await db
            .delete(documentImages)
            .where(eq(documentImages.documentId, documentId))
        } catch (error) {
          // Table might not exist - silently skip
        }
      }
      
      // Update existing document instead of creating a new one
      const updated = await db
        .update(documents)
        .set({
          originalFileName,
          fileType,
          fileUrl,
          fileSize,
          parsedContent: parsedContentWithoutImages,
          parsingLog,
          status: 'ready',
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId))
        .returning()
      
      savedDocument = updated[0]
      
      // Save images to separate table (if table exists)
      if (images.length > 0 && await tableExists('document_images')) {
        try {
          await db.insert(documentImages).values(
            images.map((img, idx) => ({
              documentId,
              filename: img.filename,
              data: img.data,
              type: img.type,
              position: img.position ?? idx
            }))
          )
        } catch (error) {
          // Table might not exist - silently skip
        }
      }
    } else {
      // Create new document
      const newDocument = await db.insert(documents).values({
        title,
        originalFileName,
        fileType,
        fileUrl,
        fileSize,
        parsedContent: parsedContentWithoutImages,
        parsingLog,
        uploadedBy: session.user.id,
        status: 'ready' // Set status to 'ready' since parsing is complete
      }).returning()
      
      savedDocument = newDocument[0]
      
      // Save images to separate table (if table exists)
      if (images.length > 0 && await tableExists('document_images')) {
        try {
          await db.insert(documentImages).values(
            images.map((img, idx) => ({
              documentId: savedDocument!.id,
              filename: img.filename,
              data: img.data,
              type: img.type,
              position: img.position ?? idx
            }))
          )
        } catch (error) {
          // Table might not exist - silently skip
        }
      }
    }
    
    if (!savedDocument) {
      return NextResponse.json({
        success: false,
        message: 'Failed to save document'
      }, { status: 500 })
    }

    // Update usage counter for imports (only for owners and only when creating new document)
    if (session.user.role === 'owner' && existingDocument.length === 0) {
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // Check if usage record exists for current month
      const existingUsage = await db
        .select()
        .from(usage)
        .where(
          and(
            eq(usage.userId, session.user.id),
            eq(usage.month, currentMonth)
          )
        )
        .limit(1)

      if (existingUsage.length > 0) {
        // Update existing usage record
        await db
          .update(usage)
          .set({
            importsCount: (existingUsage[0].importsCount || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(usage.id, existingUsage[0].id))
      } else {
        // Create new usage record
        await db.insert(usage).values({
          userId: session.user.id,
          month: currentMonth,
          importsCount: 1,
          generationsCount: 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        document: savedDocument
      },
      message: existingDocument.length > 0 ? 'Document updated successfully' : 'Document created successfully'
    })
  } catch (error) {
    console.error('Create document API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
