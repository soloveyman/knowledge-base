import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  users,
  accounts,
  sessions,
  passwordResetTokens,
  usage,
  payments,
  subscriptions,
  progress,
  testAttempts,
  assignmentUsers,
  assignments,
  userGroupMembers,
  userGroups,
  tests,
  questions,
  documents,
  sections,
  moduleVersions,
  modules,
} from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'

export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 })
    }

    // Only owners can delete their account
    if (session.user.role !== 'owner') {
      return NextResponse.json({
        success: false,
        message: 'Only owners can delete their account'
      }, { status: 403 })
    }

    const ownerId = session.user.id
    const businessId = session.user.businessId || ownerId

    // Get all users with the same businessId
    const allBusinessUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.businessId, businessId))
    
    const userIds = allBusinessUsers.map(u => u.id)

    if (userIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No users found for this business'
      }, { status: 404 })
    }

    console.log(`[Delete Account] Starting cascade delete for owner ${ownerId} and ${userIds.length} users`)

    // Delete in reverse order of dependencies to avoid foreign key constraints
    // Following the pattern from clear-database.ts

    // 1. Delete usage records
    await db.delete(usage).where(inArray(usage.userId, userIds))
    console.log('[Delete Account] Deleted usage records')

    // 2. Delete payments
    await db.delete(payments).where(inArray(payments.ownerId, userIds))
    console.log('[Delete Account] Deleted payments')

    // 3. Delete subscriptions
    await db.delete(subscriptions).where(inArray(subscriptions.ownerId, userIds))
    console.log('[Delete Account] Deleted subscriptions')

    // 4. Delete progress records
    await db.delete(progress).where(inArray(progress.userId, userIds))
    console.log('[Delete Account] Deleted progress records')

    // 5. Delete test attempts
    await db.delete(testAttempts).where(inArray(testAttempts.userId, userIds))
    console.log('[Delete Account] Deleted test attempts')

    // 6. Delete assignment users
    await db.delete(assignmentUsers).where(inArray(assignmentUsers.userId, userIds))
    console.log('[Delete Account] Deleted assignment users')

    // 7. Get assignments created by business users to delete them
    const businessAssignments = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(inArray(assignments.assignedBy, userIds))
    const assignmentIds = businessAssignments.map(a => a.id)

    if (assignmentIds.length > 0) {
      // Delete assignment users for these assignments
      await db.delete(assignmentUsers).where(inArray(assignmentUsers.assignmentId, assignmentIds))
      // Delete progress for these assignments
      await db.delete(progress).where(inArray(progress.assignmentId, assignmentIds))
      // Delete test attempts for these assignments
      await db.delete(testAttempts).where(inArray(testAttempts.assignmentId, assignmentIds))
      // Delete assignments
      await db.delete(assignments).where(inArray(assignments.id, assignmentIds))
      console.log('[Delete Account] Deleted assignments')
    }

    // 8. Delete user group members
    await db.delete(userGroupMembers).where(inArray(userGroupMembers.userId, userIds))
    console.log('[Delete Account] Deleted user group members')

    // 9. Get user groups created by business users
    const businessUserGroups = await db
      .select({ id: userGroups.id })
      .from(userGroups)
      .where(inArray(userGroups.createdBy, userIds))
    const groupIds = businessUserGroups.map(g => g.id)

    if (groupIds.length > 0) {
      // Delete user group members for these groups
      await db.delete(userGroupMembers).where(inArray(userGroupMembers.groupId, groupIds))
      // Delete user groups
      await db.delete(userGroups).where(inArray(userGroups.id, groupIds))
      console.log('[Delete Account] Deleted user groups')
    }

    // 10. Get tests created by business users
    const businessTests = await db
      .select({ id: tests.id })
      .from(tests)
      .where(inArray(tests.createdBy, userIds))
    const testIds = businessTests.map(t => t.id)

    if (testIds.length > 0) {
      // Delete test attempts for these tests
      await db.delete(testAttempts).where(inArray(testAttempts.testId, testIds))
      // Delete progress for these tests
      await db.delete(progress).where(inArray(progress.testId, testIds))
      // Delete tests
      await db.delete(tests).where(inArray(tests.id, testIds))
      console.log('[Delete Account] Deleted tests')
    }

    // 11. Get questions created by business users
    const businessQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(inArray(questions.createdBy, userIds))
    
    if (businessQuestions.length > 0) {
      const questionIds = businessQuestions.map(q => q.id)
      await db.delete(questions).where(inArray(questions.id, questionIds))
      console.log('[Delete Account] Deleted questions')
    }

    // 12. Get documents uploaded by business users
    const businessDocuments = await db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.uploadedBy, userIds))
    
    if (businessDocuments.length > 0) {
      const documentIds = businessDocuments.map(d => d.id)
      await db.delete(documents).where(inArray(documents.id, documentIds))
      console.log('[Delete Account] Deleted documents')
    }

    // 13. Get modules created by business users
    const businessModules = await db
      .select({ id: modules.id })
      .from(modules)
      .where(inArray(modules.createdBy, userIds))
    const moduleIds = businessModules.map(m => m.id)

    if (moduleIds.length > 0) {
      // Delete sections for these modules
      await db.delete(sections).where(inArray(sections.moduleId, moduleIds))
      // Delete module versions for these modules
      await db.delete(moduleVersions).where(inArray(moduleVersions.moduleId, moduleIds))
      // Delete progress for these modules
      await db.delete(progress).where(inArray(progress.moduleId, moduleIds))
      // Delete modules
      await db.delete(modules).where(inArray(modules.id, moduleIds))
      console.log('[Delete Account] Deleted modules')
    }

    // 14. Delete password reset tokens
    await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, userIds))
    console.log('[Delete Account] Deleted password reset tokens')

    // 15. Delete sessions
    await db.delete(sessions).where(inArray(sessions.userId, userIds))
    console.log('[Delete Account] Deleted sessions')

    // 16. Delete accounts (OAuth accounts)
    await db.delete(accounts).where(inArray(accounts.userId, userIds))
    console.log('[Delete Account] Deleted accounts')

    // 17. Finally, delete all users with the same businessId
    await db.delete(users).where(inArray(users.id, userIds))
    console.log('[Delete Account] Deleted users')

    console.log(`[Delete Account] Successfully deleted account and all related data for owner ${ownerId}`)

    return NextResponse.json({
      success: true,
      message: 'Account and all related data deleted successfully'
    })
  } catch (error) {
    console.error('[Delete Account] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to delete account',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

