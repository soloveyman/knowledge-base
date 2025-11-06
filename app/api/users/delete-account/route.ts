import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordResetTokens,
  modules,
  moduleVersions,
  sections,
  documents,
  documentImages,
  questions,
  tests,
  userGroups,
  userGroupMembers,
  assignments,
  assignmentUsers,
  testAttempts,
  progress,
  subscriptions,
  payments,
  usage
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export async function DELETE() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const businessId = session.user.businessId || userId
    const userRole = session.user.role

    // Only owners can delete their account
    if (userRole !== 'owner') {
      return NextResponse.json(
        { success: false, message: 'Only owners can delete their account' },
        { status: 403 }
      )
    }

    console.log(`[Delete Account] Starting deletion for owner ${userId} (businessId: ${businessId})`)

    // Delete in reverse order of dependencies to avoid foreign key constraints
    
    // 1. Delete payments for this business
    console.log('[Delete Account] Deleting payments...')
    await db.delete(payments).where(eq(payments.ownerId, userId))

    // 2. Delete subscriptions for this business
    console.log('[Delete Account] Deleting subscriptions...')
    await db.delete(subscriptions).where(eq(subscriptions.ownerId, userId))

    // 3. Delete usage records for all users in this business
    console.log('[Delete Account] Deleting usage records...')
    const businessUsers = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.businessId, businessId))
    const businessUserIds = businessUsers.map(u => u.id)
    
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(usage).where(eq(usage.userId, uid))
      }
    }

    // 4. Delete progress records for all users in this business
    console.log('[Delete Account] Deleting progress records...')
    
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(progress).where(eq(progress.userId, uid))
      }
    }

    // 5. Delete test attempts for all users in this business
    console.log('[Delete Account] Deleting test attempts...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(testAttempts).where(eq(testAttempts.userId, uid))
      }
    }

    // 6. Delete assignment users for all users in this business
    console.log('[Delete Account] Deleting assignment users...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(assignmentUsers).where(eq(assignmentUsers.userId, uid))
      }
    }

    // 7. Delete assignments created by users in this business
    console.log('[Delete Account] Deleting assignments...')
    if (businessUserIds.length > 0) {
      // Get assignments for all users in business
      for (const uid of businessUserIds) {
        const userAssignments = await db.select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.assignedBy, uid))
        
        for (const assignment of userAssignments) {
          // Delete assignment users first
          await db.delete(assignmentUsers).where(eq(assignmentUsers.assignmentId, assignment.id))
          // Then delete assignment
          await db.delete(assignments).where(eq(assignments.id, assignment.id))
        }
      }
    }

    // 8. Delete user group members for all users in this business
    console.log('[Delete Account] Deleting user group members...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(userGroupMembers).where(eq(userGroupMembers.userId, uid))
      }
    }

    // 9. Delete user groups created by users in this business
    console.log('[Delete Account] Deleting user groups...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        const userGroupsList = await db.select({ id: userGroups.id })
          .from(userGroups)
          .where(eq(userGroups.createdBy, uid))
        
        for (const group of userGroupsList) {
          await db.delete(userGroupMembers).where(eq(userGroupMembers.groupId, group.id))
          await db.delete(userGroups).where(eq(userGroups.id, group.id))
        }
      }
    }

    // 10. Delete questions created by users in this business (including those not in tests)
    console.log('[Delete Account] Deleting questions...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        await db.delete(questions).where(eq(questions.createdBy, uid))
      }
    }

    // 11. Delete tests created by users in this business
    console.log('[Delete Account] Deleting tests...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        const userTests = await db.select({ id: tests.id })
          .from(tests)
          .where(eq(tests.createdBy, uid))
        
        for (const test of userTests) {
          await db.delete(tests).where(eq(tests.id, test.id))
        }
      }
    }

    // 12. Delete documents uploaded by users in this business
    console.log('[Delete Account] Deleting documents...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        const userDocuments = await db.select({ id: documents.id })
          .from(documents)
          .where(eq(documents.uploadedBy, uid))
        
        for (const doc of userDocuments) {
          // Delete document images first
          await db.delete(documentImages).where(eq(documentImages.documentId, doc.id))
          // Then delete document
          await db.delete(documents).where(eq(documents.id, doc.id))
        }
      }
    }

    // 13. Delete modules created by users in this business
    console.log('[Delete Account] Deleting modules...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        const userModules = await db.select({ id: modules.id })
          .from(modules)
          .where(eq(modules.createdBy, uid))
        
        for (const module of userModules) {
          // Delete sections for this module first
          await db.delete(sections).where(eq(sections.moduleId, module.id))
          // Delete module versions
          await db.delete(moduleVersions).where(eq(moduleVersions.moduleId, module.id))
          // Then delete module
          await db.delete(modules).where(eq(modules.id, module.id))
        }
      }
    }

    // 14. Delete auth-related records for all users in this business
    console.log('[Delete Account] Deleting auth records...')
    if (businessUserIds.length > 0) {
      for (const uid of businessUserIds) {
        // Delete password reset tokens
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, uid))
        // Delete sessions
        await db.delete(sessions).where(eq(sessions.userId, uid))
        // Delete accounts
        await db.delete(accounts).where(eq(accounts.userId, uid))
        // Delete verification tokens (by email/identifier)
        const user = await db.select({ email: users.email }).from(users).where(eq(users.id, uid)).limit(1)
        if (user.length > 0) {
          await db.delete(verificationTokens).where(eq(verificationTokens.identifier, user[0].email || ''))
        }
      }
    }

    // 15. Delete all users in this business (including the owner)
    console.log('[Delete Account] Deleting users...')
    await db.delete(users).where(eq(users.businessId, businessId))

    console.log(`[Delete Account] Successfully deleted account ${userId} and all related data`)

    return NextResponse.json({
      success: true,
      message: 'Account and all related data deleted successfully'
    })
  } catch (error) {
    console.error('[Delete Account] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete account',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

