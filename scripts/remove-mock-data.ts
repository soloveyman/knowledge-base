import { db } from '../lib/db'
import {
  users,
  accounts,
  sessions,
  verificationTokens,
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
  subscriptionPlans,
  subscriptions,
  usage,
} from '../lib/db/schema'
import { eq, like, or } from 'drizzle-orm'

async function removeMockData() {
  try {
    console.log('🗑️  Removing all mock/test data from database...\n')

    // 1. Find all test users (emails containing @test.com)
    const testUsers = await db.select().from(users).where(like(users.email, '%@test.com'))
    const testUserIds = testUsers.map(u => u.id)
    
    console.log(`Found ${testUsers.length} test users:`)
    testUsers.forEach(u => {
      console.log(`  - ${u.email} (${u.role})`)
    })

    if (testUserIds.length === 0) {
      console.log('\n✅ No test users found. Database is clean.')
      return
    }

    // 2. Delete all data associated with test users
    console.log('\n📋 Deleting associated data...')

    // Delete in reverse order of dependencies
    console.log('  - Deleting usage records...')
    await db.delete(usage).where(eq(usage.userId, testUserIds[0] as any))
      .catch(() => {}) // Ignore if table doesn't exist or no data

    console.log('  - Deleting subscriptions...')
    for (const userId of testUserIds) {
      await db.delete(subscriptions).where(eq(subscriptions.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting progress records...')
    for (const userId of testUserIds) {
      await db.delete(progress).where(eq(progress.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting test attempts...')
    for (const userId of testUserIds) {
      await db.delete(testAttempts).where(eq(testAttempts.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting assignment users...')
    for (const userId of testUserIds) {
      await db.delete(assignmentUsers).where(eq(assignmentUsers.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting assignments created by test users...')
    for (const userId of testUserIds) {
      await db.delete(assignments).where(eq(assignments.assignedBy, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting user group members...')
    for (const userId of testUserIds) {
      await db.delete(userGroupMembers).where(eq(userGroupMembers.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting user groups created by test users...')
    for (const userId of testUserIds) {
      await db.delete(userGroups).where(eq(userGroups.createdBy, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting tests created by test users...')
    for (const userId of testUserIds) {
      await db.delete(tests).where(eq(tests.createdBy, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting questions created by test users...')
    for (const userId of testUserIds) {
      await db.delete(questions).where(eq(questions.createdBy, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting document images...')
    // Get documents created by test users first
    const testDocs = await db.select().from(documents).where(eq(documents.uploadedBy, testUserIds[0] as any))
      .catch(() => [])
    for (const doc of testDocs) {
      await db.delete(documentImages).where(eq(documentImages.documentId, doc.id))
        .catch(() => {})
    }

    console.log('  - Deleting documents uploaded by test users...')
    for (const userId of testUserIds) {
      await db.delete(documents).where(eq(documents.uploadedBy, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting sections...')
    // Get modules created by test users
    const testModules = await db.select().from(modules).where(eq(modules.createdBy, testUserIds[0] as any))
      .catch(() => [])
    for (const mod of testModules) {
      await db.delete(sections).where(eq(sections.moduleId, mod.id))
        .catch(() => {})
    }

    console.log('  - Deleting module versions...')
    for (const mod of testModules) {
      await db.delete(moduleVersions).where(eq(moduleVersions.moduleId, mod.id))
        .catch(() => {})
    }

    console.log('  - Deleting modules created by test users...')
    for (const userId of testUserIds) {
      await db.delete(modules).where(eq(modules.createdBy, userId as any))
        .catch(() => {})
    }

    // 3. Delete auth-related data for test users
    console.log('  - Deleting sessions...')
    for (const userId of testUserIds) {
      await db.delete(sessions).where(eq(sessions.userId, userId as any))
        .catch(() => {})
    }

    console.log('  - Deleting accounts...')
    for (const userId of testUserIds) {
      await db.delete(accounts).where(eq(accounts.userId, userId as any))
        .catch(() => {})
    }

    // 4. Delete test users
    console.log('  - Deleting test users...')
    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId))
        .catch(() => {})
    }

    // 5. Also delete any test data with "test" or "mock" in titles
    console.log('\n🧹 Cleaning up test data by name patterns...')
    
    const testPatterns = ['test', 'Test', 'TEST', 'mock', 'Mock', 'MOCK', 'sample', 'Sample', 'SAMPLE']
    
    for (const pattern of testPatterns) {
      // Delete modules with test patterns
      const testModulesByName = await db.select().from(modules)
        .where(like(modules.title, `%${pattern}%`))
        .catch(() => [])
      
      for (const mod of testModulesByName) {
        await db.delete(sections).where(eq(sections.moduleId, mod.id)).catch(() => {})
        await db.delete(moduleVersions).where(eq(moduleVersions.moduleId, mod.id)).catch(() => {})
        await db.delete(modules).where(eq(modules.id, mod.id)).catch(() => {})
      }

      // Delete tests with test patterns
      await db.delete(tests).where(like(tests.title, `%${pattern}%`)).catch(() => {})

      // Delete assignments with test patterns
      await db.delete(assignments).where(like(assignments.title, `%${pattern}%`)).catch(() => {})
    }

    console.log('\n✅ All mock/test data removed successfully!')
    console.log(`   Deleted ${testUserIds.length} test users and all associated data.`)

  } catch (error) {
    console.error('❌ Error removing mock data:', error)
    process.exit(1)
  }
}

removeMockData().then(() => {
  console.log('\n🎉 Cleanup complete!')
  process.exit(0)
}).catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})

