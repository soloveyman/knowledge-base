import { NextResponse } from 'next/server'
import { db, documents } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const allDocuments = await db.select().from(documents)

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
    const body = await request.json()
    const { title, originalFileName, fileType, fileUrl, fileSize, parsedContent, parsingLog, uploadedBy } = body

    // Validate required fields
    if (!title || !uploadedBy) {
      return NextResponse.json({
        success: false,
        message: 'Title and uploadedBy are required'
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
      uploadedBy,
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
