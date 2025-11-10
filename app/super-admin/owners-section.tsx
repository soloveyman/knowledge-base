import { db, users, subscriptions, subscriptionPlans } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import type { OwnerSubscription } from "./super-admin-client"

export const dynamic = 'force-dynamic'
export const revalidate = 30 // Revalidate every 30 seconds

async function fetchOwners(): Promise<OwnerSubscription[]> {
  // Get all owners with their subscription info (exclude super-admin)
  const allOwners = await db.select()
    .from(users)
    .where(eq(users.role, 'owner'))

  // Get subscription and payment data for each owner
  const ownersWithSubscriptions = await Promise.all(
    allOwners.map(async (owner) => {
      // Get owner's subscription - using user_id (current DB schema)
      const ownerSubscriptions = await db.execute(sql`
        SELECT s.id as subscription_id, s.*, sp.id as plan_id, sp.name as plan_name, 
               sp.display_name as plan_display_name, sp.price as plan_price, 
               sp.currency as plan_currency, s.changed_manually_at as changed_manually_at
        FROM subscriptions s
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.user_id = ${owner.id}
        ORDER BY s.created_at DESC
        LIMIT 1
      `)

      let subscriptionData: {
        id: string | null
        status: string
        currentPeriodEnd: Date | string
        createdAt: Date | string
        changedManuallyAt: Date | string | null
      } | null = null
      let planData: {
        id: string | null
        name: string | null
        displayName: string | null
        price: number | string | null
        currency: string | null
      } | null = null
      
      if (ownerSubscriptions.rows && ownerSubscriptions.rows.length > 0) {
        const sub = ownerSubscriptions.rows[0] as {
          subscription_id?: string
          status?: string
          current_period_end?: Date | string
          created_at?: Date | string
          changed_manually_at?: Date | string | null
          plan_id?: string
          plan_name?: string | null
          plan_display_name?: string | null
          plan_price?: number | string | null
          plan_currency?: string | null
        }
        subscriptionData = {
          id: sub.subscription_id || null,
          status: sub.status || '',
          currentPeriodEnd: sub.current_period_end || new Date(),
          createdAt: sub.created_at || new Date(),
          changedManuallyAt: sub.changed_manually_at || null,
        }
        planData = {
          id: sub.plan_id || null,
          name: sub.plan_name ?? null,
          displayName: sub.plan_display_name ?? null,
          price: sub.plan_price ?? null,
          currency: sub.plan_currency ?? null,
        }
      }

      // Get latest payment for revenue calculation (if payments table exists)
      let revenue = 0
      let provider: 'stripe' | null = null
      
      try {
        // Try to get payment - check if table exists first
        const paymentCheck = await db.execute(sql`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'payments'
        )`)
        
        if (paymentCheck.rows?.[0]?.exists) {
          // Try with owner_id first, fallback to user_id if different schema
          const latestPayment = await db.execute(sql`
            SELECT amount, provider FROM payments 
            WHERE owner_id = ${owner.id} OR user_id = ${owner.id}
            ORDER BY created_at DESC 
            LIMIT 1
          `)
          if (latestPayment.rows && latestPayment.rows.length > 0) {
            revenue = Number(latestPayment.rows[0].amount) || 0
            provider = (latestPayment.rows[0].provider === 'stripe' ? 'stripe' : null) || null
          }
        }
      } catch {
        // Payments table might not exist yet or have different schema
        // This is OK - revenue will be 0
      }

      return {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        country: owner.country,
        plan: planData ? {
          id: planData.id,
          name: planData.name,
          displayName: planData.displayName,
          price: planData.price || 0,
          currency: planData.currency || 'USD',
        } : null,
        subscription: subscriptionData ? {
          id: subscriptionData.id,
          status: subscriptionData.status as 'active' | 'cancelled' | 'expired',
          currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd).toISOString(),
          provider,
          changedManuallyAt: subscriptionData.changedManuallyAt 
            ? new Date(subscriptionData.changedManuallyAt).toISOString() 
            : null,
        } : null,
        revenue,
      } as OwnerSubscription
    })
  )

  return ownersWithSubscriptions
}

export async function OwnersSection() {
  const owners = await fetchOwners()

  return owners
}

