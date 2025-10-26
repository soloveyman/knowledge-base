import { NextResponse } from 'next/server'
import { db, documents } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if document exists
    const existingDocument = await db.select().from(documents).where(eq(documents.id, id)).limit(1)
    if (existingDocument.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    // Delete the document
    await db.delete(documents).where(eq(documents.id, id))

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