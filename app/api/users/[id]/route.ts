import { NextResponse } from 'next/server'
import { db, users, testAttempts, assignmentUsers, progress, modules, questions, tests, assignments, userGroupMembers } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { updateUserSchema } from '@/lib/schemas/users'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'

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
    return handleApiError(error, 'Failed to get user', 500)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Validate request body
    const validation = await validateRequest(request, updateUserSchema)
    if (!validation.success) {
      return validation.response
    }

    const body = validation.data
    
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
    
    // Prepare update data
    const updateData: {
      name?: string | null
      job?: string | null
      email?: string
      role?: 'super-admin' | 'owner' | 'manager' | 'employee'
      password?: string
      updatedAt: Date
    } = {
      updatedAt: new Date()
    }
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.job !== undefined) updateData.job = body.job
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role

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
    return handleApiError(error, 'Failed to update user', 500)
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

    console.log(`🗑️ Deleting user ${id} and related records`)
    
    // Cascade delete related records - delete in order to avoid foreign key issues
    // Delete user's test attempts
    try {
      await db.delete(testAttempts).where(eq(testAttempts.userId, id))
      console.log('✅ Deleted test attempts')
    } catch (error) {
      console.warn('⚠️ Failed to delete test attempts:', error)
    }
    
    // Delete user's assignment users
    try {
      await db.delete(assignmentUsers).where(eq(assignmentUsers.userId, id))
      console.log('✅ Deleted assignment users')
    } catch (error) {
      console.warn('⚠️ Failed to delete assignment users:', error)
    }
    
    // Delete user's progress
    try {
      await db.delete(progress).where(eq(progress.userId, id))
      console.log('✅ Deleted progress')
    } catch (error) {
      console.warn('⚠️ Failed to delete progress:', error)
    }
    
    // Delete user's group memberships
    try {
      await db.delete(userGroupMembers).where(eq(userGroupMembers.userId, id))
      console.log('✅ Deleted group memberships')
    } catch (error) {
      console.warn('⚠️ Failed to delete group memberships:', error)
    }
    
    // Note: We're not deleting modules, questions, tests, assignments, documents
    // created by the user as they might be used by others.
    // If you want to delete those too, add them here.
    // For now, we'll just leave the createdBy field as a reference.
    
    // Note: Documents uploaded by this user are NOT deleted (they may be used by others)
    // If documents were to be deleted, images would need to be deleted from Spaces first
    // See app/api/documents/[id]/route.ts DELETE handler for proper image cleanup

    // Finally, delete the user
    console.log(`🗑️ Deleting user ${id} from database`)
    try {
      await db.delete(users).where(eq(users.id, id))
      console.log(`✅ User ${id} delete query executed`)
      
      // Verify deletion
      const verifyDeleted = await db.select().from(users).where(eq(users.id, id)).limit(1)
      if (verifyDeleted.length > 0) {
        console.error(`❌ User ${id} still exists after deletion attempt`)
        return NextResponse.json({
          success: false,
          message: 'User deletion failed - user still exists',
          error: 'DELETION_VERIFICATION_FAILED'
        }, { status: 500 })
      }
      
      console.log(`✅ User ${id} deleted successfully and verified`)
    } catch (dbError) {
      console.error(`❌ Database error deleting user ${id}:`, dbError)
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      
      if (dbErrorMessage.includes('foreign key') || dbErrorMessage.includes('constraint') || dbErrorMessage.includes('23503')) {
        return NextResponse.json({
          success: false,
          message: 'Cannot delete user. They are still referenced by other records.',
          error: 'FOREIGN_KEY_CONSTRAINT'
        }, { status: 400 })
      }
      
      throw dbError
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    return handleApiError(error, 'Failed to delete user', 500)
  }
}