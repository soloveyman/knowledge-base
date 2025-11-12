import { NextResponse } from "next/server"
import { isStripeConfigured } from "@/lib/stripe/client"

export async function GET() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    STRIPE: {
      SECRET_KEY: stripeSecretKey ? `${stripeSecretKey.substring(0, 10)}...${stripeSecretKey.substring(stripeSecretKey.length - 4)}` : 'NOT SET',
      PUBLISHABLE_KEY: stripePublishableKey ? `${stripePublishableKey.substring(0, 10)}...${stripePublishableKey.substring(stripePublishableKey.length - 4)}` : 'NOT SET',
      WEBHOOK_SECRET: stripeWebhookSecret ? `${stripeWebhookSecret.substring(0, 10)}...${stripeWebhookSecret.substring(stripeWebhookSecret.length - 4)}` : 'NOT SET',
      IS_CONFIGURED: isStripeConfigured(),
    },
    message: 'Check if environment variables are loaded correctly'
  })
}

