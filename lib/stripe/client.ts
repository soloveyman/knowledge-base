import Stripe from 'stripe';

/**
 * Stripe client instance
 * Gracefully handles missing API keys - returns null instead of throwing
 */
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Stripe] STRIPE_SECRET_KEY not configured. Stripe functionality will be disabled.');
    }
    return null;
  }

  try {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
    return stripeInstance;
  } catch (error) {
    console.error('[Stripe] Failed to initialize Stripe client:', error);
    return null;
  }
}

export const stripe = getStripeClient();

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return stripe !== null && !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Get Stripe publishable key
 */
export function getStripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * Assert Stripe is configured, throw helpful error if not
 */
export function requireStripe(): Stripe {
  if (!stripe || !isStripeConfigured()) {
    throw new Error(
      'Stripe is not configured. Please set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables.'
    );
  }
  return stripe;
}

