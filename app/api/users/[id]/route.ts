import { NextResponse } from 'next/server'
import { db, users, testAttempts, assignmentUsers, progress, modules, questions, tests, assignments, userGroupMembers } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    console.log('PUT request for user ID:', id)
    console.log('Update data:', body)

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1)
    
    if (existingUser.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 })
    }

    // Valid role types
    type UserRole = 'super-admin' | 'owner' | 'manager' | 'employee'
    const validRoles: UserRole[] = ['super-admin', 'owner', 'manager', 'employee']
    
    // Prepare update data
    const updateData: {
      name?: string | null
      job?: string | null
      email?: string
      role?: UserRole
      password?: string
      updatedAt: Date
    } = {
      updatedAt: new Date()
    }
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.job !== undefined) updateData.job = body.job
    if (body.email !== undefined) updateData.email = body.email
    // Validate role before adding to updateData
    if (body.role !== undefined) {
      if (validRoles.includes(body.role as UserRole)) {
        updateData.role = body.role as UserRole
      } else {
        return NextResponse.json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        }, { status: 400 })
      }
    }

    // Only update password if provided
    if (body.password && body.password.trim()) {
      const hashedPassword = await bcrypt.hash(body.password, 12)
      updateData.password = hashedPassword
    }

    // Update the user
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))

    console.log('User updated successfully')

    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    })
  } catch (error) {
    console.error('Update user API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to update user',
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

    // Cascade delete related records
    // Delete user's test attempts
    await db.delete(testAttempts).where(eq(testAttempts.userId, id))
    console.log('Deleted test attempts')
    
    // Delete user's assignment users
    await db.delete(assignmentUsers).where(eq(assignmentUsers.userId, id))
    console.log('Deleted assignment users')
    
    // Delete user's progress
    await db.delete(progress).where(eq(progress.userId, id))
    console.log('Deleted progress')
    
    // Delete user's group memberships
    await db.delete(userGroupMembers).where(eq(userGroupMembers.userId, id))
    console.log('Deleted group memberships')
    
    // Note: We're not deleting modules, questions, tests, assignments, documents
    // created by the user as they might be used by others.
    // If you want to delete those too, add them here.
    // For now, we'll just leave the createdBy field as a reference.

    // Finally, delete the user
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