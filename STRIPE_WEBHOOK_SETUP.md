# Stripe Webhook Setup Guide

## Install Stripe CLI

### Windows Installation

1. **Download Stripe CLI:**
   - Go to: https://github.com/stripe/stripe-cli/releases/latest
   - Download `stripe_X.X.X_windows_x86_64.zip` (or the latest version)
   - Extract the ZIP file
   - Copy `stripe.exe` to a folder in your PATH (e.g., `C:\Program Files\Stripe\`)

2. **Or use Scoop (if you have it):**
   ```powershell
   scoop install stripe
   ```

3. **Or use Chocolatey (if you have it):**
   ```powershell
   choco install stripe-cli
   ```

## Setup Webhook Forwarding

1. **Authenticate with Stripe:**
   ```bash
   stripe login
   ```
   This will open a browser to authenticate.

2. **Start webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **Copy the webhook secret:**
   The command will output something like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx
   ```
   
   Copy this secret and add it to your `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

4. **Keep the terminal running** - it will forward webhook events to your local server.

## Test Webhook Events

Once the webhook is running, you can trigger test events:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test payment succeeded
stripe trigger invoice.payment_succeeded
```

## Production Setup

For production, you need to:

1. **Create a webhook endpoint in Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Enter your production URL: `https://your-domain.com/api/stripe/webhook`
   - Select events to listen to:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get the webhook signing secret:**
   - Click on your webhook endpoint
   - Click "Reveal" next to "Signing secret"
   - Copy the `whsec_...` value

3. **Add to production environment variables:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Verify Webhook is Working

Check your server logs for webhook events:
- `[Stripe Webhook] Received event: checkout.session.completed`
- `[Stripe Webhook] Successfully processed checkout.session.completed`

