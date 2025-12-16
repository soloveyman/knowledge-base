'use server'

import { NextResponse } from 'next/server'
import { db, onboardingProgress } from '@/lib/db'
import { requireRole, type UserRole } from '@/lib/auth'
import { and, eq, sql } from 'drizzle-orm'
import { ensureOnboardingRow } from './getOnboardingState'

const ALLOWED_ROLES: UserRole[] = ['owner', 'manager', 'super-admin']

export async function dismissOnboarding() {
  const authResult = await requireRole(ALLOWED_ROLES)

  if (authResult instanceof NextResponse) {
    return { ok: false as const, error: 'unauthorized' as const }
  }

  const { session } = authResult
  const businessId = session.user.businessId
  const userId = session.user.id

  await ensureOnboardingRow(businessId, userId)

  await db
    .update(onboardingProgress)
    .set({
      dismissedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))

  return { ok: true as const }
}

export async function resetOnboarding() {
  const authResult = await requireRole(['super-admin'])

  if (authResult instanceof NextResponse) {
    return { ok: false as const, error: 'unauthorized' as const }
  }

  const { session } = authResult
  const businessId = session.user.businessId
  const userId = session.user.id

  await db
    .update(onboardingProgress)
    .set({
      dismissedAt: null,
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(onboardingProgress.businessId, businessId), eq(onboardingProgress.userId, userId)))

  return { ok: true as const }
}


