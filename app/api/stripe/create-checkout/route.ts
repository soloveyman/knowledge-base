import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { createCheckoutSessionSchema } from '@/lib/stripe/schemas';
import { db, subscriptionPlans, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

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

    // Authenticate user
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

    // Only owners can create subscriptions
    if (session.user.role !== 'owner') {
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

    const { planId, successUrl, cancelUrl } = validationResult.data;

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

    // Check if user already has an active subscription
    const existingSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, session.user.id))
      .limit(1);

    if (existingSubscription.length > 0 && existingSubscription[0].status === 'active') {
      return NextResponse.json(
        {
          success: false,
          message: 'You already have an active subscription. Please cancel it first or manage it from your account.',
        },
        { status: 400 }
      );
    }

    // Create Stripe Checkout session
    const stripe = requireStripe();
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: session.user.email || undefined,
      line_items: [
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
      ],
      metadata: {
        userId: session.user.id,
        planId: plan.id,
      },
      success_url: successUrl || `${baseUrl}/subscription?success=true`,
      cancel_url: cancelUrl || `${baseUrl}/subscription?canceled=true`,
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

