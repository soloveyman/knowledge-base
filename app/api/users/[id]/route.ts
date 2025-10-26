import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('GET request for user ID:', id)
    console.log('ID type:', typeof id)
    console.log('ID length:', id?.length)

    // Try to find user by ID
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1)
    console.log('Query result:', user)
    
    if (user.length === 0) {
      console.log('No user found with ID:', id)
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 })
    }

    console.log('User found:', user[0])
    return NextResponse.json({
      success: true,
      data: { user: user[0] }
    })
  } catch (error) {
    console.error('Get user API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to get user',
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
    console.log('=== DELETE API Debug ===')
    console.log('Request URL:', request.url)
    console.log('Extracted ID:', id)
    console.log('ID type:', typeof id)
    console.log('ID length:', id?.length)

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1)
    console.log('Found user:', existingUser)
    
    if (existingUser.length === 0) {
      console.log('User not found in database')
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 })
    }

    // Delete the user
    await db.delete(users).where(eq(users.id, id))
    console.log('User deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete user API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}