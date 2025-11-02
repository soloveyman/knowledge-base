import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, subscriptionPlans, subscriptions, usage } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized. Please sign in.',
        },
        { status: 401 }
      );
    }

    // Get all active subscription plans
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.price);

    // Get current user's subscription (only owners can have subscriptions)
    let currentSubscription = null;
    if (session.user.role === 'owner') {
      const userSubscriptions = await db
        .select({
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.ownerId as any, session.user.id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (userSubscriptions.length > 0) {
        const sub = userSubscriptions[0];
        currentSubscription = {
          id: sub.subscription.id,
          planId: sub.subscription.planId,
          status: sub.subscription.status,
          currentPeriodStart: sub.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: sub.subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: sub.subscription.cancelAtPeriodEnd,
          plan: sub.plan ? {
            id: sub.plan.id,
            name: sub.plan.name,
            displayName: sub.plan.displayName,
            description: sub.plan.description,
            price: sub.plan.price,
            currency: sub.plan.currency,
            interval: sub.plan.interval,
            features: sub.plan.features,
          } : null,
        };
      }
    }

    // Get usage data for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const userUsage = await db
      .select()
      .from(usage)
      .where(
        and(
          eq(usage.userId, session.user.id),
          eq(usage.month, currentMonth)
        )
      )
      .limit(1);

    const usageData = userUsage.length > 0 ? {
      month: userUsage[0].month,
      importsCount: userUsage[0].importsCount || 0,
      generationsCount: userUsage[0].generationsCount || 0,
    } : {
      month: currentMonth,
      importsCount: 0,
      generationsCount: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        plans: plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          maxUsers: plan.maxUsers,
          maxImportsPerMonth: plan.maxImportsPerMonth,
          maxGenerationsPerMonth: plan.maxGenerationsPerMonth,
          features: plan.features,
        })),
        currentSubscription,
        usage: usageData,
      }
    });
  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch subscription data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
