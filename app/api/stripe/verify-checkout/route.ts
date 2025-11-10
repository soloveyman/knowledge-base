import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { db, subscriptions, subscriptionPlans, payments, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

export async function POST(request: Request) {
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

    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Stripe is not configured.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session ID is required',
        },
        { status: 400 }
      );
    }

    const stripe = requireStripe();
    
    // Retrieve checkout session from Stripe
    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
      console.log(`[Verify Checkout] Retrieved checkout session: ${sessionId}, payment_status: ${checkoutSession.payment_status}`);
    } catch (error) {
      console.error(`[Verify Checkout] Error retrieving checkout session ${sessionId}:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to retrieve checkout session from Stripe',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
    
    if (!checkoutSession) {
      return NextResponse.json(
        {
          success: false,
          message: 'Checkout session not found',
        },
        { status: 404 }
      );
    }

    // Verify the session belongs to the current user
    const userId = checkoutSession.metadata?.userId;
    if (userId && userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: 'This checkout session does not belong to you',
        },
        { status: 403 }
      );
    }

    // Check if payment was successful (allow 'paid' or 'no_payment_required' for test mode)
    if (checkoutSession.payment_status !== 'paid' && checkoutSession.payment_status !== 'no_payment_required') {
      console.log(`[Verify Checkout] Payment status: ${checkoutSession.payment_status}, session: ${sessionId}`);
      return NextResponse.json(
        {
          success: false,
          message: `Payment not completed. Status: ${checkoutSession.payment_status}`,
        },
        { status: 400 }
      );
    }

    const planId = checkoutSession.metadata?.planId;
    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Plan ID not found in checkout session',
        },
        { status: 400 }
      );
    }

    // Check if subscription already exists
    const existingSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, session.user.id))
      .limit(1);

    if (existingSubscription.length > 0) {
      // Subscription exists - update it with the new plan from checkout
      const stripeSubscriptionId = checkoutSession.subscription as string;
      if (stripeSubscriptionId) {
        try {
          const stripe = requireStripe();
          const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          
          // Safely convert Stripe timestamps to Date objects
          // Stripe timestamps are Unix timestamps in seconds
          let periodStart = (stripeSubscription as any).current_period_start;
          let periodEnd = (stripeSubscription as any).current_period_end;
          const created = (stripeSubscription as any).created;
          
          console.log(`[Verify Checkout] Period timestamps:`, {
            periodStart,
            periodEnd,
            created,
            periodStartType: typeof periodStart,
            periodEndType: typeof periodEnd,
          });
          
          // If period data isn't available yet, use created timestamp as fallback
          if (periodStart === undefined || periodStart === null || periodEnd === undefined || periodEnd === null) {
            console.warn(`[Verify Checkout] Period timestamps not available, using created timestamp as fallback`);
            if (created) {
              periodStart = created;
              // Default to 30 days from start if end isn't available
              periodEnd = created + (30 * 24 * 60 * 60);
            } else {
              console.error(`[Verify Checkout] Invalid subscription timestamps and no created timestamp`);
              throw new Error('Invalid subscription period data from Stripe');
            }
          }
          
          const currentPeriodStart = new Date(periodStart * 1000);
          const currentPeriodEnd = new Date(periodEnd * 1000);
          
          // Validate dates
          if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
            console.error(`[Verify Checkout] Invalid date conversion:`, {
              periodStart,
              periodEnd,
              currentPeriodStart: currentPeriodStart.toString(),
              currentPeriodEnd: currentPeriodEnd.toString()
            });
            throw new Error('Failed to parse subscription period dates');
          }
          
          // Update existing subscription with new plan
          const [updatedSubscription] = await db
            .update(subscriptions)
            .set({
              planId,
              status: stripeSubscription.status === 'active' ? 'active' : 'cancelled',
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, existingSubscription[0].id))
            .returning();
          
          console.log(`[Verify Checkout] Updated existing subscription ${existingSubscription[0].id} to plan ${planId}`, {
            oldPlanId: existingSubscription[0].planId,
            newPlanId: planId,
            updatedSubscription
          });
          
          // Verify the update worked
          const verifyUpdate = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, existingSubscription[0].id))
            .limit(1);
          
          if (verifyUpdate.length > 0) {
            console.log(`[Verify Checkout] Verified subscription update:`, {
              id: verifyUpdate[0].id,
              planId: verifyUpdate[0].planId,
              status: verifyUpdate[0].status
            });
          }
        } catch (error) {
          console.error(`[Verify Checkout] Error updating existing subscription:`, error);
          // Continue anyway - webhook will handle it
        }
      }
      
      // Return success (webhook will also update it)
      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
      });
    }

    // Get subscription from Stripe
    const stripeSubscriptionId = checkoutSession.subscription as string;
    if (!stripeSubscriptionId) {
      console.log(`[Verify Checkout] No subscription ID in checkout session: ${sessionId}`);
      console.log(`[Verify Checkout] Checkout session object:`, JSON.stringify(checkoutSession, null, 2));
      return NextResponse.json(
        {
          success: false,
          message: 'No subscription found in checkout session. The session may not be fully completed yet.',
        },
        { status: 400 }
      );
    }

    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      console.log(`[Verify Checkout] Retrieved subscription:`, {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        current_period_start: (stripeSubscription as any).current_period_start,
        current_period_end: (stripeSubscription as any).current_period_end,
        created: (stripeSubscription as any).created,
      });
    } catch (error) {
      console.error(`[Verify Checkout] Error retrieving subscription ${stripeSubscriptionId}:`, error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to retrieve subscription from Stripe',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Create subscription in database
    const now = new Date();
    
    // Safely convert Stripe timestamps to Date objects
    // Stripe timestamps are Unix timestamps in seconds
    let periodStart = (stripeSubscription as any).current_period_start;
    let periodEnd = (stripeSubscription as any).current_period_end;
    const created = (stripeSubscription as any).created;
    
    console.log(`[Verify Checkout] Period timestamps:`, {
      periodStart,
      periodEnd,
      created,
      periodStartType: typeof periodStart,
      periodEndType: typeof periodEnd,
    });
    
    // If period data isn't available yet, use created timestamp as fallback
    // This can happen if the subscription is still being initialized
    if (periodStart === undefined || periodStart === null || periodEnd === undefined || periodEnd === null) {
      console.warn(`[Verify Checkout] Period timestamps not available, using created timestamp as fallback`);
      if (created) {
        periodStart = created;
        // Default to 30 days from start if end isn't available
        periodEnd = created + (30 * 24 * 60 * 60);
      } else {
        console.error(`[Verify Checkout] Invalid subscription timestamps and no created timestamp:`, {
          periodStart,
          periodEnd,
          created,
          subscription: stripeSubscription.id,
        });
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid subscription period data from Stripe. The subscription may not be fully initialized yet. Please wait a moment and refresh.',
          },
          { status: 400 }
        );
      }
    }
    
    const currentPeriodStart = new Date(periodStart * 1000);
    const currentPeriodEnd = new Date(periodEnd * 1000);
    
    // Validate dates
    if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
      console.error(`[Verify Checkout] Invalid date conversion:`, {
        periodStart,
        periodEnd,
        currentPeriodStart: currentPeriodStart.toString(),
        currentPeriodEnd: currentPeriodEnd.toString()
      });
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to parse subscription period dates',
        },
        { status: 400 }
      );
    }

    console.log(`[Verify Checkout] Creating subscription for user: ${session.user.id}, plan: ${planId}`);
    console.log(`[Verify Checkout] Period: ${currentPeriodStart.toISOString()} to ${currentPeriodEnd.toISOString()}`);
    
    // Verify plan exists before inserting
    const planExists = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    
    if (planExists.length === 0) {
      console.error(`[Verify Checkout] Plan not found: ${planId}`);
      return NextResponse.json(
        {
          success: false,
          message: `Subscription plan not found: ${planId}`,
        },
        { status: 400 }
      );
    }

    // Verify user exists before attempting insert
    let userExists = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    
    // If user not found by ID, try to find by email (session might be stale)
    if (userExists.length === 0 && session.user.email) {
      console.warn(`[Verify Checkout] User not found by ID ${session.user.id}, trying to find by email: ${session.user.email}`);
      userExists = await db
        .select()
        .from(users)
        .where(eq(users.email, session.user.email.toLowerCase().trim()))
        .limit(1);
      
      if (userExists.length > 0) {
        console.warn(`[Verify Checkout] Found user by email but ID mismatch. Session ID: ${session.user.id}, DB ID: ${userExists[0].id}`);
        // Session has wrong user ID - this is a session sync issue
        return NextResponse.json({
          success: false,
          message: 'Session synchronization error',
          error: 'Your session is out of sync with the database. Please sign out and sign in again.',
        }, { status: 401 });
      }
    }
    
    if (userExists.length === 0) {
      console.error(`[Verify Checkout] User not found in database: ID=${session.user.id}, email=${session.user.email}`);
      return NextResponse.json({
        success: false,
        message: 'User not found',
        error: 'Your account was not found in the database. This may indicate your session is invalid. Please sign out and sign in again.',
      }, { status: 401 });
    }
    
    let newSubscription;
    try {
      [newSubscription] = await db.insert(subscriptions).values({
        ownerId: session.user.id,
        planId,
        status: stripeSubscription.status === 'active' ? 'active' : 'cancelled',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
      }).returning();
      console.log(`[Verify Checkout] Created subscription: ${newSubscription.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Extract nested error messages (drizzle-orm can nest errors)
      let nestedMessage = '';
      let errorCause = (error as any)?.cause;
      while (errorCause && typeof errorCause === 'object') {
        if (errorCause instanceof Error) {
          nestedMessage += ' ' + errorCause.message;
          errorCause = errorCause.cause;
        } else if (typeof errorCause === 'string') {
          nestedMessage += ' ' + errorCause;
          break;
        } else {
          break;
        }
      }
      
      const fullErrorText = `${errorMessage}${nestedMessage}`.trim();
      
      console.error(`[Verify Checkout] Error creating subscription:`, {
        message: errorMessage,
        nestedMessage,
        fullErrorText,
        stack: errorStack,
        error: error,
        userId: session.user.id,
        planId,
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      });
      
      // Check if subscription was created by webhook in the meantime (race condition)
      const existingCheck = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.ownerId, session.user.id))
        .limit(1);
      
      if (existingCheck.length > 0) {
        console.log(`[Verify Checkout] Subscription already exists (created by webhook): ${existingCheck[0].id}`);
        return NextResponse.json({
          success: true,
          message: 'Subscription already exists',
        });
      }
      
      // Check for unique constraint violations (subscription already exists)
      const isUniqueError = fullErrorText.includes('unique') || 
                            fullErrorText.includes('duplicate') ||
                            fullErrorText.includes('already exists') ||
                            (error as any)?.code === '23505'; // PostgreSQL unique violation code
      
      if (isUniqueError) {
        // Subscription already exists, check if it was created by webhook
        const existingCheck = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.ownerId, session.user.id))
          .limit(1);
        
        if (existingCheck.length > 0) {
          console.log(`[Verify Checkout] Subscription already exists (unique constraint): ${existingCheck[0].id}`);
          return NextResponse.json({
            success: true,
            message: 'Subscription already exists',
          });
        }
      }
      
      // Check for foreign key constraint violations (more specific detection)
      const isForeignKeyError = fullErrorText.includes('violates foreign key constraint') || 
                                fullErrorText.includes('foreign key constraint') ||
                                fullErrorText.includes('foreign key violation') ||
                                (error as any)?.code === '23503'; // PostgreSQL foreign key violation code
      
      if (isForeignKeyError) {
        console.log(`[Verify Checkout] Detected foreign key violation, checking user and plan existence`);
        
        // Verify user and plan exist
        const userCheck = await db
          .select()
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1);
        
        const planCheck = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, planId))
          .limit(1);
        
        console.log(`[Verify Checkout] User check result:`, {
          userId: session.user.id,
          userExists: userCheck.length > 0,
          userEmail: session.user.email
        });
        
        console.log(`[Verify Checkout] Plan check result:`, {
          planId,
          planExists: planCheck.length > 0
        });
        
        if (userCheck.length === 0) {
          console.error(`[Verify Checkout] User not found in database: ${session.user.id}`);
          return NextResponse.json({
            success: false,
            message: 'User not found',
            error: `User ${session.user.id} does not exist in database. This may indicate a session synchronization issue.`,
          }, { status: 404 });
        }
        
        if (planCheck.length === 0) {
          console.error(`[Verify Checkout] Plan not found in database: ${planId}`);
          return NextResponse.json({
            success: false,
            message: 'Plan not found',
            error: `Subscription plan ${planId} does not exist in database`,
          }, { status: 404 });
        }
        
        // If both exist but we still got a foreign key error, log it for investigation
        console.error(`[Verify Checkout] Foreign key error but user and plan exist. This may indicate a database constraint issue.`);
      }
      
      // Return detailed error
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create subscription in database',
          error: fullErrorText,
          details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        },
        { status: 500 }
      );
    }

    // Create payment record (check for existing first)
    if (checkoutSession.amount_total && checkoutSession.amount_total > 0) {
      try {
        const existingPayment = await db
          .select()
          .from(payments)
          .where(eq(payments.providerPaymentId, checkoutSession.id))
          .limit(1);

        if (existingPayment.length === 0) {
          await db.insert(payments).values({
            ownerId: session.user.id,
            subscriptionId: newSubscription.id,
            provider: 'stripe',
            providerPaymentId: checkoutSession.id,
            amount: checkoutSession.amount_total,
            currency: checkoutSession.currency?.toUpperCase() || 'USD',
            status: 'completed',
            metadata: {
              stripeSessionId: checkoutSession.id,
              stripeSubscriptionId: stripeSubscriptionId,
            },
          });
          console.log(`[Verify Checkout] Created payment record for session: ${checkoutSession.id}`);
        } else {
          console.log(`[Verify Checkout] Payment record already exists for session: ${checkoutSession.id}`);
        }
      } catch (error) {
        console.error(`[Verify Checkout] Error creating payment record:`, error);
        // Don't fail the whole request if payment record creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    console.error('[Verify Checkout] Error:', error);
    console.error('[Verify Checkout] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to verify checkout session',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 }
    );
  }
}

