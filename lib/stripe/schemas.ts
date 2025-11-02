import { z } from 'zod';

/**
 * Zod schemas for Stripe API routes
 */

export const createCheckoutSessionSchema = z.object({
  planId: z.string().uuid('Plan ID must be a valid UUID'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url('Return URL must be a valid URL'),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type CreatePortalSessionInput = z.infer<typeof createPortalSessionSchema>;

