import { db, subscriptionPlans } from "@/lib/db"
import { eq } from "drizzle-orm"
import { cache } from "react"
import type { SubscriptionPlan } from "./super-admin-client"

// Cache plans since they don't change often
// Revalidate every 5 minutes
export const revalidate = 300

const fetchPlansCached = cache(async (): Promise<SubscriptionPlan[]> => {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.price)

  return plans.map(plan => ({
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    price: plan.price || 0,
    currency: plan.currency || 'USD',
  }))
})

export async function PlansSection() {
  try {
    const plans = await fetchPlansCached()
    return plans
  } catch (error) {
    console.error('Error fetching plans:', error)
    return []
  }
}

