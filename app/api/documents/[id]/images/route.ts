import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, documents, documentImages } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id: documentId } = await params
    
    // Check if document exists
    const existingDoc = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
    if (existingDoc.length === 0) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
    }

    const body = await request.json()
    const { images } = body

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ 
        success: false, 
        message: 'images array is required' 
      }, { status: 400 })
    }

    // Save images to documentImages table
    const savedImages = []
    for (const img of images) {
      if (!img.filename || !img.url || !img.type) {
        console.warn(`Skipping invalid image:`, img)
        continue
      }

      try {
        const savedImage = await db.insert(documentImages).values({
          documentId,
          filename: img.filename,
          url: img.url,
          storageKey: img.key || null,
          type: img.type,
          position: img.position || null
        }).returning()

        savedImages.push(savedImage[0])
        console.log(`✅ Saved image to database: ${savedImage[0].id} for ${img.filename}`)
      } catch (error) {
        console.error(`❌ Failed to save image ${img.filename}:`, error)
        // Continue with other images
      }
    }

    // Update parsedContent to replace base64 data with URLs and insert images into content
    const document = existingDoc[0]
    const parsedContent = document.parsedContent as any
    
    if (parsedContent && parsedContent.images && Array.isArray(parsedContent.images)) {
      // Create maps for quick lookup
      const urlMap = new Map<string, string>()
      const positionMap = new Map<string, number>()
      savedImages.forEach(img => {
        if (img.filename && img.url) {
          urlMap.set(img.filename, img.url)
          if (img.position !== null && img.position !== undefined) {
            positionMap.set(img.filename, img.position)
          }
        }
      })

      // Update images in parsedContent
      parsedContent.images = parsedContent.images.map((img: any) => {
        const url = urlMap.get(img.filename)
        const savedPosition = positionMap.get(img.filename)
        if (url) {
          return {
            filename: img.filename,
            type: img.type,
            position: savedPosition !== undefined ? savedPosition : img.position,
            url: url,
            // Remove base64 data
            data: undefined
          }
        }
        return img
      })

      // Insert images into content sections at their positions (same logic as in POST /api/documents)
      if (parsedContent.sections && Array.isArray(parsedContent.sections)) {
        const imagesToInsert: Array<{ url: string; filename: string; position?: number }> = []
        savedImages.forEach(img => {
          if (img.url && img.filename) {
            imagesToInsert.push({
              url: img.url,
              filename: img.filename,
              position: img.position !== null && img.position !== undefined ? img.position : undefined
            })
          }
        })

        if (imagesToInsert.length > 0) {
          console.log(`📸 Inserting ${imagesToInsert.length} images into content sections...`)
          
          // Track which images have been inserted to avoid duplicates
          const insertedImages = new Set<string>()
          
          // Step 1: Replace existing data URLs in content with Spaces URLs
          imagesToInsert.forEach((img) => {
            const imageMarkdown = `![${img.filename}](${img.url})`
            
            // Try to find and replace data URL for this image in content
            for (let sectionIndex = 0; sectionIndex < parsedContent.sections.length; sectionIndex++) {
              const section = parsedContent.sections[sectionIndex]
              
              // Look for data URL image markdown
              const dataUrlPattern = /!\[([^\]]*)\]\(data:[^)]+\)/g
              let match
              let foundMatch = false
              
              let newContent = section.content
              while ((match = dataUrlPattern.exec(section.content)) !== null) {
                const altText = match[1] || ''
                const filenameMatch = altText.includes(img.filename) || altText === img.filename.replace(/\.[^/.]+$/, '')
                
                if (filenameMatch && !insertedImages.has(img.filename)) {
                  newContent = newContent.replace(match[0], imageMarkdown)
                  foundMatch = true
                  insertedImages.add(img.filename)
                  break
                }
              }
              
              if (foundMatch) {
                parsedContent.sections[sectionIndex].content = newContent
                console.log(`📸 Replaced data URL with Spaces URL for ${img.filename} in section ${sectionIndex}`)
                break
              }
            }
          })
          
          // Step 2: Insert images that weren't replaced (new images or images without data URLs in content)
          const imagesToInsertNew = imagesToInsert.filter(img => !insertedImages.has(img.filename))
          
          if (imagesToInsertNew.length > 0) {
            console.log(`📸 ${imagesToInsertNew.length} images need to be inserted at specific positions`)
            
            imagesToInsertNew.forEach((img) => {
              const imageMarkdown = `![${img.filename}](${img.url})`
              console.log(`📸 Attempting to insert image: ${img.filename} at position ${img.position}`)
              let inserted = false
              
              // Try to insert at specific position if available
              if (img.position !== undefined && img.position >= 0) {
                let currentPos = 0
                for (let sectionIndex = 0; sectionIndex < parsedContent.sections.length; sectionIndex++) {
                  const section = parsedContent.sections[sectionIndex]
                  const sectionLength = section.content.length
                  
                  if (img.position >= currentPos && img.position < currentPos + sectionLength) {
                    // Insert image into this section at the specified position
                    const relativePos = img.position - currentPos
                    const before = section.content.substring(0, relativePos)
                    const after = section.content.substring(relativePos)
                    
                    console.log(`📸 Inserting image ${img.filename} at position ${img.position} (relative: ${relativePos}) in section ${sectionIndex}`)
                    
                    // Insert image markdown (with newlines for proper formatting)
                    parsedContent.sections[sectionIndex].content = 
                      before + (before.trim() ? '\n\n' : '') + imageMarkdown + (after.trim() ? '\n\n' : '') + after
                    
                    console.log(`📸 Inserted image "${img.filename}" into section ${sectionIndex} at position ${img.position}`)
                    inserted = true
                    break
                  }
                  
                  currentPos += sectionLength + 1 // +1 for newline between sections
                }
              }
              
              // If not inserted at specific position, append to first section or end of content
              if (!inserted) {
                if (parsedContent.sections.length > 0) {
                  // Append to first section
                  parsedContent.sections[0].content += '\n\n' + imageMarkdown
                  console.log(`✅ Appended image "${img.filename}" to first section (no valid position)`)
                } else {
                  console.warn(`⚠️ Cannot insert image "${img.filename}" - no sections available`)
                }
              }
            })
          }
        }
      }

      // Update document with new parsedContent
      await db
        .update(documents)
        .set({
          parsedContent,
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId))
      
      console.log(`✅ Updated parsedContent for document ${documentId} with image URLs and inserted images into content`)
    }

    return NextResponse.json({
      success: true,
      data: {
        savedImages,
        count: savedImages.length
      }
    })
  } catch (error) {
    console.error('Save document images API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to save document images',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

