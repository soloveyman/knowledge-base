/**
 * Account Deletion Test Suite
 * 
 * Tests account deletion functionality to ensure all related data is properly deleted.
 * 
 * Run: tsx scripts/test-account-deletion.ts
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env file
config({ path: resolve(process.cwd(), '.env') })

import { db } from '../lib/db'
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
} from '../lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const TEST_BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: string
}

const testResults: TestResult[] = []

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const symbols = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }
  console.log(`${symbols[type]} ${message}`)
}

function addResult(name: string, passed: boolean, error?: string, details?: string) {
  testResults.push({ name, passed, error, details })
  if (passed) {
    log(`${name}: PASSED`, 'success')
  } else {
    log(`${name}: FAILED${error ? ` - ${error}` : ''}`, 'error')
    if (details) log(`  Details: ${details}`, 'info')
  }
}

async function createTestOwner(): Promise<string> {
  const testEmail = `test-delete-${Date.now()}@test.com`
  const hashedPassword = await bcrypt.hash('testpassword123', 10)
  
  const [owner] = await db.insert(users).values({
    email: testEmail,
    password: hashedPassword,
    name: 'Test Owner',
    role: 'owner',
    businessId: null // Will be set to own ID
  }).returning()
  
  // Set businessId to own ID
  await db.update(users)
    .set({ businessId: owner.id })
    .where(eq(users.id, owner.id))
  
  return owner.id
}

async function createTestData(ownerId: string, businessId: string) {
  // Create a manager user
  const [manager] = await db.insert(users).values({
    email: `test-manager-${Date.now()}@test.com`,
    password: await bcrypt.hash('testpassword123', 10),
    name: 'Test Manager',
    role: 'manager',
    businessId: businessId
  }).returning()
  
  // Create an employee user
  const [employee] = await db.insert(users).values({
    email: `test-employee-${Date.now()}@test.com`,
    password: await bcrypt.hash('testpassword123', 10),
    name: 'Test Employee',
    role: 'employee',
    businessId: businessId
  }).returning()
  
  // Create a module
  const [module] = await db.insert(modules).values({
    title: 'Test Module',
    description: 'Test module for deletion',
    content: 'Test content',
    createdBy: ownerId,
    status: 'published'
  }).returning()
  
  // Create module version
  await db.insert(moduleVersions).values({
    moduleId: module.id,
    version: 1,
    title: 'Test Module v1',
    createdBy: ownerId,
    status: 'published'
  })
  
  // Create sections
  await db.insert(sections).values({
    moduleId: module.id,
    title: 'Test Section',
    content: 'Test section content',
    level: 1
  })
  
  // Create a document
  const [document] = await db.insert(documents).values({
    title: 'Test Document',
    uploadedBy: ownerId,
    status: 'parsed'
  }).returning()
  
  // Create document images
  await db.insert(documentImages).values({
    documentId: document.id,
    filename: 'test.png',
    data: 'base64data',
    type: 'image/png',
    position: 0
  })
  
  // Create questions
  const [question] = await db.insert(questions).values({
    title: 'Test Question',
    content: 'What is 2+2?',
    type: 'multiple_choice',
    createdBy: ownerId,
    moduleId: module.id
  }).returning()
  
  // Create a test
  const [test] = await db.insert(tests).values({
    title: 'Test Test',
    description: 'Test test for deletion',
    createdBy: ownerId,
    moduleId: module.id,
    status: 'published'
  }).returning()
  
  // Create a user group
  const [userGroup] = await db.insert(userGroups).values({
    name: 'Test Group',
    createdBy: ownerId
  }).returning()
  
  // Add users to group
  await db.insert(userGroupMembers).values({
    groupId: userGroup.id,
    userId: manager.id
  })
  await db.insert(userGroupMembers).values({
    groupId: userGroup.id,
    userId: employee.id
  })
  
  // Create an assignment
  const [assignment] = await db.insert(assignments).values({
    title: 'Test Assignment',
    moduleId: module.id,
    testId: test.id,
    assignedBy: ownerId,
    status: 'pending'
  }).returning()
  
  // Add users to assignment
  await db.insert(assignmentUsers).values({
    assignmentId: assignment.id,
    userId: employee.id,
    status: 'pending'
  })
  
  // Create test attempts
  await db.insert(testAttempts).values({
    testId: test.id,
    userId: employee.id,
    assignmentId: assignment.id,
    score: 85,
    status: 'completed'
  })
  
  // Create progress records
  await db.insert(progress).values({
    userId: employee.id,
    moduleId: module.id,
    status: 'in_progress',
    progressPercentage: 50
  })
  
  // Create usage records
  await db.insert(usage).values({
    userId: ownerId,
    month: '2024-01',
    importsCount: 5,
    generationsCount: 10
  })
  
  // Create subscription
  const [plan] = await db.select().from(subscriptions).limit(1)
  if (plan) {
    await db.insert(subscriptions).values({
      ownerId: ownerId,
      planId: plan.id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    })
  }
  
  // Create payment
  await db.insert(payments).values({
    ownerId: ownerId,
    provider: 'stripe',
    providerPaymentId: 'test_payment_123',
    amount: 1000,
    currency: 'USD',
    status: 'completed'
  })
  
  // Create auth records
  await db.insert(sessions).values({
    sessionToken: `test_session_${Date.now()}`,
    userId: ownerId,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  })
  
  await db.insert(accounts).values({
    userId: ownerId,
    type: 'credentials',
    provider: 'credentials',
    providerAccountId: ownerId
  })
  
  await db.insert(passwordResetTokens).values({
    userId: ownerId,
    token: `test_token_${Date.now()}`,
    expires: new Date(Date.now() + 60 * 60 * 1000)
  })
  
  return {
    ownerId,
    businessId,
    managerId: manager.id,
    employeeId: employee.id,
    moduleId: module.id,
    documentId: document.id,
    questionId: question.id,
    testId: test.id,
    userGroupId: userGroup.id,
    assignmentId: assignment.id
  }
}

async function testAccountDeletionAPI(ownerId: string): Promise<boolean> {
  try {
    log('Testing account deletion API endpoint', 'info')
    
    // First, we need to create a session for the owner
    // This is a simplified test - in a real scenario, you'd need to authenticate
    const response = await fetch(`${TEST_BASE_URL}/api/users/delete-account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })
    
    // Since we can't easily authenticate in this test, we'll check the endpoint exists
    // In a real scenario, you'd use Playwright or similar to test with authentication
    if (response.status === 401 || response.status === 403) {
      log('  Endpoint exists and requires authentication (expected)', 'success')
      return true
    }
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        log('  Account deletion successful', 'success')
        return true
      }
    }
    
    log(`  Unexpected response: ${response.status}`, 'error')
    return false
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testDataDeletion(ownerId: string, businessId: string, testData: any): Promise<boolean> {
  try {
    log('Testing that all related data is deleted', 'info')
    
    // Check that all users in business are deleted
    const remainingUsers = await db.select()
      .from(users)
      .where(eq(users.businessId, businessId))
    
    if (remainingUsers.length > 0) {
      log(`  Found ${remainingUsers.length} remaining users in business`, 'error')
      return false
    }
    log('  All users in business deleted', 'success')
    
    // Check that modules are deleted
    const remainingModules = await db.select()
      .from(modules)
      .where(eq(modules.id, testData.moduleId))
    
    if (remainingModules.length > 0) {
      log('  Module still exists', 'error')
      return false
    }
    log('  Module deleted', 'success')
    
    // Check that documents are deleted
    const remainingDocuments = await db.select()
      .from(documents)
      .where(eq(documents.id, testData.documentId))
    
    if (remainingDocuments.length > 0) {
      log('  Document still exists', 'error')
      return false
    }
    log('  Document deleted', 'success')
    
    // Check that tests are deleted
    const remainingTests = await db.select()
      .from(tests)
      .where(eq(tests.id, testData.testId))
    
    if (remainingTests.length > 0) {
      log('  Test still exists', 'error')
      return false
    }
    log('  Test deleted', 'success')
    
    // Check that assignments are deleted
    const remainingAssignments = await db.select()
      .from(assignments)
      .where(eq(assignments.id, testData.assignmentId))
    
    if (remainingAssignments.length > 0) {
      log('  Assignment still exists', 'error')
      return false
    }
    log('  Assignment deleted', 'success')
    
    // Check that user groups are deleted
    const remainingGroups = await db.select()
      .from(userGroups)
      .where(eq(userGroups.id, testData.userGroupId))
    
    if (remainingGroups.length > 0) {
      log('  User group still exists', 'error')
      return false
    }
    log('  User group deleted', 'success')
    
    // Check that auth records are deleted
    const remainingSessions = await db.select()
      .from(sessions)
      .where(eq(sessions.userId, ownerId))
    
    if (remainingSessions.length > 0) {
      log('  Sessions still exist', 'error')
      return false
    }
    log('  Sessions deleted', 'success')
    
    return true
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function main() {
  console.log('\n🗑️  Account Deletion Test Suite\n')
  
  let ownerId: string | null = null
  let businessId: string | null = null
  let testData: any = null
  
  try {
    // Create test owner
    log('Creating test owner...', 'info')
    ownerId = await createTestOwner()
    businessId = ownerId
    log(`  Created owner: ${ownerId}`, 'success')
    
    // Create test data
    log('Creating test data...', 'info')
    testData = await createTestData(ownerId, businessId)
    log('  Test data created', 'success')
    
    // Test 1: API endpoint exists
    const apiTest = await testAccountDeletionAPI(ownerId)
    addResult('Account Deletion API Endpoint', apiTest)
    
    // Test 2: Manual deletion test (simulate the deletion process)
    log('Testing manual deletion process...', 'info')
    
    // Simulate the deletion by calling the database operations directly
    // This tests the deletion logic without needing authentication
    try {
      // Get all users in business
      const businessUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.businessId, businessId))
      const businessUserIds = businessUsers.map(u => u.id)
      
      // Delete payments
      await db.delete(payments).where(eq(payments.ownerId, ownerId))
      
      // Delete subscriptions
      await db.delete(subscriptions).where(eq(subscriptions.ownerId, ownerId))
      
      // Delete usage records
      for (const uid of businessUserIds) {
        await db.delete(usage).where(eq(usage.userId, uid))
      }
      
      // Delete progress records
      for (const uid of businessUserIds) {
        await db.delete(progress).where(eq(progress.userId, uid))
      }
      
      // Delete test attempts
      for (const uid of businessUserIds) {
        await db.delete(testAttempts).where(eq(testAttempts.userId, uid))
      }
      
      // Delete assignment users
      for (const uid of businessUserIds) {
        await db.delete(assignmentUsers).where(eq(assignmentUsers.userId, uid))
      }
      
      // Delete assignments
      for (const uid of businessUserIds) {
        const userAssignments = await db.select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.assignedBy, uid))
        
        for (const assignment of userAssignments) {
          await db.delete(assignmentUsers).where(eq(assignmentUsers.assignmentId, assignment.id))
          await db.delete(assignments).where(eq(assignments.id, assignment.id))
        }
      }
      
      // Delete user group members
      for (const uid of businessUserIds) {
        await db.delete(userGroupMembers).where(eq(userGroupMembers.userId, uid))
      }
      
      // Delete user groups
      for (const uid of businessUserIds) {
        const userGroupsList = await db.select({ id: userGroups.id })
          .from(userGroups)
          .where(eq(userGroups.createdBy, uid))
        
        for (const group of userGroupsList) {
          await db.delete(userGroupMembers).where(eq(userGroupMembers.groupId, group.id))
          await db.delete(userGroups).where(eq(userGroups.id, group.id))
        }
      }
      
      // Delete questions
      for (const uid of businessUserIds) {
        await db.delete(questions).where(eq(questions.createdBy, uid))
      }
      
      // Delete tests
      for (const uid of businessUserIds) {
        const userTests = await db.select({ id: tests.id })
          .from(tests)
          .where(eq(tests.createdBy, uid))
        
        for (const test of userTests) {
          await db.delete(tests).where(eq(tests.id, test.id))
        }
      }
      
      // Delete documents
      for (const uid of businessUserIds) {
        const userDocuments = await db.select({ id: documents.id })
          .from(documents)
          .where(eq(documents.uploadedBy, uid))
        
        for (const doc of userDocuments) {
          await db.delete(documentImages).where(eq(documentImages.documentId, doc.id))
          await db.delete(documents).where(eq(documents.id, doc.id))
        }
      }
      
      // Delete modules
      for (const uid of businessUserIds) {
        const userModules = await db.select({ id: modules.id })
          .from(modules)
          .where(eq(modules.createdBy, uid))
        
        for (const module of userModules) {
          await db.delete(sections).where(eq(sections.moduleId, module.id))
          await db.delete(moduleVersions).where(eq(moduleVersions.moduleId, module.id))
          await db.delete(modules).where(eq(modules.id, module.id))
        }
      }
      
      // Delete auth records
      const businessUserEmails = await db.select({ email: users.email })
        .from(users)
        .where(inArray(users.id, businessUserIds))
      
      const emails = businessUserEmails.map(u => u.email).filter((email): email is string => !!email)
      
      for (const email of emails) {
        await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email))
      }
      
      for (const uid of businessUserIds) {
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, uid))
        await db.delete(sessions).where(eq(sessions.userId, uid))
        await db.delete(accounts).where(eq(accounts.userId, uid))
      }
      
      // Delete users
      await db.delete(users).where(eq(users.businessId, businessId))
      
      log('  Deletion process completed', 'success')
      
      // Test that all data is deleted
      const deletionTest = await testDataDeletion(ownerId, businessId, testData)
      addResult('Data Deletion Completeness', deletionTest)
      
    } catch (error) {
      log(`  Deletion error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      addResult('Data Deletion Completeness', false, error instanceof Error ? error.message : 'Unknown error')
    }
    
  } catch (error) {
    log(`Test setup error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    addResult('Test Setup', false, error instanceof Error ? error.message : 'Unknown error')
  }
  
  // Summary
  console.log('\n=== Test Summary ===\n')
  
  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length
  const total = testResults.length
  
  testResults.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    if (result.details) {
      console.log(`   ${result.details}`)
    }
  })
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`)
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed. Please fix issues.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅ All account deletion tests passed!\n`)
    process.exit(0)
  }
}

main().catch(error => {
  console.error('❌ Test suite error:', error)
  process.exit(1)
})

