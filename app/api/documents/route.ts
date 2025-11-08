import { NextResponse } from 'next/server'
import { db, documents, users, usage } from '@/lib/db'
import { desc, eq, and, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // No caching for dynamic data

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
        message: 'Request body too large. Maximum file size is 4MB (Vercel API route limit is 4.5MB). Documents with many images may exceed this limit.' 
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

    // Check if document with same title already exists
    const existingDocument = await db
      .select()
      .from(documents)
      .where(eq(documents.title, title))
      .limit(1)

    let savedDocument

    if (existingDocument.length > 0) {
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
    }

    console.log('Document saved - ID:', savedDocument.id)
    console.log('Saved parsedContent exists:', !!savedDocument.parsedContent)
    console.log('Saved parsedContent sections:', (savedDocument.parsedContent as any)?.sections?.length || 0)
    console.log('Saved parsedContent tables:', (savedDocument.parsedContent as any)?.tables?.length || 0)
    console.log('Saved parsedContent images:', (savedDocument.parsedContent as any)?.images?.length || 0)

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
