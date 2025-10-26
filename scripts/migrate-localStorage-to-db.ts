#!/usr/bin/env tsx

/**
 * Migration script to help users migrate localStorage data to the database
 * This script provides functions to migrate existing localStorage data to the database
 * Run this script in the browser console or as a one-time migration
 */

import { db } from '../lib/db'
import { tests, questions, assignments, users } from '../lib/db/schema'

interface LocalStorageTest {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  questions: Array<{
    id: string
    type: string
    prompt: string
    choices?: string[]
    correct_answer?: string
    explanation?: string
  }>
  sourceDocument: string
  createdAt: string
  createdBy: string
}

interface LocalStorageAssignment {
  id: string
  name: string
  description: string
  document: {
    id: number
    name: string
    type: string
    uploadedAt: string
  }
  test: {
    id: string
    title: string
    questionCount: number
  }
  assignedUsers: Array<{
    id: number
    name: string
    email: string
    role: string
    department: string
  }>
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}

interface LocalStorageUser {
  id: string
  name: string
  job: string
  email: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

export async function migrateLocalStorageToDatabase() {
  console.log('🔄 Starting localStorage to database migration...')
  
  try {
    // Migrate tests
    await migrateTests()
    
    // Migrate assignments
    await migrateAssignments()
    
    // Migrate users
    await migrateUsers()
    
    console.log('✅ Migration completed successfully!')
    console.log('📝 You can now safely clear localStorage data')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

async function migrateTests() {
  console.log('📚 Migrating tests...')
  
  if (typeof window === 'undefined') {
    console.log('⚠️  This script must be run in the browser')
    return
  }
  
  const savedTests = JSON.parse(localStorage.getItem('savedTests') || '[]') as LocalStorageTest[]
  
  for (const test of savedTests) {
    try {
      // Create test record
      const [createdTest] = await db.insert(tests).values({
        title: test.title,
        description: `Migrated from localStorage: ${test.title}`,
        questionIds: test.questions.map(q => q.id),
        passingScore: 70,
        timeLimit: 15,
        maxAttempts: 1,
        shuffleQuestions: false,
        showCorrectAnswers: true,
        status: 'published',
        createdBy: 'migration-user-id' // You'll need to map this to actual user ID
      }).returning()
      
      // Create question records
      for (const question of test.questions) {
        await db.insert(questions).values({
          moduleId: null, // You may need to map this to actual module ID
          title: question.prompt.substring(0, 100), // Truncate for title
          content: question.prompt,
          type: question.type === 'mcq' ? 'multiple_choice' : 'text',
          options: question.choices || [],
          correctAnswer: question.correct_answer,
          explanation: question.explanation,
          difficulty: test.difficulty,
          createdBy: 'migration-user-id' // You'll need to map this to actual user ID
        })
      }
      
      console.log(`✅ Migrated test: ${test.title}`)
    } catch (error) {
      console.error(`❌ Failed to migrate test ${test.title}:`, error)
    }
  }
  
  console.log(`📚 Migrated ${savedTests.length} tests`)
}

async function migrateAssignments() {
  console.log('📋 Migrating assignments...')
  
  if (typeof window === 'undefined') {
    console.log('⚠️  This script must be run in the browser')
    return
  }
  
  const savedAssignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]') as LocalStorageAssignment[]
  
  for (const assignment of savedAssignments) {
    try {
      await db.insert(assignments).values({
        moduleId: assignment.document.id.toString(), // Map to actual module ID
        testId: assignment.test.id,
        assignedTo: assignment.assignedUsers[0]?.id.toString(), // Map to actual user ID
        assignedBy: 'migration-user-id', // You'll need to map this to actual user ID
        dueDate: new Date(assignment.dueDate),
        status: assignment.status === 'active' ? 'pending' : assignment.status,
        allowRetake: false,
        maxAttempts: 1
      })
      
      console.log(`✅ Migrated assignment: ${assignment.name}`)
    } catch (error) {
      console.error(`❌ Failed to migrate assignment ${assignment.name}:`, error)
    }
  }
  
  console.log(`📋 Migrated ${savedAssignments.length} assignments`)
}

async function migrateUsers() {
  console.log('👥 Migrating users...')
  
  if (typeof window === 'undefined') {
    console.log('⚠️  This script must be run in the browser')
    return
  }
  
  const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]') as LocalStorageUser[]
  
  for (const user of savedUsers) {
    try {
      await db.insert(users).values({
        email: user.email,
        name: user.name,
        job: user.job,
        role: user.role as 'owner' | 'manager' | 'employee',
        password: 'migrated-user-password', // You'll need to set proper passwords
        createdAt: new Date(user.createdAt)
      })
      
      console.log(`✅ Migrated user: ${user.name}`)
    } catch (error) {
      console.error(`❌ Failed to migrate user ${user.name}:`, error)
    }
  }
  
  console.log(`👥 Migrated ${savedUsers.length} users`)
}

// Browser console helper functions
if (typeof window !== 'undefined') {
  (window as any).migrateLocalStorage = {
    migrate: migrateLocalStorageToDatabase,
    migrateTests,
    migrateAssignments,
    migrateUsers
  }
  
  console.log('🔧 Migration functions available:')
  console.log('- migrateLocalStorage.migrate() - Migrate all data')
  console.log('- migrateLocalStorage.migrateTests() - Migrate tests only')
  console.log('- migrateLocalStorage.migrateAssignments() - Migrate assignments only')
  console.log('- migrateLocalStorage.migrateUsers() - Migrate users only')
}

export default migrateLocalStorageToDatabase
