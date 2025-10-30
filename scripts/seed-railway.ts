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

  // 2) Create a simple module owned by manager
  const [moduleRow] = await db.insert(modules).values({
    title: 'Safety Guidelines',
    description: 'Basic safety procedures',
    content: '# Safety\nAlways be careful.',
    createdBy: userIds['manager'],
    status: 'published',
  }).returning().catch(async () => {
    // If constraint issue, pick any existing module created by manager
    const existing = await db.select().from(modules).where(eq(modules.title, 'Safety Guidelines'))
    return existing as any
  })

  const moduleId = Array.isArray(moduleRow) ? moduleRow[0].id : moduleRow.id

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

  // 4) Create a test linked to module
  const [testRow] = await db.insert(testsTable).values({
    moduleId,
    title: 'Safety Test',
    description: 'Quick safety check',
    questionIds: [],
    passingScore: 70,
    status: 'published',
    createdBy: userIds['manager'],
  }).returning().catch(async () => {
    const existing = await db.select().from(testsTable).where(eq(testsTable.title, 'Safety Test'))
    return existing as any
  })

  const testId = Array.isArray(testRow) ? testRow[0].id : testRow.id

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


