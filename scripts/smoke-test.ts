import { db } from '../lib/db'
import {
  users,
  modules,
  documents,
  tests,
  assignments,
  assignmentUsers,
  testAttempts,
} from '../lib/db/schema'
import { eq, and } from 'drizzle-orm'

async function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ ${message}`)
  }
  console.log(`✅ ${message}`)
}

async function main() {
  console.log('🔎 Running DB smoke test...')

  // 1) Users
  const dbUsers = await db.select().from(users)
  await expect(dbUsers.length >= 3, 'At least 3 users exist')

  const manager = dbUsers.find((u) => u.role === 'manager')
  const employee = dbUsers.find((u) => u.role === 'employee')
  await expect(!!manager, 'Manager user exists')
  await expect(!!employee, 'Employee user exists')

  // 2) Module
  const dbModules = await db.select().from(modules)
  const moduleRow = dbModules[0]
  await expect(!!moduleRow, 'At least one module exists')

  // 3) Document for module
  const moduleDocs = await db.select().from(documents).where(eq(documents.moduleId, moduleRow.id))
  await expect(moduleDocs.length >= 1, 'Document exists for module')

  // 4) Test for module
  const moduleTests = await db.select().from(tests).where(eq(tests.moduleId, moduleRow.id))
  const testRow = moduleTests[0]
  await expect(!!testRow, 'Test exists for module')

  // 5) Create or reuse assignment
  let [assignmentRow] = await db
    .insert(assignments)
    .values({
      title: 'Smoke: Read and Test',
      description: 'Auto-created by smoke test',
      moduleId: moduleRow.id,
      testId: testRow.id,
      assignedBy: manager!.id,
      status: 'pending',
    })
    .returning()
    .catch(async () => {
      const existing = await db
        .select()
        .from(assignments)
        .where(and(eq(assignments.moduleId, moduleRow.id), eq(assignments.testId, testRow.id)))
      return existing as any
    })

  const assignmentId = assignmentRow.id
  await expect(!!assignmentId, 'Assignment is available')

  // 6) Link employee to assignment (idempotent)
  await db
    .insert(assignmentUsers)
    .values({ assignmentId, userId: employee!.id, status: 'in_progress' })
    .catch(() => {})

  const auRows = await db
    .select()
    .from(assignmentUsers)
    .where(and(eq(assignmentUsers.assignmentId, assignmentId), eq(assignmentUsers.userId, employee!.id)))
  await expect(auRows.length >= 1, 'Employee linked to assignment')

  // 7) Simulate a test attempt
  const [attempt] = await db
    .insert(testAttempts)
    .values({
      testId: testRow.id,
      userId: employee!.id,
      assignmentId,
      answers: {},
      score: 85,
      status: 'completed',
    })
    .returning()
  await expect(!!attempt.id, 'Test attempt recorded')

  console.log('\n🎉 Smoke test passed')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
