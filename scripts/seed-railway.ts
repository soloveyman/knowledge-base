import { db } from '../lib/db'
import {
  users,
  modules,
  documents as docsTable,
  tests as testsTable,
  assignments as assignmentsTable,
  assignmentUsers as assignmentUsersTable,
} from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🔰 Seeding Railway database with minimal demo data...')

  // 1) Ensure users
  const userRecords: Array<{ email: string; name: string; role: 'owner' | 'manager' | 'employee'; password: string }>= [
    { email: 'owner@test.com', name: 'Owner User', role: 'owner', password: 'owner123' },
    { email: 'manager@test.com', name: 'Manager User', role: 'manager', password: 'manager123' },
    { email: 'employee@test.com', name: 'Employee User', role: 'employee', password: 'employee123' },
  ]

  const userIds: Record<string, string> = {}
  for (const u of userRecords) {
    const existing = await db.select().from(users).where(eq(users.email, u.email))
    if (existing.length > 0) {
      userIds[u.role] = existing[0].id
      continue
    }
    const hashed = await bcrypt.hash(u.password, 12)
    const [created] = await db.insert(users).values({
      email: u.email,
      name: u.name,
      role: u.role,
      password: hashed,
      country: 'US',
    }).returning()
    userIds[u.role] = created.id
    console.log(`✅ User created: ${u.email} (${u.role})`)
  }

  // 2) Create or get a simple module owned by manager
  let moduleRow: any
  let moduleId: string
  try {
    // First try to get existing module
    const existing = await db.select().from(modules).where(eq(modules.title, 'Safety Guidelines')).limit(1)
    if (existing.length > 0) {
      moduleRow = existing[0]
      moduleId = moduleRow.id
      console.log('✅ Using existing module: Safety Guidelines')
    } else {
      // Create new module
      const result = await db.insert(modules).values({
        title: 'Safety Guidelines',
        description: 'Basic safety procedures',
        content: '# Safety\nAlways be careful.',
        createdBy: userIds['manager'],
        status: 'published',
      }).returning()
      moduleRow = result[0]
      moduleId = moduleRow.id
      console.log('✅ Created module: Safety Guidelines')
    }
  } catch (error: any) {
    console.error('❌ Failed to create/get module:', error.message)
    throw error
  }

  // 3) Create a document linked to module
  const [docRow] = await db.insert(docsTable).values({
    moduleId,
    title: 'Safety Guidelines.pdf',
    originalFileName: 'Safety Guidelines.pdf',
    fileType: 'pdf',
    fileUrl: '',
    uploadedBy: userIds['manager'],
    status: 'uploaded',
  }).returning().catch(async () => {
    const existing = await db.select().from(docsTable).where(eq(docsTable.title, 'Safety Guidelines.pdf'))
    return existing as any
  })

  // 4) Create a test linked to module (or update existing to link to this module)
  let testRow: any
  try {
    // First check if test exists for this module
    const existingForModule = await db.select().from(testsTable).where(eq(testsTable.moduleId, moduleId)).limit(1)
    if (existingForModule.length > 0) {
      testRow = existingForModule[0]
      console.log('✅ Test already exists for module: Safety Test')
    } else {
      // Check if test exists but is linked to different module
      const existing = await db.select().from(testsTable).where(eq(testsTable.title, 'Safety Test')).limit(1)
      if (existing.length > 0) {
        // Update to link to this module
        await db.update(testsTable).set({ moduleId }).where(eq(testsTable.id, existing[0].id))
        testRow = { ...existing[0], moduleId }
        console.log('✅ Updated test to link to module: Safety Test')
      } else {
        // Create new test
        const result = await db.insert(testsTable).values({
          moduleId,
          title: 'Safety Test',
          description: 'Quick safety check',
          questionIds: [],
          passingScore: 70,
          status: 'published',
          createdBy: userIds['manager'],
        }).returning()
        testRow = result[0]
        console.log('✅ Test created: Safety Test')
      }
    }
  } catch (error: any) {
    console.error('❌ Failed to create/update test:', error.message)
    throw error
  }

  const testId = testRow.id

  // 5) Create an assignment for employee
  const [assignmentRow] = await db.insert(assignmentsTable).values({
    title: 'Read safety guide and pass test',
    description: 'Read the safety document and pass the test',
    moduleId,
    testId,
    assignedBy: userIds['manager'],
    status: 'pending',
  }).returning()

  const assignmentId = assignmentRow.id

  // 6) Link employee to assignment
  await db.insert(assignmentUsersTable).values({
    assignmentId,
    userId: userIds['employee'],
    status: 'pending',
  }).catch(() => {})

  console.log('✅ Seed complete.')
  console.log('Users:')
  console.log('- superadmin@test.com / admin123')
  console.log('- owner@test.com / owner123')
  console.log('- manager@test.com / manager123')
  console.log('- employee@test.com / employee123')
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })


