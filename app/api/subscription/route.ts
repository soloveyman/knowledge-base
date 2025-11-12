import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStripeConfigured } from '@/lib/stripe/client';
import { db, subscriptionPlans, subscriptions, usage, payments, users } from '@/lib/db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { assignFreeTrialToOwner } from '@/lib/subscription/trial';

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
      // Prioritize active subscriptions, then order by most recently updated
      const userSubscriptions = await db
        .select({
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.ownerId as any, session.user.id))
        .orderBy(
          // Order by status: 'active' first, then others
          sql`CASE WHEN subscriptions.status = 'active' THEN 0 ELSE 1 END`,
          // Then by most recently updated
          desc(subscriptions.updatedAt)
        )
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
            maxUsers: sub.plan.maxUsers,
            maxImportsPerMonth: sub.plan.maxImportsPerMonth,
            maxGenerationsPerMonth: sub.plan.maxGenerationsPerMonth,
            maxEnhancementsPerMonth: sub.plan.maxEnhancementsPerMonth,
          } : null,
        };
      } else {
        // No subscription found - check if user has paid, if not assign free trial
        const hasPayments = await db
          .select()
          .from(payments)
          .where(eq(payments.ownerId, session.user.id))
          .limit(1);
        
        if (hasPayments.length === 0) {
          // User hasn't paid, assign free trial (non-blocking)
          try {
            await assignFreeTrialToOwner(session.user.id);
            // Re-fetch subscription after trial assignment
            const trialSubscriptions = await db
              .select({
                subscription: subscriptions,
                plan: subscriptionPlans,
              })
              .from(subscriptions)
              .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
              .where(eq(subscriptions.ownerId as any, session.user.id))
              .orderBy(desc(subscriptions.createdAt))
              .limit(1);
            
            if (trialSubscriptions.length > 0) {
              const sub = trialSubscriptions[0];
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
                  maxUsers: sub.plan.maxUsers,
                  maxImportsPerMonth: sub.plan.maxImportsPerMonth,
                  maxGenerationsPerMonth: sub.plan.maxGenerationsPerMonth,
                  maxEnhancementsPerMonth: sub.plan.maxEnhancementsPerMonth,
                } : null,
              };
            }
          } catch (error) {
            // Don't fail the request if trial assignment fails
            console.error('[Subscription API] Failed to assign free trial:', error);
          }
        }
      }
    }

    // Get users count for owner (count users with same businessId)
    let usersCount = 0;
    if (session.user.role === 'owner' && session.user.businessId) {
      const usersWithSameBusiness = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.businessId, session.user.businessId));
      
      usersCount = Number(usersWithSameBusiness[0]?.count || 0);
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
      enhancementsCount: userUsage[0].enhancementsCount || 0,
      usersCount: usersCount,
    } : {
      month: currentMonth,
      importsCount: 0,
      generationsCount: 0,
      enhancementsCount: 0,
      usersCount: usersCount,
    };

    // Get payment history (only for owners)
    let paymentHistory: any[] = [];
    if (session.user.role === 'owner') {
      const userPayments = await db
        .select({
          payment: payments,
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(payments)
        .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(payments.ownerId, session.user.id))
        .orderBy(desc(payments.createdAt))
        .limit(50); // Limit to last 50 payments

      paymentHistory = userPayments.map((row) => {
        const payment = row.payment;
        const subscription = row.subscription;
        const plan = row.plan;

        // Determine dates from subscription period or payment date
        const startDate = subscription?.currentPeriodStart 
          ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
          : payment.createdAt 
            ? new Date(payment.createdAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        
        const endDate = subscription?.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toISOString().split('T')[0]
          : payment.createdAt
            ? new Date(payment.createdAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

        return {
          id: payment.id,
          planName: plan?.name || 'unknown',
          startDate,
          endDate,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status as 'paid' | 'pending' | 'failed' | 'refunded',
          createdAt: payment.createdAt?.toISOString(),
        };
      });
    }

    const stripeConfigured = isStripeConfigured();
    console.log('[Subscription API] Stripe configured:', stripeConfigured, {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasPublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
      secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'missing'
    });

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
          stripePriceId: (plan as any).stripePriceId || null, // Optional field
          maxUsers: plan.maxUsers,
          maxImportsPerMonth: plan.maxImportsPerMonth,
          maxGenerationsPerMonth: plan.maxGenerationsPerMonth,
          maxEnhancementsPerMonth: plan.maxEnhancementsPerMonth,
          features: plan.features,
        })),
        currentSubscription,
        usage: usageData,
        paymentHistory,
        isStripeConfigured: stripeConfigured,
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
