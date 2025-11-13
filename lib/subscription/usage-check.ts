import { db } from '@/lib/db'
import { subscriptions, subscriptionPlans, usage, users } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getTenantDb } from '@/lib/db/tenant'

/**
 * Check if user has reached a usage limit
 */
export async function checkUsageLimit(
  userId: string,
  limitType: 'imports' | 'generations' | 'enhancements' | 'users'
): Promise<{ allowed: boolean; current: number; max: number | null; message?: string }> {
  try {
    // Get user's current subscription
    const userSubscription = await db
      .select({
        subscription: subscriptions,
        plan: subscriptionPlans,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.ownerId, userId))
      .limit(1)

    if (userSubscription.length === 0 || !userSubscription[0].plan) {
      return {
        allowed: false,
        current: 0,
        max: null,
        message: 'No active subscription found'
      }
    }

    const plan = userSubscription[0].plan
    const subscription = userSubscription[0].subscription

    // Check subscription status
    if (subscription.status !== 'active') {
      return {
        allowed: false,
        current: 0,
        max: null,
        message: 'Subscription is not active'
      }
    }

    // Get max limit based on type
    let maxLimit: number | null = null
    switch (limitType) {
      case 'imports':
        maxLimit = plan.maxImportsPerMonth
        break
      case 'generations':
        maxLimit = plan.maxGenerationsPerMonth
        break
      case 'enhancements':
        maxLimit = plan.maxEnhancementsPerMonth
        break
      case 'users':
        maxLimit = plan.maxUsers
        break
    }

    // If no limit is set (null), allow unlimited
    if (maxLimit === null) {
      return {
        allowed: true,
        current: 0,
        max: null
      }
    }

    let currentUsage = 0

    // For users, always count from database (not from usage table)
    if (limitType === 'users') {
      // Get owner's businessId
      const ownerUser = await db
        .select({ businessId: users.businessId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      
      if (ownerUser.length > 0 && ownerUser[0].businessId) {
        const tenantDb = getTenantDb(ownerUser[0].businessId)
        const userCountResult = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.businessId, ownerUser[0].businessId))
        
        currentUsage = Number(userCountResult[0]?.count || 0)
      }
    } else {
      // For other types, get from usage table
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      const usageRecords = await db
        .select()
        .from(usage)
        .where(
          and(
            eq(usage.userId, userId),
            eq(usage.month, currentMonth)
          )
        )
        .limit(1)

      if (usageRecords.length > 0) {
        const usageRecord = usageRecords[0]
        switch (limitType) {
          case 'imports':
            currentUsage = usageRecord.importsCount || 0
            break
          case 'generations':
            currentUsage = usageRecord.generationsCount || 0
            break
          case 'enhancements':
            currentUsage = usageRecord.enhancementsCount || 0
            break
        }
      }
    }

    // Check if limit is reached
    const isLimitReached = currentUsage >= maxLimit

    return {
      allowed: !isLimitReached,
      current: currentUsage,
      max: maxLimit,
      message: isLimitReached 
        ? `You have reached your ${limitType} limit (${currentUsage}/${maxLimit}). Please upgrade your plan to continue.`
        : undefined
    }
  } catch (error) {
    console.error('Error checking usage limit:', error)
    // On error, allow the action but log it
    return {
      allowed: true,
      current: 0,
      max: null,
      message: 'Unable to verify usage limit'
    }
  }
}

