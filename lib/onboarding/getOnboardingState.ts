import { db, users, documents, tests, assignments, onboardingProgress } from '@/lib/db'
import type { UserRole } from '@/lib/auth'
import { and, eq, sql } from 'drizzle-orm'

export type OnboardingStep = 1 | 2 | 3 | 4

export type OnboardingState = {
  shouldShow: boolean
  currentStep: OnboardingStep
  done: { 1: boolean; 2: boolean; 3: boolean; 4: boolean }
  counts?: {
    members: number
    documents: number
    tests: number
    assignments: number
  }
}

const ALLOWED_ROLES: UserRole[] = ['owner', 'manager', 'super-admin']

export async function ensureOnboardingRow(businessId: string, userId: string) {
  console.log('[ensureOnboardingRow] Checking for existing row:', { businessId, userId })
  
  const existing = await db
    .select()
    .from(onboardingProgress)
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    console.log('[ensureOnboardingRow] Found existing row:', { 
      id: existing[0].id, 
      dismissedAt: existing[0].dismissedAt, 
      completedAt: existing[0].completedAt 
    })
    return existing[0]
  }

  console.log('[ensureOnboardingRow] No existing row, creating new one')
  try {
    const [created] = await db
      .insert(onboardingProgress)
      .values({ businessId, userId })
      .returning()

    if (created) {
      console.log('[ensureOnboardingRow] Created new row:', { id: created.id })
      return created
    }
  } catch (error) {
    // If insert fails (e.g., due to race condition or constraint), try to fetch existing row
    console.warn('[ensureOnboardingRow] Insert failed, checking for existing row:', error)
    const [row] = await db
      .select()
      .from(onboardingProgress)
      .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))
      .limit(1)

    if (row) {
      console.log('[ensureOnboardingRow] Found existing row after failed insert:', { id: row.id })
      return row
    }
    
    // If still no row, re-throw the error
    throw error
  }

  // This should not be reached, but just in case
  console.warn('[ensureOnboardingRow] Insert returned nothing, fetching row')
  const [row] = await db
    .select()
    .from(onboardingProgress)
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))
    .limit(1)

  if (row) {
    console.log('[ensureOnboardingRow] Fetched row after insert:', { id: row.id })
  } else {
    console.warn('[ensureOnboardingRow] No row found after insert attempt!')
  }

  return row || undefined
}

export async function getOnboardingState(input: {
  businessId: string
  userId: string
  role: UserRole
}): Promise<OnboardingState> {
  const { businessId, userId, role } = input

  console.log('[getOnboardingState] Input:', { businessId, userId, role })

  if (!ALLOWED_ROLES.includes(role)) {
    console.log('[getOnboardingState] Role not allowed:', role)
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  const row = await ensureOnboardingRow(businessId, userId)
  console.log('[getOnboardingState] Onboarding row:', { 
    exists: !!row, 
    completedAt: row?.completedAt, 
    dismissedAt: row?.dismissedAt 
  })

  if (!row) {
    console.log('[getOnboardingState] No onboarding row found, returning shouldShow: false')
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  if (row.completedAt) {
    console.log('[getOnboardingState] Onboarding already completed')
    return {
      shouldShow: false,
      currentStep: 4,
      done: { 1: true, 2: true, 3: true, 4: true },
    }
  }

  if (row.dismissedAt) {
    console.log('[getOnboardingState] Onboarding was dismissed')
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  // For managers, count only employees (they shouldn't add other managers for onboarding)
  // For owners, count both managers and employees
  const roleFilter = role === 'manager' 
    ? sql`${users.role} = 'employee'`
    : sql`${users.role} IN ('manager', 'employee')`
  
  const membersResult = await db
    .select({ members: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.businessId, businessId),
        sql`${users.id} != ${userId}`,
        roleFilter,
      ),
    )
  const members = membersResult[0]?.members ?? 0

  const documentsResult = await db
    .select({ documents: sql<number>`count(distinct ${documents.id})` })
    .from(documents)
    .innerJoin(users, eq(documents.uploadedBy, users.id))
    .where(eq(users.businessId, businessId))
  const documentsCount = documentsResult[0]?.documents ?? 0

  const testsResult = await db
    .select({ tests: sql<number>`count(distinct ${tests.id})` })
    .from(tests)
    .innerJoin(users, eq(tests.createdBy, users.id))
    .where(eq(users.businessId, businessId))
  const testsCount = testsResult[0]?.tests ?? 0

  const assignmentsResult = await db
    .select({ assignments: sql<number>`count(distinct ${assignments.id})` })
    .from(assignments)
    .innerJoin(users, eq(assignments.assignedBy, users.id))
    .where(eq(users.businessId, businessId))
  const assignmentsCount = assignmentsResult[0]?.assignments ?? 0

  const done: OnboardingState['done'] = {
    1: members >= 1,
    2: documentsCount > 0,
    3: testsCount > 0,
    4: assignmentsCount > 0,
  }

  const firstIncomplete = (['1', '2', '3', '4'] as const).find((step) => !done[Number(step) as OnboardingStep])

  const allDone = done[1] && done[2] && done[3] && done[4]

  console.log('[getOnboardingState] Progress check:', {
    done,
    allDone,
    members,
    documentsCount,
    testsCount,
    assignmentsCount,
    firstIncomplete,
  })

  if (allDone && !row.completedAt) {
    await db
      .update(onboardingProgress)
      .set({ completedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))

    console.log('[getOnboardingState] Marked onboarding as completed')
    return {
      shouldShow: false,
      currentStep: 4,
      done,
      counts: {
        members,
        documents: documentsCount,
        tests: testsCount,
        assignments: assignmentsCount,
      },
    }
  }

  const shouldShow = !allDone
  const currentStep = (firstIncomplete ? Number(firstIncomplete) : 4) as OnboardingStep

  console.log('[getOnboardingState] Final state:', { shouldShow, currentStep, done })

  return {
    shouldShow,
    currentStep,
    done,
    counts: {
      members,
      documents: documentsCount,
      tests: testsCount,
      assignments: assignmentsCount,
    },
  }
}


