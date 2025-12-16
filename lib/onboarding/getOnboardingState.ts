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
  const existing = await db
    .select()
    .from(onboardingProgress)
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [created] = await db
    .insert(onboardingProgress)
    .values({ businessId, userId })
    .onConflictDoNothing({
      target: [onboardingProgress.businessId, onboardingProgress.userId],
    })
    .returning()

  if (created) {
    return created
  }

  const [row] = await db
    .select()
    .from(onboardingProgress)
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))
    .limit(1)

  return row
}

export async function getOnboardingState(input: {
  businessId: string
  userId: string
  role: UserRole
}): Promise<OnboardingState> {
  const { businessId, userId, role } = input

  if (!ALLOWED_ROLES.includes(role)) {
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  const row = await ensureOnboardingRow(businessId, userId)

  if (!row) {
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  if (row.completedAt) {
    return {
      shouldShow: false,
      currentStep: 4,
      done: { 1: true, 2: true, 3: true, 4: true },
    }
  }

  if (row.dismissedAt) {
    return {
      shouldShow: false,
      currentStep: 1,
      done: { 1: false, 2: false, 3: false, 4: false },
    }
  }

  const [{ members = 0 }] =
    (await db
      .select({ members: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.businessId, businessId),
          sql`${users.id} != ${userId}`,
          sql`${users.role} IN ('manager', 'employee')`,
        ),
      )) ?? []

  const [{ documents: documentsCount = 0 }] =
    (await db
      .select({ documents: sql<number>`count(distinct ${documents.id})` })
      .from(documents)
      .innerJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(users.businessId, businessId))) ?? []

  const [{ tests: testsCount = 0 }] =
    (await db
      .select({ tests: sql<number>`count(distinct ${tests.id})` })
      .from(tests)
      .innerJoin(users, eq(tests.createdBy, users.id))
      .where(eq(users.businessId, businessId))) ?? []

  const [{ assignments: assignmentsCount = 0 }] =
    (await db
      .select({ assignments: sql<number>`count(distinct ${assignments.id})` })
      .from(assignments)
      .innerJoin(users, eq(assignments.assignedBy, users.id))
      .where(eq(users.businessId, businessId))) ?? []

  const done: OnboardingState['done'] = {
    1: members >= 1,
    2: documentsCount > 0,
    3: testsCount > 0,
    4: assignmentsCount > 0,
  }

  const firstIncomplete = (['1', '2', '3', '4'] as const).find((step) => !done[Number(step) as OnboardingStep])

  const allDone = done[1] && done[2] && done[3] && done[4]

  if (allDone && !row.completedAt) {
    await db
      .update(onboardingProgress)
      .set({ completedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))

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

  return {
    shouldShow: !allDone,
    currentStep: (firstIncomplete ? Number(firstIncomplete) : 4) as OnboardingStep,
    done,
    counts: {
      members,
      documents: documentsCount,
      tests: testsCount,
      assignments: assignmentsCount,
    },
  }
}


