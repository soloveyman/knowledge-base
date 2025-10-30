import { NextResponse } from 'next/server'
import { db, documents, users } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
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

    return NextResponse.json({
      success: true,
      data: {
        document: newDocument[0]
      },
      message: 'Document created successfully'
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
