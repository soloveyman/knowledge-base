import { NextResponse } from 'next/server'
import { db, documents, users, usage, documentImages } from '@/lib/db'
import { desc, eq, and, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)
export const maxDuration = 60 // 60 seconds for document uploads with images

export async function GET() {
  try {
    const session = await auth()
    const userRole = session?.user?.role
    
    // All roles filter by businessId for tenant isolation (except super-admin)
    const tenantId = session?.user?.businessId
    
    if (!tenantId && userRole !== 'super-admin') {
      return NextResponse.json({
        success: true,
        data: {
          documents: []
        }
      })
    }
    
    // Super-admin sees all documents
    if (userRole === 'super-admin') {
      const allDocuments = await db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
      
      return NextResponse.json({
        success: true,
        data: {
          documents: allDocuments
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    }
    // Get documents where the uploader's businessId matches, or where uploadedBy matches current user
    // This ensures documents are returned even if the user doesn't exist or doesn't have a businessId
    if (!session?.user?.id) {
      return NextResponse.json({
        success: true,
        data: {
          documents: []
        }
      })
    }
    
    const rows = await db
      .select({ document: documents, uploaderBusinessId: users.businessId })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(
        tenantId 
          ? or(
              eq(users.businessId, tenantId),
              eq(documents.uploadedBy, session.user.id)
            )
          : eq(documents.uploadedBy, session.user.id)
      )
      .orderBy(desc(documents.createdAt))
    const allDocuments = rows.map(r => r.document).filter(doc => doc !== null)

    return NextResponse.json({
      success: true,
      data: {
        documents: allDocuments
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
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
    // Parse request body with error handling for large payloads
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return NextResponse.json({ 
        success: false, 
        message: 'Request body too large. Maximum file size is 3MB (Vercel API route limit is 4.5MB). Documents with many images may exceed this limit.' 
      }, { status: 413 })
    }
    
    const { title, originalFileName, fileType, fileUrl, fileSize, parsedContent, parsingLog } = body

    console.log('POST /api/documents - Saving document:', title)
    console.log('ParsedContent exists:', !!parsedContent)
    console.log('ParsedContent sections:', parsedContent?.sections?.length || 0)
    console.log('ParsedContent tables:', parsedContent?.tables?.length || 0)
    console.log('ParsedContent images:', parsedContent?.images?.length || 0)
    if (parsedContent?.images && parsedContent.images.length > 0) {
      const totalImageSize = parsedContent.images.reduce((sum: number, img: any) => {
        return sum + (img.data?.length || 0)
      }, 0)
      console.log('Total images size (bytes):', totalImageSize)
      console.log('Total images size (MB):', (totalImageSize / 1024 / 1024).toFixed(2))
    }
    console.log('ParsedContent metadata:', parsedContent?.metadata)
    
    // Calculate request body size for debugging
    const requestBodySize = JSON.stringify(body).length
    console.log('Request body size (bytes):', requestBodySize)
    console.log('Request body size (MB):', (requestBodySize / 1024 / 1024).toFixed(2))

    // Validate required fields
    if (!title) {
      return NextResponse.json({
        success: false,
        message: 'Title is required'
      }, { status: 400 })
    }

    // Validate parsedContent exists and has required structure
    if (!parsedContent) {
      console.warn('Warning: parsedContent is null or undefined')
    } else if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
      console.warn('Warning: parsedContent.sections is missing or not an array')
    }

    // Process images: save large images to document_images table
    // Large images (>500KB base64) are stored in the table, small ones stay in JSON
    const LARGE_IMAGE_THRESHOLD = 500 * 1024 // 500KB in bytes (base64 is ~33% larger, so ~375KB binary)
    const imagesToSaveInTable: Array<{
      filename: string
      data: string // base64 data (without data URL prefix)
      type: string
      position?: number
    }> = []

    if (parsedContent?.images && Array.isArray(parsedContent.images)) {
      const processedImages: typeof parsedContent.images = []
      
      for (const img of parsedContent.images) {
        // Skip images that already have imageId (already stored in table)
        if ((img as any).imageId) {
          processedImages.push(img)
          continue
        }
        
        // Extract base64 data from data URL if present (format: "data:image/png;base64,<base64>")
        let base64Data = img.data || ''
        if (!base64Data || base64Data.trim().length === 0) {
          // No data, skip this image
          console.warn(`Skipping image ${img.filename}: no data provided`)
          continue
        }
        
        if (base64Data.startsWith('data:')) {
          // Extract just the base64 part after the comma
          const commaIndex = base64Data.indexOf(',')
          if (commaIndex !== -1) {
            base64Data = base64Data.substring(commaIndex + 1)
          } else {
            // Invalid data URL format
            console.warn(`Skipping image ${img.filename}: invalid data URL format`)
            continue
          }
        }
        
        // Calculate base64 data size (approximate: base64 is ~33% larger than binary)
        const base64Size = base64Data.length
        if (base64Size === 0) {
          console.warn(`Skipping image ${img.filename}: empty base64 data`)
          continue
        }
        
        const estimatedBinarySize = (base64Size * 3) / 4
        
        if (estimatedBinarySize > LARGE_IMAGE_THRESHOLD) {
          // Large image - will be saved in table
          // Store just the base64 data (without data URL prefix) in database
          imagesToSaveInTable.push({
            filename: img.filename || 'image.png',
            data: base64Data, // Store just base64, not full data URL
            type: img.type || 'image/png',
            position: (img as any).textPosition || img.position
          })
          // Replace with reference in parsedContent
          processedImages.push({
            filename: img.filename || 'image.png',
            data: null, // Will be replaced with imageId after saving
            type: img.type || 'image/png',
            position: (img as any).textPosition || img.position,
            imageId: null // Placeholder, will be set after insert
          } as any)
        } else {
          // Small image - keep in JSON (preserve original format)
          processedImages.push(img)
        }
      }
      
      parsedContent.images = processedImages
    }

    // Check if document with same title already exists
    const existingDocument = await db
      .select()
      .from(documents)
      .where(eq(documents.title, title))
      .limit(1)

    // Check usage limit BEFORE saving (only for owners and only when creating new document)
    if (session.user.role === 'owner' && existingDocument.length === 0) {
      const { checkUsageLimit } = await import('@/lib/subscription/usage-check')
      const limitCheck = await checkUsageLimit(session.user.id, 'imports')
      
      if (!limitCheck.allowed) {
        return NextResponse.json({
          success: false,
          message: limitCheck.message || 'Import limit reached. Please upgrade your plan to continue.',
          error: 'USAGE_LIMIT_EXCEEDED',
          current: limitCheck.current,
          max: limitCheck.max
        }, { status: 403 })
      }
    }

    let savedDocument

    if (existingDocument.length > 0) {
      // Delete old large images for this document
      await db
        .delete(documentImages)
        .where(eq(documentImages.documentId, existingDocument[0].id))
      
      // Update existing document instead of creating a new one
      const updated = await db
        .update(documents)
        .set({
          originalFileName,
          fileType,
          fileUrl,
          fileSize,
          parsedContent,
          parsingLog,
          status: 'ready',
          updatedAt: new Date()
        })
        .where(eq(documents.id, existingDocument[0].id))
        .returning()
      
      savedDocument = updated[0]
      console.log('Existing document updated with ID:', savedDocument.id)
    } else {
      // Create new document
      const newDocument = await db.insert(documents).values({
        title,
        originalFileName,
        fileType,
        fileUrl,
        fileSize,
        parsedContent,
        parsingLog,
        uploadedBy: session.user.id,
        status: 'ready' // Set status to 'ready' since parsing is complete
      }).returning()
      
      savedDocument = newDocument[0]
      console.log('New document created with ID:', savedDocument.id)
    }

    // Save large images to documentImages table
    if (imagesToSaveInTable.length > 0) {
      const imageReferences: Array<{ id: string; index: number }> = []
      
      for (let i = 0; i < imagesToSaveInTable.length; i++) {
        const img = imagesToSaveInTable[i]
        const savedImage = await db.insert(documentImages).values({
          documentId: savedDocument.id,
          filename: img.filename,
          data: img.data,
          type: img.type,
          position: img.position
        }).returning()
        
        imageReferences.push({ id: savedImage[0].id, index: i })
      }
      
      // Update parsedContent.images with image IDs for large images
      if (parsedContent?.images && Array.isArray(parsedContent.images)) {
        let largeImageIndex = 0
        for (let i = 0; i < parsedContent.images.length; i++) {
          const img = parsedContent.images[i] as any
          if (img.data === null && img.imageId === null && largeImageIndex < imageReferences.length) {
            // This is a large image placeholder
            img.imageId = imageReferences[largeImageIndex].id
            largeImageIndex++
          }
        }
        
        // Safety check: ensure we processed all large images
        if (largeImageIndex !== imageReferences.length) {
          console.warn(`Image ID assignment mismatch: expected ${imageReferences.length} large images, processed ${largeImageIndex}`)
        }
        
        // Update document with image IDs
        await db
          .update(documents)
          .set({
            parsedContent: parsedContent
          })
          .where(eq(documents.id, savedDocument.id))
        
        // Reload document to get updated parsedContent
        const reloaded = await db
          .select()
          .from(documents)
          .where(eq(documents.id, savedDocument.id))
          .limit(1)
        
        if (reloaded.length > 0) {
          savedDocument = reloaded[0]
        }
      }
      
      console.log(`Saved ${imagesToSaveInTable.length} large images to document_images table`)
    }

    console.log('Document saved - ID:', savedDocument.id)
    console.log('Saved parsedContent exists:', !!savedDocument.parsedContent)
    console.log('Saved parsedContent sections:', (savedDocument.parsedContent as any)?.sections?.length || 0)
    console.log('Saved parsedContent tables:', (savedDocument.parsedContent as any)?.tables?.length || 0)
    console.log('Saved parsedContent images:', (savedDocument.parsedContent as any)?.images?.length || 0)

    // Update usage count AFTER successful save (only for owners and only when creating new document)
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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error
    })
    return NextResponse.json({
      success: false,
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
