import { NextResponse } from 'next/server'
import { db, documents, users, usage, documentImages } from '@/lib/db'
import { desc, eq, and, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { uploadImageToSpaces } from '@/lib/storage/spaces'

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
    // This ensures documents are returned even if the user doesn't have a businessId yet
    if (!session?.user?.id) {
      return NextResponse.json({
        success: true,
        data: {
          documents: []
        }
      })
    }
    
    // If user has businessId, filter by tenant; otherwise, show only user's own documents
    // Use subquery to get uploader's businessId, then filter documents
    const rows = await db
      .select({ 
        document: documents, 
        uploaderBusinessId: users.businessId 
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(
        tenantId 
          ? or(
              eq(users.businessId, tenantId),
              eq(documents.uploadedBy, session.user.id)
            )
          : eq(documents.uploadedBy, session.user.id) // If no businessId, show only user's documents
      )
      .orderBy(desc(documents.createdAt))
    
    // Filter out null documents and ensure we have valid documents
    const allDocuments = rows
      .map(r => r.document)
      .filter((doc): doc is typeof documents.$inferSelect => doc !== null)
    
    // Log for debugging
    console.log('GET /api/documents - Found documents:', allDocuments.length, 'for user:', session.user.id, 'businessId:', tenantId)

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
    
    const { title, originalFileName, fileType, fileUrl, fileSize, parsingLog } = body
    let parsedContent = body.parsedContent // Use let to allow reassignment

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
      console.error('ERROR: parsedContent is null or undefined - document cannot be saved without content')
      return NextResponse.json({
        success: false,
        message: 'Document content is missing. Please re-upload the file.'
      }, { status: 400 })
    }
    
    if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
      console.warn('Warning: parsedContent.sections is missing or not an array, creating empty sections array')
      if (!parsedContent.sections) {
        parsedContent.sections = []
      }
    }
    
    // Ensure images array exists
    if (!parsedContent.images || !Array.isArray(parsedContent.images)) {
      console.warn('Warning: parsedContent.images is missing or not an array, creating empty images array')
      parsedContent.images = []
    }
    
    // Ensure tables array exists
    if (!parsedContent.tables || !Array.isArray(parsedContent.tables)) {
      console.warn('Warning: parsedContent.tables is missing or not an array, creating empty tables array')
      parsedContent.tables = []
    }

    // Process images: upload ALL images to Spaces
    // All images MUST be uploaded to Spaces - base64 storage is disabled
    // URLs from Spaces are stored in parsedContent and documentImages table
    const imagesToUpload: Array<{
      filename: string
      base64Data: string // Temporary base64 data for upload to S3 (not stored in DB)
      type: string
      position?: number
      originalIndex: number // Index in original images array
    }> = []

    if (parsedContent?.images && Array.isArray(parsedContent.images)) {
      // First pass: collect all images for upload
      for (let i = 0; i < parsedContent.images.length; i++) {
        const img = parsedContent.images[i]
        
        // Skip images that already have URL (already uploaded)
        if ((img as any).url) {
          continue
        }
        
        // Skip images that already have imageId but no URL (legacy, will be handled later)
        if ((img as any).imageId && !(img as any).url) {
          continue
        }
        
        // Extract base64 data from data URL if present
        let base64Data = img.data || ''
        if (!base64Data || base64Data.trim().length === 0) {
          console.warn(`Skipping image ${img.filename}: no data provided`)
          continue
        }
        
        if (base64Data.startsWith('data:')) {
          // Extract just the base64 part after the comma
          const commaIndex = base64Data.indexOf(',')
          if (commaIndex !== -1) {
            base64Data = base64Data.substring(commaIndex + 1)
          } else {
            console.warn(`Skipping image ${img.filename}: invalid data URL format`)
            continue
          }
        }
        
        if (base64Data.length === 0) {
          console.warn(`Skipping image ${img.filename}: empty base64 data`)
          continue
        }
        
        imagesToUpload.push({
          filename: img.filename || 'image.png',
          base64Data,
          type: img.type || 'image/png',
          position: (img as any).textPosition || img.position,
          originalIndex: i
        })
      }
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

    // Upload ALL images to Spaces before saving document
    // We need a temporary document ID, so we'll create/update document first, then upload images
    let savedDocument
    let documentId: string

    if (existingDocument.length > 0) {
      documentId = existingDocument[0].id
      // Delete old images for this document (will be replaced with new ones)
      await db
        .delete(documentImages)
        .where(eq(documentImages.documentId, documentId))
    } else {
      // Create temporary document to get ID for image folder structure
      const tempDocument = await db.insert(documents).values({
        title,
        originalFileName,
        fileType,
        fileUrl,
        fileSize,
        parsedContent, // Will be updated with URLs after upload
        parsingLog,
        uploadedBy: session.user.id,
        status: 'uploading' // Temporary status
      }).returning()
      
      documentId = tempDocument[0].id
      savedDocument = tempDocument[0]
    }

    // Upload all images to Spaces and update parsedContent with URLs
    if (imagesToUpload.length > 0) {
      console.log(`📤 Uploading ${imagesToUpload.length} images to Spaces...`)
      
      const uploadResults: Array<{
        originalIndex: number
        url: string | null
        storageKey: string | null
        imageId: string | null
        error?: string
      }> = []

      // Upload images in parallel (but limit concurrency to avoid overwhelming Spaces)
      const uploadPromises = imagesToUpload.map(async (img) => {
        try {
          const imageBuffer = Buffer.from(img.base64Data, 'base64')
          const uploadResult = await uploadImageToSpaces(
            imageBuffer,
            img.filename,
            img.type,
            `documents/${documentId}`
          )
          
          console.log(`✅ Uploaded ${img.filename} to Spaces: ${uploadResult.url}`)
          
          // Save to documentImages table for management
          const savedImage = await db.insert(documentImages).values({
            documentId,
            filename: img.filename,
            url: uploadResult.url,
            storageKey: uploadResult.key,
            type: img.type,
            position: img.position
          }).returning()
          
          return {
            originalIndex: img.originalIndex,
            url: uploadResult.url,
            storageKey: uploadResult.key,
            imageId: savedImage[0].id,
            error: undefined
          }
        } catch (error) {
          console.error(`❌ Failed to upload ${img.filename} to Spaces:`, error)
          // Don't save base64 - all images must be in S3
          // If upload fails, skip the image and log the error
          console.error(`Skipping image ${img.filename} - S3 upload failed and base64 storage is disabled`)
          return {
            originalIndex: img.originalIndex,
            url: null,
            storageKey: null,
            imageId: null,
            error: error instanceof Error ? error.message : 'S3 upload failed - base64 storage disabled'
          }
        }
      })

      const results = await Promise.all(uploadPromises)
      uploadResults.push(...results)

      // Update parsedContent.images with URLs from Spaces and insert into content
      if (parsedContent?.images && Array.isArray(parsedContent.images)) {
        const updatedParsedContent = JSON.parse(JSON.stringify(parsedContent))
        
        // Map upload results by original index
        const urlMap = new Map<number, { url: string | null; imageId: string | null }>()
        uploadResults.forEach(result => {
          urlMap.set(result.originalIndex, { url: result.url, imageId: result.imageId })
        })
        
        // Update images in parsedContent and collect images with URLs for content insertion
        const imagesToInsert: Array<{ url: string; filename: string; position?: number }> = []
        
        for (let i = 0; i < updatedParsedContent.images.length; i++) {
          const img = updatedParsedContent.images[i] as any
          const result = urlMap.get(i)
          
          if (result) {
            if (result.url) {
              // Successfully uploaded to Spaces - store URL
              img.url = result.url
              img.data = null // Remove base64 data
              if (result.imageId) {
                img.imageId = result.imageId // Keep imageId for reference
              }
              
              // Collect for content insertion
              imagesToInsert.push({
                url: result.url,
                filename: img.filename || `image_${i + 1}.png`,
                position: img.position
              })
            } else if (result.imageId) {
              // Failed to upload but saved to DB - keep imageId for API lookup
              img.imageId = result.imageId
              img.data = null // Don't store base64 in parsedContent
            }
            // If both failed, keep original data as fallback
          }
        }
        
        // Insert images into content sections as markdown
        if (imagesToInsert.length > 0 && updatedParsedContent.sections && Array.isArray(updatedParsedContent.sections)) {
          console.log(`📸 Processing ${imagesToInsert.length} images for content insertion...`)
          
          // Track which images have been inserted to avoid duplicates
          const insertedImages = new Set<number>()
          
          // Step 1: Replace existing data URLs in content with Spaces URLs
          // This handles images that were already in the content as data URLs
          imagesToInsert.forEach((img, imgIndex) => {
            const imageMarkdown = `![${img.filename}](${img.url})`
            
            // Try to find and replace data URL for this image in content
            for (let sectionIndex = 0; sectionIndex < updatedParsedContent.sections.length; sectionIndex++) {
              const section = updatedParsedContent.sections[sectionIndex]
              
              // Look for data URL image markdown that might match this image
              // Pattern: ![alt](data:image/type;base64,...)
              const dataUrlPattern = /!\[([^\]]*)\]\(data:[^)]+\)/g
              let match
              let foundMatch = false
              
              // Create a new string with replacements
              let newContent = section.content
              while ((match = dataUrlPattern.exec(section.content)) !== null) {
                const altText = match[1] || ''
                // Check if this might be the same image (by filename in alt)
                if (altText.includes(img.filename) || altText === img.filename.replace(/\.[^/.]+$/, '')) {
                  // Replace this data URL with the Spaces URL (only first match)
                  newContent = newContent.replace(match[0], imageMarkdown)
                  foundMatch = true
                  insertedImages.add(imgIndex)
                  console.log(`📸 Replaced data URL with Spaces URL in section ${sectionIndex} for ${img.filename}`)
                  break // Only replace first match
                }
              }
              
              if (foundMatch) {
                updatedParsedContent.sections[sectionIndex].content = newContent
                break // Move to next image
              }
            }
          })
          
          // Step 2: Insert images that weren't found in content (no data URL to replace)
          // Sort by position to maintain order
          const imagesToInsertNew = imagesToInsert
            .map((img, index) => ({ ...img, originalIndex: index }))
            .filter((_, index) => !insertedImages.has(index))
            .sort((a, b) => {
              if (a.position !== undefined && b.position !== undefined) {
                return a.position - b.position
              }
              if (a.position !== undefined) return -1
              if (b.position !== undefined) return 1
              return a.originalIndex - b.originalIndex // Maintain original order if no position
            })
          
          console.log(`📸 ${imagesToInsertNew.length} images need to be inserted (not found in content)`)
          
          // Insert images that weren't replaced
          imagesToInsertNew.forEach((img) => {
            const imageMarkdown = `![${img.filename}](${img.url})`
            let inserted = false
            
            // Try to insert at specific position if available
            if (img.position !== undefined && img.position >= 0) {
              let currentPos = 0
              for (let sectionIndex = 0; sectionIndex < updatedParsedContent.sections.length; sectionIndex++) {
                const section = updatedParsedContent.sections[sectionIndex]
                const sectionLength = section.content.length
                
                if (img.position >= currentPos && img.position < currentPos + sectionLength) {
                  // Insert image into this section at the specified position
                  const relativePos = img.position - currentPos
                  const before = section.content.substring(0, relativePos)
                  const after = section.content.substring(relativePos)
                  
                  // Insert image markdown (with newlines for proper formatting)
                  updatedParsedContent.sections[sectionIndex].content = 
                    before + (before.trim() ? '\n\n' : '') + imageMarkdown + (after.trim() ? '\n\n' : '') + after
                  
                  console.log(`📸 Inserted image "${img.filename}" into section ${sectionIndex} at position ${img.position}`)
                  inserted = true
                  break
                }
                
                currentPos += sectionLength + 1 // +1 for newline between sections
              }
            }
            
            // If not inserted at specific position, don't append to end
            // Images should only be inserted if they have a valid position or were already in content
            if (!inserted) {
              console.log(`⚠️ Skipping image "${img.filename}" - no valid position and not found in content`)
            }
          })
        }
        
        parsedContent = updatedParsedContent
      }
      
      const successfulUploads = uploadResults.filter(r => r.url).length
      const failedUploads = uploadResults.filter(r => !r.url).length
      console.log(`✅ Processed ${uploadResults.length} images: ${successfulUploads} uploaded to Spaces, ${failedUploads} failed (base64 storage disabled)`)
      if (failedUploads > 0) {
        console.warn(`⚠️ ${failedUploads} image(s) failed to upload to S3 and were skipped (base64 storage is disabled)`)
      }
    }

    // Update document with final parsedContent (with URLs)
    if (existingDocument.length > 0) {
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
        .where(eq(documents.id, documentId))
        .returning()
      
      savedDocument = updated[0]
      console.log('Existing document updated with ID:', savedDocument.id)
    } else {
      // Update temporary document with final parsedContent
      const updated = await db
        .update(documents)
        .set({
          parsedContent,
          status: 'ready',
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId))
        .returning()
      
      if (updated.length > 0) {
        savedDocument = updated[0]
        console.log('New document created with ID:', savedDocument.id)
      } else {
        // Fallback: reload document
        const reloaded = await db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1)
        
        if (reloaded.length > 0) {
          savedDocument = reloaded[0]
        }
      }
    }

    if (!savedDocument) {
      console.error('Failed to save document - savedDocument is null/undefined')
      console.error('Document ID was:', documentId)
      console.error('Existing document check:', existingDocument.length > 0)
      return NextResponse.json({
        success: false,
        message: 'Failed to save document - document was not created or updated'
      }, { status: 500 })
    }

    console.log('Document saved - ID:', savedDocument.id)
    console.log('Saved parsedContent exists:', !!savedDocument.parsedContent)
    if (savedDocument.parsedContent) {
      const pc = savedDocument.parsedContent as any
      console.log('Saved parsedContent sections:', pc?.sections?.length || 0)
      console.log('Saved parsedContent tables:', pc?.tables?.length || 0)
      console.log('Saved parsedContent images:', pc?.images?.length || 0)
      if (pc?.images && Array.isArray(pc.images)) {
        const imagesWithId = pc.images.filter((img: any) => img.imageId).length
        const imagesWithData = pc.images.filter((img: any) => img.data).length
        console.log(`Saved parsedContent images breakdown: ${imagesWithId} with imageId, ${imagesWithData} with inline data`)
      }
    }

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
