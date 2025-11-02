import { db, subscriptionPlans, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * Free trial configuration
 */
export const TRIAL_CONFIG = {
  DURATION_DAYS: 14, // 14-day free trial
  PLAN_NAME: 'free-trial',
} as const;

/**
 * Check if a subscription is a free trial
 */
export async function isTrialSubscription(subscriptionId: string): Promise<boolean> {
  try {
    const [subscription] = await db
      .select({
        planName: subscriptionPlans.name,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    return subscription?.planName === TRIAL_CONFIG.PLAN_NAME;
  } catch {
    return false;
  }
}

/**
 * Check if a subscription plan is the trial plan
 */
export function isTrialPlan(planName: string | null | undefined): boolean {
  return planName === TRIAL_CONFIG.PLAN_NAME;
}

/**
 * Check if trial has expired
 */
export function isTrialExpired(trialEndDate: Date): boolean {
  return new Date() > trialEndDate;
}

/**
 * Get or create the free trial plan
 */
export async function getOrCreateTrialPlan() {
  // Try to find existing trial plan
  const existing = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, TRIAL_CONFIG.PLAN_NAME))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create trial plan if it doesn't exist
  const [trialPlan] = await db
    .insert(subscriptionPlans)
    .values({
      name: TRIAL_CONFIG.PLAN_NAME,
      displayName: 'Free Trial',
      description: '14-day free trial to explore all features',
      price: 0, // Free
      currency: 'USD',
      interval: 'month',
      maxUsers: 10, // Reasonable trial limits
      maxImportsPerMonth: 50,
      maxGenerationsPerMonth: 100,
      features: [
        'Access to all features',
        '10 team members',
        '50 document imports per month',
        '100 AI test generations per month',
        'Full support during trial',
      ],
      isActive: true,
    })
    .returning();

  return trialPlan;
}

/**
 * Assign free trial subscription to a new owner
 */
export async function assignFreeTrialToOwner(ownerId: string) {
  try {
    // Check if user already has a subscription
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.ownerId as any, ownerId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Trial] Owner ${ownerId} already has a subscription, skipping trial assignment`);
      return null;
    }

    // Get or create trial plan
    const trialPlan = await getOrCreateTrialPlan();

    // Calculate trial period
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_CONFIG.DURATION_DAYS);

    // Create trial subscription
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ownerId: ownerId as any,
        planId: trialPlan.id,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        cancelAtPeriodEnd: false,
      })
      .returning();

    console.log(`[Trial] Assigned ${TRIAL_CONFIG.DURATION_DAYS}-day free trial to owner ${ownerId}`);

    return subscription;
  } catch (error) {
    console.error(`[Trial] Failed to assign free trial to owner ${ownerId}:`, error);
    // Don't throw - we don't want registration to fail if trial assignment fails
    return null;
  }
}

