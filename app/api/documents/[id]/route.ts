import { NextResponse } from 'next/server'
import { db, documents, assignments } from '@/lib/db'
import { eq } from 'drizzle-orm'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // No caching for dynamic data

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

    // Check if document's module is used in assignments - if so, block deletion
    const document = existingDocument[0]
    if (document.moduleId) {
      const relatedAssignments = await db.select().from(assignments).where(eq(assignments.moduleId, document.moduleId))
      
      if (relatedAssignments.length > 0) {
        return NextResponse.json({
          success: false,
          message: `Cannot delete document. It is used in ${relatedAssignments.length} assignment(s). Please delete the assignments first.`,
          error: 'HAS_ASSIGNMENTS',
          assignmentCount: relatedAssignments.length,
          assignments: relatedAssignments
        }, { status: 400 })
      }
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