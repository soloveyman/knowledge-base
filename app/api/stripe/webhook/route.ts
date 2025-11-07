import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { db, subscriptions, payments, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

/**
 * Create or get user from Stripe checkout session
 * For guest checkout, creates a new user account
 */
async function getOrCreateUserFromCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const userId = session.metadata?.userId;
  const isGuestCheckout = session.metadata?.isGuestCheckout === 'true';
  const customerEmail = session.metadata?.customerEmail || session.customer_email || session.customer_details?.email;
  const customerName = session.metadata?.customerName || session.customer_details?.name;

  // If authenticated user, return existing userId
  if (userId && !isGuestCheckout) {
    // Verify user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (existingUser.length > 0) {
      return userId;
    }
  }

  // For guest checkout or missing user, create/find by email
  if (!customerEmail) {
    console.error('[Stripe Webhook] No email found in checkout session for user creation:', session.id);
    return null;
  }

  const normalizedEmail = customerEmail.toLowerCase().trim();

  // Check if user already exists by email
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    // User exists - update businessId if not set
    const user = existingUser[0];
    if (!user.businessId) {
      await db
        .update(users)
        .set({ businessId: user.id })
        .where(eq(users.id, user.id));
    }
    return user.id;
  }

  // Create new user for guest checkout
  try {
    const [created] = await db.insert(users).values({
      email: normalizedEmail,
      name: customerName || null,
      role: 'owner',
      businessId: undefined, // Will be set below
      country: 'US',
    }).returning();

    // Set businessId to user id
    await db
      .update(users)
      .set({ businessId: created.id })
      .where(eq(users.id, created.id));

    console.log('[Stripe Webhook] Created new user from guest checkout:', created.id, normalizedEmail);
    return created.id;
  } catch (error) {
    console.error('[Stripe Webhook] Failed to create user from checkout:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      console.error('[Stripe Webhook] Stripe is not configured');
      return NextResponse.json(
        { received: false, error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    const stripe = requireStripe();
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { received: false, error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { received: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('[Stripe Webhook] Signature verification failed:', error);
      return NextResponse.json(
        { received: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json(
      {
        received: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const planId = session.metadata?.planId;

  if (!planId) {
    console.error('[Stripe Webhook] Missing planId in checkout session:', session.id);
    return;
  }

  // Get or create user from checkout session
  const userId = await getOrCreateUserFromCheckout(session);
  
  if (!userId) {
    console.error('[Stripe Webhook] Could not get or create user for checkout session:', session.id);
    return;
  }

  const stripe = requireStripe();
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error('[Stripe Webhook] No subscription ID in checkout session:', session.id);
    return;
  }

  // Get Stripe subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create or update subscription in database
  const now = new Date();
  const currentPeriodStart = new Date((subscription as any).current_period_start * 1000);
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  // Check if subscription already exists
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing subscription
    await db
      .update(subscriptions)
      .set({
        planId,
        status: subscription.status === 'active' ? 'active' : 'cancelled',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  } else {
    // Create new subscription
    await db.insert(subscriptions).values({
      ownerId: userId,
      planId,
      status: subscription.status === 'active' ? 'active' : 'cancelled',
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  // Get subscription ID for payment record
  let subscriptionDbId: string | undefined;
  if (existing.length > 0) {
    subscriptionDbId = existing[0].id;
  } else {
    // Find the subscription we just created
    const newSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, userId))
      .limit(1);
    if (newSubscription.length > 0) {
      subscriptionDbId = newSubscription[0].id;
    }
  }

  // Create payment record
  if (session.amount_total && session.amount_total > 0) {
    await db.insert(payments).values({
      ownerId: userId,
      subscriptionId: subscriptionDbId,
      provider: 'stripe',
      providerPaymentId: session.id,
      amount: session.amount_total,
      currency: session.currency?.toUpperCase() || 'USD',
      status: 'completed',
      metadata: {
        stripeSessionId: session.id,
        stripeSubscriptionId: subscriptionId,
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  let userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find by subscription customer
    const customer = subscription.customer as string;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, customer))
      .limit(1);

    if (user.length === 0) {
      console.error('[Stripe Webhook] Could not find user for subscription:', subscription.id);
      return;
    }
    userId = user[0].id;
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId))
    .limit(1);

  if (existing.length === 0) {
    console.error('[Stripe Webhook] Subscription not found in database:', subscription.id);
    return;
  }

  const currentPeriodStart = new Date((subscription as any).current_period_start * 1000);
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  await db
    .update(subscriptions)
    .set({
      status:
        subscription.status === 'active'
          ? 'active'
          : (subscription.status as string) === 'canceled' || (subscription.status as string) === 'cancelled'
          ? 'cancelled'
          : 'expired',
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing[0].id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const customer = subscription.customer as string;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, customer))
      .limit(1);

    if (user.length === 0) {
      console.error('[Stripe Webhook] Could not find user for deleted subscription:', subscription.id);
      return;
    }
    userId = user[0].id;
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId))
    .limit(1);

  if (existing.length === 0) {
    console.error('[Stripe Webhook] Subscription not found in database:', subscription.id);
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing[0].id));
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = typeof (invoice as any).subscription === 'string' 
    ? (invoice as any).subscription 
    : (invoice as any).subscription?.id || null;
  if (!subscriptionId) {
    return;
  }

  const stripe = requireStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata for invoice:', invoice.id);
    return;
  }

  // Find subscription in database
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId))
    .limit(1);

  if (existing.length === 0) {
    console.error('[Stripe Webhook] Subscription not found for payment:', invoice.id);
    return;
  }

  // Check if payment already recorded
  const existingPayment = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, invoice.id))
    .limit(1);

  if (existingPayment.length > 0) {
    // Update existing payment
    await db
      .update(payments)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existingPayment[0].id));
  } else {
    // Create new payment record
    await db.insert(payments).values({
      ownerId: userId,
      subscriptionId: existing[0].id,
      provider: 'stripe',
      providerPaymentId: invoice.id,
      amount: invoice.amount_paid || 0,
      currency: invoice.currency.toUpperCase() || 'USD',
      status: 'completed',
      metadata: {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
      },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof (invoice as any).subscription === 'string' 
    ? (invoice as any).subscription 
    : (invoice as any).subscription?.id || null;
  if (!subscriptionId) {
    return;
  }

  const stripe = requireStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    return;
  }

  // Create or update payment record with failed status
  const existingPayment = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, invoice.id))
    .limit(1);

  if (existingPayment.length > 0) {
    await db
      .update(payments)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existingPayment[0].id));
  }
}

