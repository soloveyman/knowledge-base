import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { createCheckoutSessionSchema } from '@/lib/stripe/schemas';
import { db, subscriptionPlans, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { isTrialPlan } from '@/lib/subscription/trial';

export async function POST(request: Request) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Stripe is not configured. Please contact support.',
        },
        { status: 503 }
      );
    }

    // Authenticate user (optional - allow guest checkout)
    const session = await auth();
    const isAuthenticated = !!session?.user;
    
    // If authenticated, verify owner role
    if (isAuthenticated && session.user.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          message: 'Only business owners can create subscriptions.',
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCheckoutSessionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { planId, successUrl, cancelUrl, email, name } = validationResult.data;
    
    // For guest checkout, email is required
    if (!isAuthenticated && !email) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email is required for guest checkout.',
        },
        { status: 400 }
      );
    }
    
    // Use authenticated user's email or provided email
    const customerEmail = isAuthenticated ? session.user.email : email;

    // Get plan from database
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          message: 'Subscription plan not found',
        },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Subscription plan is not available',
        },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription (only for authenticated users)
    // Allow upgrades/downgrades between plans (including free trial → paid, paid → paid)
    if (isAuthenticated) {
      const existingSubscription = await db
        .select({
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.ownerId, session.user.id))
        .limit(1);

      if (existingSubscription.length > 0 && existingSubscription[0].subscription.status === 'active') {
        const existingPlan = existingSubscription[0].plan;
        
        // Only block if user is trying to subscribe to the exact same plan
        if (existingPlan && existingPlan.id === planId) {
          return NextResponse.json(
            {
              success: false,
              message: 'You already have an active subscription to this plan. Please manage your subscription from your account.',
            },
            { status: 400 }
          );
        }
        
        // Allow all other cases:
        // - Free trial → any paid plan (upgrade)
        // - Any paid plan → different paid plan (upgrade/downgrade)
        // - Any plan → different plan (plan change)
      }
    }

    // Create Stripe Checkout session
    const stripe = requireStripe();
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Prepare metadata - include userId if authenticated, or email for guest checkout
    const metadata: Record<string, string> = {
      planId: plan.id,
    };
    
    if (isAuthenticated) {
      metadata.userId = session.user.id;
    } else {
      // For guest checkout, store email and name in metadata
      metadata.customerEmail = customerEmail || '';
      if (name) {
        metadata.customerName = name;
      }
      metadata.isGuestCheckout = 'true';
    }

    // Use Stripe Price ID if available, otherwise create price_data dynamically
    const lineItems = plan.stripePriceId
      ? [{ price: plan.stripePriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: (plan.currency?.toLowerCase() || 'usd') as 'usd',
              product_data: {
                name: plan.displayName,
                description: plan.description || undefined,
              },
              unit_amount: plan.price || 0, // Already in cents
              recurring: {
                interval: (plan.interval || 'month') as 'month' | 'year',
              },
            },
            quantity: 1,
          },
        ];

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail || undefined,
      line_items: lineItems,
      metadata,
      success_url: successUrl || `${baseUrl}/owner?tab=settings&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/owner?tab=settings&canceled=true`,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      },
    });
  } catch (error) {
    console.error('[Stripe] Create checkout session error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create checkout session',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

