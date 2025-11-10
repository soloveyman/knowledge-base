# Stripe Setup Guide

This guide will help you set up Stripe for local development.

## ✅ Current Status

Your Stripe keys are already configured in `.env.local`:
- ✅ `STRIPE_SECRET_KEY` - Set
- ✅ `STRIPE_PUBLISHABLE_KEY` - Set  
- ✅ `STRIPE_WEBHOOK_SECRET` - Set

## 🔍 Verify Configuration

Run the verification script to check if everything is working:

```bash
npm run verify:stripe
# or
tsx scripts/verify-stripe.ts
```

## 🚀 Quick Start

### 1. Install Stripe CLI (for local webhook testing)

**Windows (PowerShell):**

Download and install from: https://github.com/stripe/stripe-cli/releases/latest

Or use Scoop (if installed):
```powershell
scoop install stripe
```

**Alternative: Use npm (global install):**
```bash
npm install -g stripe-cli
```

### 2. Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate with your Stripe account.

### 3. Start Webhook Forwarding

In a separate terminal, run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will:
- Forward Stripe webhook events to your local server
- Display a webhook signing secret (starts with `whsec_`)
- Show all webhook events in real-time

**Important:** If you get a new webhook secret from Stripe CLI, update your `.env.local`:
```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 4. Test Your Integration

1. Start your Next.js dev server:
   ```bash
   npm run dev
   ```

2. Navigate to the subscription page in your app

3. Try creating a test checkout session

4. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date and any CVC

## 📋 Stripe Dashboard Links

- **API Keys**: https://dashboard.stripe.com/apikeys
- **Webhooks**: https://dashboard.stripe.com/webhooks
- **Test Mode Toggle**: https://dashboard.stripe.com/test/apikeys
- **Events Log**: https://dashboard.stripe.com/test/events

## 🔧 Troubleshooting

### Stripe CLI not found

If `stripe` command is not recognized:
1. Make sure Stripe CLI is installed
2. Restart your terminal
3. Check if Stripe CLI is in your PATH

### Webhook events not received

1. Make sure Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. Verify your webhook secret matches the one from Stripe CLI
3. Check that your Next.js server is running on port 3000
4. Check the Stripe CLI output for any errors

### API connection fails

1. Verify your `STRIPE_SECRET_KEY` is correct
2. Make sure you're using test keys (`sk_test_...`) for development
3. Check your Stripe Dashboard to ensure the keys are active

## 📚 Additional Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Project Stripe Variables Documentation](./STRIPE_VARIABLES.md)

## 🎯 Next Steps

1. ✅ Verify configuration: `npm run verify:stripe`
2. ✅ Install Stripe CLI (if not already installed)
3. ✅ Start webhook forwarding: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. ✅ Test checkout flow with test cards
5. ✅ Monitor webhook events in Stripe CLI output

