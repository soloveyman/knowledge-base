/**
 * Verify Stripe Configuration
 * 
 * Checks if Stripe is properly configured and can connect to Stripe API
 * 
 * Run: tsx scripts/verify-stripe.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import Stripe from 'stripe'

// Load environment variables FIRST before importing Stripe client
config({ path: resolve(process.cwd(), '.env.local') })

// Import after env vars are loaded
import { isStripeConfigured, requireStripe, getStripePublishableKey } from '../lib/stripe/client'

async function verifyStripe() {
  console.log('\n🔍 Verifying Stripe Configuration...\n')

  // Check environment variables
  console.log('📋 Environment Variables:')
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY
  const hasPublishableKey = !!process.env.STRIPE_PUBLISHABLE_KEY || !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET

  console.log(`  ${hasSecretKey ? '✅' : '❌'} STRIPE_SECRET_KEY: ${hasSecretKey ? 'Set' : 'Missing'}`)
  if (hasSecretKey) {
    const key = process.env.STRIPE_SECRET_KEY!
    const keyType = key.startsWith('sk_test_') ? 'Test' : key.startsWith('sk_live_') ? 'Live' : 'Unknown'
    console.log(`     Type: ${keyType}`)
    console.log(`     Value: ${key.substring(0, 20)}...${key.substring(key.length - 4)}`)
  }

  console.log(`  ${hasPublishableKey ? '✅' : '❌'} STRIPE_PUBLISHABLE_KEY: ${hasPublishableKey ? 'Set' : 'Missing'}`)
  if (hasPublishableKey) {
    const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    const keyType = key.startsWith('pk_test_') ? 'Test' : key.startsWith('pk_live_') ? 'Live' : 'Unknown'
    console.log(`     Type: ${keyType}`)
    console.log(`     Value: ${key.substring(0, 20)}...${key.substring(key.length - 4)}`)
  }

  console.log(`  ${hasWebhookSecret ? '✅' : '⚠️ '} STRIPE_WEBHOOK_SECRET: ${hasWebhookSecret ? 'Set' : 'Missing (required for webhooks)'}`)
  if (hasWebhookSecret) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET!
    console.log(`     Value: ${secret.substring(0, 20)}...${secret.substring(secret.length - 4)}`)
  }

  // Test API connection directly
  console.log('\n🌐 Testing API Connection:')
  let apiWorks = false
  if (hasSecretKey) {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY!
      const testStripe = new Stripe(secretKey, {
        apiVersion: '2025-10-29.clover',
        typescript: true,
      })
      const account = await testStripe.accounts.retrieve()
      console.log(`  ✅ API Connection: Success`)
      console.log(`     Account ID: ${account.id}`)
      console.log(`     Country: ${account.country || 'N/A'}`)
      console.log(`     Type: ${account.type || 'N/A'}`)
      apiWorks = true
    } catch (error) {
      console.log(`  ❌ API Connection: Failed`)
      console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof Error && error.message.includes('Invalid API Key')) {
        console.log(`     💡 Make sure your STRIPE_SECRET_KEY is correct and active`)
      }
    }
  } else {
    console.log(`  ⚠️  Cannot test API: STRIPE_SECRET_KEY is missing`)
  }

  // Check client module state
  console.log('\n🔧 Stripe Client Module:')
  const isConfigured = isStripeConfigured()
  const publishableKey = getStripePublishableKey()
  
  console.log(`  ${isConfigured ? '✅' : '⚠️ '} Client Module: ${isConfigured ? 'Initialized' : 'Not Initialized (may need app restart)'}`)
  if (publishableKey) {
    console.log(`  ✅ Publishable Key: Available`)
  } else {
    console.log(`  ⚠️  Publishable Key: Not available`)
  }
  
  if (!isConfigured && hasSecretKey && apiWorks) {
    console.log(`  💡 Note: Client module not initialized, but API works. Restart your Next.js app to initialize the client.`)
  }

  // Webhook configuration
  console.log('\n🔐 Webhook Configuration:')
  if (hasWebhookSecret) {
    console.log(`  ✅ Webhook Secret: Configured`)
    console.log(`  📍 Webhook Endpoint: /api/stripe/webhook`)
    console.log(`  💡 For local testing, use: stripe listen --forward-to localhost:3000/api/stripe/webhook`)
  } else {
    console.log(`  ⚠️  Webhook Secret: Not configured`)
    console.log(`  💡 Install Stripe CLI and run: stripe listen --forward-to localhost:3000/api/stripe/webhook`)
    console.log(`  💡 Then copy the whsec_... value to STRIPE_WEBHOOK_SECRET in .env.local`)
  }

  // Summary
  console.log('\n📊 Summary:')
  if (hasSecretKey && hasPublishableKey && apiWorks) {
    console.log(`  ✅ Stripe is configured and working!`)
    if (!hasWebhookSecret) {
      console.log(`  ⚠️  Webhook secret is missing (optional for local testing with Stripe CLI)`)
    }
  } else {
    console.log(`  ❌ Stripe configuration incomplete`)
    if (!hasSecretKey) {
      console.log(`     - Missing STRIPE_SECRET_KEY`)
    }
    if (!hasPublishableKey) {
      console.log(`     - Missing STRIPE_PUBLISHABLE_KEY`)
    }
    if (!apiWorks && hasSecretKey) {
      console.log(`     - API connection failed (check your secret key)`)
    }
  }

  console.log('\n📚 Resources:')
  console.log('  - API Keys: https://dashboard.stripe.com/apikeys')
  console.log('  - Webhooks: https://dashboard.stripe.com/webhooks')
  console.log('  - Stripe CLI: https://stripe.com/docs/stripe-cli')
  console.log('  - Documentation: STRIPE_VARIABLES.md\n')
}

verifyStripe().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})

