import { db, users, subscriptions, subscriptionPlans } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import type { OwnerSubscription } from "./super-admin-client"

export const dynamic = 'force-dynamic'
export const revalidate = 30 // Revalidate every 30 seconds

async function fetchOwners(): Promise<OwnerSubscription[]> {
  // Optimized: Get all owners with subscriptions and plans in one query instead of N+1
  // Using window functions to get latest subscription per owner
  // First, get all owners to ensure we don't miss any
  const allOwnersResult = await db.execute(sql`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.country
    FROM users u
    WHERE u.role = 'owner'
  `)
  
  console.log(`[Super Admin] Found ${allOwnersResult.rows?.length || 0} owners in database`)
  
  // Then get subscriptions with plans using a subquery to get latest subscription per owner
  // Use COALESCE to handle NULL values in ORDER BY for owners without subscriptions
  const ownersWithSubscriptionsResult = await db.execute(sql`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.country,
      s.id as subscription_id,
      s.status,
      s.current_period_end,
      s.created_at as subscription_created_at,
      s.changed_manually_at,
      sp.id as plan_id,
      sp.name as plan_name,
      sp.display_name as plan_display_name,
      sp.price as plan_price,
      sp.currency as plan_currency,
      CASE 
        WHEN s.id IS NULL THEN 1
        ELSE ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY s.created_at DESC)
      END as rn
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE u.role = 'owner'
  `)
  
  console.log(`[Super Admin] Query returned ${ownersWithSubscriptionsResult.rows?.length || 0} rows`)
  
  // Filter to get only the latest subscription per owner (or owners without subscriptions)
  // ROW_NUMBER() will be NULL for owners without subscriptions, or 1 for the latest subscription
  const latestSubscriptions = (ownersWithSubscriptionsResult.rows || []).filter((row: any) => {
    // Include rows where rn is 1 (latest subscription) or null/undefined (no subscription)
    const rn = row.rn
    const shouldInclude = rn === 1 || rn === null || rn === undefined || (typeof rn === 'number' && rn === 1)
    if (!shouldInclude) {
      console.log(`[Super Admin] Filtering out row for owner ${row.id}, rn=${rn}`)
    }
    return shouldInclude
  })
  
  console.log(`[Super Admin] After filtering, ${latestSubscriptions.length} owners to process`)
  
  // If we have fewer owners than expected, log a warning
  const expectedOwners = allOwnersResult.rows?.length || 0
  if (latestSubscriptions.length < expectedOwners) {
    console.warn(`[Super Admin] Warning: Expected ${expectedOwners} owners but got ${latestSubscriptions.length} after filtering`)
  }

  // Get payments in one query (if table exists)
  let paymentsMap = new Map<string, { revenue: number; provider: 'stripe' | null }>()
  try {
    const paymentCheck = await db.execute(sql`SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'payments'
    )`)
    
    if (paymentCheck.rows?.[0]?.exists) {
      const payments = await db.execute(sql`
        SELECT 
          COALESCE(owner_id, user_id) as owner_id,
          amount,
          provider,
          ROW_NUMBER() OVER (PARTITION BY COALESCE(owner_id, user_id) ORDER BY created_at DESC) as rn
        FROM payments
      `)
      
      // Filter to get only the latest payment per owner
      const latestPayments = (payments.rows || []).filter((row: any) => row.rn === 1)
      
      if (latestPayments) {
        latestPayments.forEach((row: any) => {
          if (row.owner_id) {
            paymentsMap.set(row.owner_id, {
              revenue: Number(row.amount) || 0,
              provider: (row.provider === 'stripe' ? 'stripe' : null) || null
            })
          }
        })
      }
    }
  } catch {
    // Payments table might not exist yet or have different schema
  }

  // Process results
  const ownersWithSubscriptions = latestSubscriptions.map((row: any) => {
    const ownerId = row.id
    const paymentData = paymentsMap.get(ownerId) || { revenue: 0, provider: null as 'stripe' | null }

    const subscriptionData = row.subscription_id ? {
      id: row.subscription_id,
      status: row.status || '',
      currentPeriodEnd: row.current_period_end || new Date(),
      createdAt: row.subscription_created_at || new Date(),
      changedManuallyAt: row.changed_manually_at || null,
    } : null

    const planData = row.plan_id ? {
      id: row.plan_id,
      name: row.plan_name ?? null,
      displayName: row.plan_display_name ?? null,
      price: row.plan_price ?? null,
      currency: row.plan_currency ?? null,
    } : null

    return {
      id: ownerId,
      name: row.name,
      email: row.email,
      country: row.country,
      plan: planData ? {
        id: planData.id,
        name: planData.name,
        displayName: planData.displayName,
        price: typeof planData.price === 'number' ? planData.price : Number(planData.price) || 0,
        currency: planData.currency || 'USD',
      } : null,
      subscription: subscriptionData ? {
        id: subscriptionData.id,
        status: subscriptionData.status as 'active' | 'cancelled' | 'expired',
        currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd).toISOString(),
        provider: paymentData.provider,
        changedManuallyAt: subscriptionData.changedManuallyAt 
          ? new Date(subscriptionData.changedManuallyAt).toISOString() 
          : null,
      } : null,
      revenue: paymentData.revenue,
    } as OwnerSubscription
  })

  return ownersWithSubscriptions
}

export async function OwnersSection() {
  try {
    const owners = await fetchOwners()
    console.log(`[Super Admin] OwnersSection returning ${owners.length} owners`)
    return owners
  } catch (error) {
    console.error('[Super Admin] Error fetching owners:', error)
    if (error instanceof Error) {
      console.error('[Super Admin] Error stack:', error.stack)
    }
    return []
  }
}

