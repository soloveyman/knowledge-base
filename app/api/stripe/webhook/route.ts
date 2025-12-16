import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { db, subscriptions, payments, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendWelcomeEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/email-verification';

// Disable body parsing for webhook route - we need raw body for signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    // Generate secure random password
    const generatedPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    // Hash the password
    const hashedPassword = await bcrypt.hash(generatedPassword, 12);

    const [created] = await db.insert(users).values({
      email: normalizedEmail,
      name: customerName || null,
      role: 'owner',
      password: hashedPassword,
      businessId: undefined, // Will be set below
      country: 'US',
    }).returning();

    // Set businessId to user id
    await db
      .update(users)
      .set({ businessId: created.id })
      .where(eq(users.id, created.id));

    console.log('[Stripe Webhook] Created new user from guest checkout:', created.id, normalizedEmail);

    // Create onboarding progress for new owner
    try {
      const { ensureOnboardingRow } = await import('@/lib/onboarding/getOnboardingState');
      await ensureOnboardingRow(created.id, created.id);
      console.log('[Stripe Webhook] Onboarding progress created for:', normalizedEmail, '(owner via Stripe checkout)');
    } catch (error) {
      console.error('[Stripe Webhook] Failed to create onboarding progress (non-fatal):', error);
    }

    // Send welcome email with password (non-blocking)
    try {
      const baseUrl = getBaseUrl();
      const loginUrl = `${baseUrl}/auth/signin`;
      await sendWelcomeEmail(normalizedEmail, customerName || null, generatedPassword, loginUrl);
      console.log('[Stripe Webhook] Welcome email sent to:', normalizedEmail);
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.error('[Stripe Webhook] Failed to send welcome email:', errorMessage);
      // Don't fail user creation if email fails
      // In development, log the password
      if (process.env.NODE_ENV === 'development') {
        console.log('[Stripe Webhook] Generated password for', normalizedEmail, ':', generatedPassword);
      }
    }

    return created.id;
  } catch (error) {
    console.error('[Stripe Webhook] Failed to create user from checkout:', error);
    return null;
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/stripe/webhook',
    configured: isStripeConfigured(),
    message: 'Stripe webhook endpoint is ready. Use POST method for webhook events.',
  });
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
      console.error('[Stripe Webhook] Missing stripe-signature header');
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
      console.log(`[Stripe Webhook] Received event: ${event.type} (id: ${event.id})`);
    } catch (error) {
      console.error('[Stripe Webhook] Signature verification failed:', error);
      return NextResponse.json(
        { received: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle different event types
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`[Stripe Webhook] Processing checkout.session.completed for session: ${session.id}`);
          await handleCheckoutCompleted(session);
          console.log(`[Stripe Webhook] Successfully processed checkout.session.completed for session: ${session.id}`);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[Stripe Webhook] Processing customer.subscription.updated for subscription: ${subscription.id}`);
          await handleSubscriptionUpdated(subscription);
          console.log(`[Stripe Webhook] Successfully processed customer.subscription.updated for subscription: ${subscription.id}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[Stripe Webhook] Processing customer.subscription.deleted for subscription: ${subscription.id}`);
          await handleSubscriptionDeleted(subscription);
          console.log(`[Stripe Webhook] Successfully processed customer.subscription.deleted for subscription: ${subscription.id}`);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`[Stripe Webhook] Processing invoice.payment_succeeded for invoice: ${invoice.id}`);
          await handlePaymentSucceeded(invoice);
          console.log(`[Stripe Webhook] Successfully processed invoice.payment_succeeded for invoice: ${invoice.id}`);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`[Stripe Webhook] Processing invoice.payment_failed for invoice: ${invoice.id}`);
          await handlePaymentFailed(invoice);
          console.log(`[Stripe Webhook] Successfully processed invoice.payment_failed for invoice: ${invoice.id}`);
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type} (id: ${event.id})`);
      }
    } catch (handlerError) {
      console.error(`[Stripe Webhook] Error handling event ${event.type}:`, handlerError);
      // Don't return error - we want to acknowledge receipt to Stripe
      // but log the error for debugging
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
  try {
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

    console.log(`[Stripe Webhook] Processing checkout for user: ${userId}, plan: ${planId}`);

    const stripe = requireStripe();
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      console.error('[Stripe Webhook] No subscription ID in checkout session:', session.id);
      return;
    }

    // Get Stripe subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log(`[Stripe Webhook] Retrieved subscription from Stripe: ${subscriptionId}, status: ${subscription.status}`);

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

    let subscriptionDbId: string;

    if (existing.length > 0) {
      // Update existing subscription
      console.log(`[Stripe Webhook] Updating existing subscription: ${existing[0].id}`);
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
      subscriptionDbId = existing[0].id;
    } else {
      // Create new subscription
      console.log(`[Stripe Webhook] Creating new subscription for user: ${userId}`);
      const [newSubscription] = await db.insert(subscriptions).values({
        ownerId: userId,
        planId,
        status: subscription.status === 'active' ? 'active' : 'cancelled',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }).returning();
      subscriptionDbId = newSubscription.id;
      console.log(`[Stripe Webhook] Created subscription: ${subscriptionDbId}`);
    }

    // Check if payment record already exists (idempotency)
    const existingPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, session.id))
      .limit(1);

    // Create payment record if it doesn't exist
    if (session.amount_total && session.amount_total > 0 && existingPayment.length === 0) {
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
      console.log(`[Stripe Webhook] Created payment record for session: ${session.id}`);
    } else if (existingPayment.length > 0) {
      console.log(`[Stripe Webhook] Payment record already exists for session: ${session.id}`);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error in handleCheckoutCompleted:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    let userId = subscription.metadata?.userId;
    
    if (!userId) {
      // Try to find by subscription customer email
      const stripe = requireStripe();
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;
      
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && 'email' in customer && customer.email) {
            const user = await db
              .select()
              .from(users)
              .where(eq(users.email, customer.email.toLowerCase().trim()))
              .limit(1);

            if (user.length > 0) {
              userId = user[0].id;
            }
          }
        } catch (error) {
          console.error('[Stripe Webhook] Error retrieving customer:', error);
        }
      }
    }

    if (!userId) {
      console.error('[Stripe Webhook] Could not find user for subscription:', subscription.id);
      return;
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

    // Map Stripe status to our status
    // Stripe uses 'canceled' (not 'cancelled'), and status can be: 'incomplete' | 'incomplete_expired' | 'past_due' | 'paused' | 'trialing' | 'unpaid' | 'active' | 'canceled'
    let status: 'active' | 'cancelled' | 'expired' = 'active';
    if (subscription.status === 'active') {
      status = 'active';
    } else if (subscription.status === 'canceled') {
      status = 'cancelled';
    } else if (subscription.status === 'past_due' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
      status = 'expired';
    } else {
      // For 'incomplete', 'paused', 'trialing' - treat as expired for now
      status = 'expired';
    }

    await db
      .update(subscriptions)
      .set({
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing[0].id));
    
    console.log(`[Stripe Webhook] Updated subscription ${existing[0].id} to status: ${status}`);
  } catch (error) {
    console.error('[Stripe Webhook] Error in handleSubscriptionUpdated:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    let userId = subscription.metadata?.userId;
    
    if (!userId) {
      // Try to find by subscription customer email
      const stripe = requireStripe();
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;
      
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && 'email' in customer && customer.email) {
            const user = await db
              .select()
              .from(users)
              .where(eq(users.email, customer.email.toLowerCase().trim()))
              .limit(1);

            if (user.length > 0) {
              userId = user[0].id;
            }
          }
        } catch (error) {
          console.error('[Stripe Webhook] Error retrieving customer:', error);
        }
      }
    }

    if (!userId) {
      console.error('[Stripe Webhook] Could not find user for deleted subscription:', subscription.id);
      return;
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
    
    console.log(`[Stripe Webhook] Marked subscription ${existing[0].id} as expired`);
  } catch (error) {
    console.error('[Stripe Webhook] Error in handleSubscriptionDeleted:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = typeof (invoice as any).subscription === 'string' 
      ? (invoice as any).subscription 
      : (invoice as any).subscription?.id || null;
    if (!subscriptionId) {
      console.error('[Stripe Webhook] No subscription ID in invoice:', invoice.id);
      return;
    }

    const stripe = requireStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    let userId = subscription.metadata?.userId;

    // If no userId in metadata, try to find by customer email
    if (!userId) {
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;
      
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && 'email' in customer && customer.email) {
            const user = await db
              .select()
              .from(users)
              .where(eq(users.email, customer.email.toLowerCase().trim()))
              .limit(1);

            if (user.length > 0) {
              userId = user[0].id;
            }
          }
        } catch (error) {
          console.error('[Stripe Webhook] Error retrieving customer:', error);
        }
      }
    }

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

    // Check if payment already recorded (idempotency)
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
      console.log(`[Stripe Webhook] Updated payment record for invoice: ${invoice.id}`);
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
      console.log(`[Stripe Webhook] Created payment record for invoice: ${invoice.id}`);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error in handlePaymentSucceeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = typeof (invoice as any).subscription === 'string' 
      ? (invoice as any).subscription 
      : (invoice as any).subscription?.id || null;
    if (!subscriptionId) {
      console.error('[Stripe Webhook] No subscription ID in failed invoice:', invoice.id);
      return;
    }

    const stripe = requireStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    let userId = subscription.metadata?.userId;

    // If no userId in metadata, try to find by customer email
    if (!userId) {
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer?.id;
      
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && 'email' in customer && customer.email) {
            const user = await db
              .select()
              .from(users)
              .where(eq(users.email, customer.email.toLowerCase().trim()))
              .limit(1);

            if (user.length > 0) {
              userId = user[0].id;
            }
          }
        } catch (error) {
          console.error('[Stripe Webhook] Error retrieving customer:', error);
        }
      }
    }

    if (!userId) {
      console.error('[Stripe Webhook] Missing userId for failed payment:', invoice.id);
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
      console.log(`[Stripe Webhook] Updated payment record to failed for invoice: ${invoice.id}`);
    } else {
      // Create new payment record with failed status
      const existingSubscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.ownerId, userId))
        .limit(1);

      if (existingSubscription.length > 0) {
        await db.insert(payments).values({
          ownerId: userId,
          subscriptionId: existingSubscription[0].id,
          provider: 'stripe',
          providerPaymentId: invoice.id,
          amount: invoice.amount_due || 0,
          currency: invoice.currency.toUpperCase() || 'USD',
          status: 'failed',
          metadata: {
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
          },
        });
        console.log(`[Stripe Webhook] Created failed payment record for invoice: ${invoice.id}`);
      }
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error in handlePaymentFailed:', error);
    throw error;
  }
}

