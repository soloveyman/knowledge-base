import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireStripe, isStripeConfigured } from '@/lib/stripe/client';
import { createPortalSessionSchema } from '@/lib/stripe/schemas';
import Stripe from 'stripe';

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

    // Only owners can access customer portal
    if (session.user.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          message: 'Only business owners can access the customer portal.',
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createPortalSessionSchema.safeParse(body);
    
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

    const { returnUrl } = validationResult.data;

    // Get Stripe customer ID from user metadata or subscription
    // For now, we'll create a customer if needed
    // In production, you might want to store customer_id in users table
    const stripe = requireStripe();
    
    // Try to find existing customer by email
    let customerId: string | undefined;
    
    if (session.user.email) {
      const customers = await stripe.customers.list({
        email: session.user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        // Create new customer if not found
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: session.user.name || undefined,
          metadata: {
            userId: session.user.id,
          },
        });
        customerId = customer.id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not find or create Stripe customer. Please contact support.',
        },
        { status: 500 }
      );
    }

    // Create portal session
    // Use custom configuration if provided via environment variable
    const portalConfigurationId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
    const portalSessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
    };
    
    // Add configuration ID if provided
    if (portalConfigurationId) {
      portalSessionParams.configuration = portalConfigurationId;
    }
    
    const portalSession = await stripe.billingPortal.sessions.create(portalSessionParams);

    return NextResponse.json({
      success: true,
      data: {
        url: portalSession.url,
      },
    });
  } catch (error) {
    console.error('[Stripe] Create portal session error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create portal session',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

