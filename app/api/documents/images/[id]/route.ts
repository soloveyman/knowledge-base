import { NextResponse } from 'next/server'
import { db, documentImages, documents, users } from '@/lib/db'
import { eq, and, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // Get image from database
    const image = await db
      .select()
      .from(documentImages)
      .where(eq(documentImages.id, id))
      .limit(1)

    if (image.length === 0) {
      return NextResponse.json({ success: false, message: 'Image not found' }, { status: 404 })
    }

    const imageData = image[0]

    // Verify user has access to the document (check if document exists and user has permission)
    const userRole = session.user.role
    const tenantId = session.user.businessId

    // Super-admin has access to all documents
    if (userRole === 'super-admin') {
      const document = await db
        .select()
        .from(documents)
        .where(eq(documents.id, imageData.documentId))
        .limit(1)

      if (document.length === 0) {
        return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
      }
    } else {
      // For other users, check access through businessId or ownership
      const rows = await db
        .select({ document: documents, uploaderBusinessId: users.businessId })
        .from(documents)
        .leftJoin(users, eq(documents.uploadedBy, users.id))
        .where(
          and(
            eq(documents.id, imageData.documentId),
            tenantId
              ? or(
                  eq(users.businessId, tenantId),
                  eq(documents.uploadedBy, session.user.id)
                )
              : eq(documents.uploadedBy, session.user.id)
          )
        )
        .limit(1)

      if (rows.length === 0 || !rows[0].document) {
        return NextResponse.json({ success: false, message: 'Document not found or access denied' }, { status: 403 })
      }
    }

    // Return image as base64 data URL
    // imageData.data is stored as base64 (without data URL prefix) in the database
    const dataUrl = `data:${imageData.type};base64,${imageData.data}`

    return NextResponse.json({
      success: true,
      data: {
        id: imageData.id,
        filename: imageData.filename,
        type: imageData.type,
        position: imageData.position,
        dataUrl: dataUrl, // Full data URL for direct use
        data: imageData.data // Raw base64 for flexibility
      }
    })
  } catch (error) {
    console.error('Get image API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

