import { NextResponse } from 'next/server'
import { db, assignments, documents, modules } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    // Fetch assignments from database
    const assignmentsData = await db.select().from(assignments)

    return NextResponse.json({
      success: true,
      data: {
        assignments: assignmentsData
      }
    })
  } catch (error) {
    console.error('Assignments API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Create assignment request:', body)

    const {
      moduleId: documentId, // Frontend sends documentId as moduleId
      testId,
      assignedTo, // Can be a single user ID or array of user IDs
      dueDate,
      status = 'pending',
      assignedBy = '3e1b5c25-7785-41b3-9c1f-68453a28bc90' // Owner user ID
    } = body

    console.log('Parsed assignment data:', {
      documentId,
      testId,
      assignedTo,
      dueDate,
      status,
      assignedBy
    })

    // Validate required fields
    if (!documentId || !testId || !assignedTo) {
      console.log('Validation failed - missing required fields')
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: documentId, testId, and assignedTo are required'
      }, { status: 400 })
    }

    // Normalize assignedTo to array
    const userIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo]
    console.log('Processing assignments for users:', userIds)

    console.log('Fetching document to get moduleId...')
    
    // Get the document to find its moduleId
    const document = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
    
    if (document.length === 0) {
      console.log('Document not found:', documentId)
      return NextResponse.json({
        success: false,
        message: 'Document not found'
      }, { status: 404 })
    }

    let moduleId = document[0].moduleId
    if (!moduleId) {
      console.log('Document has no moduleId, creating default module...')
      
      // Create a default module for this document
      const defaultModule = await db.insert(modules).values({
        title: `Module for ${document[0].title}`,
        description: `Auto-generated module for document: ${document[0].title}`,
        content: '',
        status: 'published',
        createdBy: assignedBy // Use the same user who is creating the assignment
      }).returning()
      
      const newModuleId = defaultModule[0].id
      console.log('Created default module:', newModuleId)
      
      // Update the document to reference the new module
      await db.update(documents)
        .set({ moduleId: newModuleId })
        .where(eq(documents.id, documentId))
      
      console.log('Updated document with moduleId:', newModuleId)
      moduleId = newModuleId
    }

    console.log('Found moduleId:', moduleId)
    console.log('Attempting to insert assignments into database...')

    // Create assignments for each user
    const assignmentPromises = userIds.map(userId => 
      db.insert(assignments).values({
        moduleId,
        testId,
        assignedTo: userId,
        assignedBy,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'pending'
      }).returning()
    )

    const newAssignments = await Promise.all(assignmentPromises)
    const createdAssignments = newAssignments.map(result => result[0])

    console.log('Assignments created successfully:', createdAssignments.length, 'assignments')

    return NextResponse.json({
      success: true,
      data: {
        assignments: createdAssignments,
        count: createdAssignments.length
      },
      message: `Successfully created ${createdAssignments.length} assignment(s)`
    })
  } catch (error) {
    console.error('Create assignment API error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json({
      success: false,
      message: 'Failed to create assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
