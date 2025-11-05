import { NextResponse } from 'next/server'
import { db, documents, users, usage } from '@/lib/db'
import { desc, eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    const userRole = session?.user?.role
    
    // Owner sees all documents regardless of businessId
    if (userRole === 'owner') {
      const allDocuments = await db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
      
      return NextResponse.json({
        success: true,
        data: {
          documents: allDocuments
        }
      })
    }
    
    // Manager and other roles filter by businessId (tenant isolation)
    const tenantId = session?.user?.businessId
    const rows = await db
      .select({ document: documents, uploaderBusinessId: users.businessId })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(tenantId ? eq(users.businessId, tenantId) : undefined as unknown as never)
      .orderBy(desc(documents.createdAt))
    const allDocuments = rows.map(r => r.document)

    return NextResponse.json({
      success: true,
      data: {
        documents: allDocuments
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
