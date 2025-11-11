# Set Stripe Variables in Railway

## Required Variables

You need to set these 3 variables in Railway:

1. **STRIPE_SECRET_KEY** - Your Stripe secret API key
2. **STRIPE_PUBLISHABLE_KEY** - Your Stripe publishable key  
3. **STRIPE_WEBHOOK_SECRET** - Your Stripe webhook signing secret

## Step 1: Get Stripe Keys

### Get API Keys:
1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
3. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)

### Get Webhook Secret:
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Create endpoint or select existing:
   - **Endpoint URL**: `https://knowledge-base.up.railway.app/api/stripe/webhook`
   - **Events to send**: 
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. Click on the endpoint → Click **Reveal** next to "Signing secret"
4. Copy the secret (starts with `whsec_`)

## Step 2: Set in Railway Dashboard

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your project → **knowledge-base** service (not Postgres)
3. Click **Variables** tab
4. Click **+ New Variable** for each:

   **Variable 1:**
   - Key: `STRIPE_SECRET_KEY`
   - Value: `sk_test_...` or `sk_live_...`
   - Environment: Production (and Preview if needed)

   **Variable 2:**
   - Key: `STRIPE_PUBLISHABLE_KEY`
   - Value: `pk_test_...` or `pk_live_...`
   - Environment: Production (and Preview if needed)

   **Variable 3:**
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_...`
   - Environment: Production (and Preview if needed)

5. Railway will automatically redeploy after adding variables

## Step 3: Verify

After setting variables, verify:

```bash
railway variables --json | ConvertFrom-Json | Select-Object STRIPE_SECRET_KEY,STRIPE_PUBLISHABLE_KEY,STRIPE_WEBHOOK_SECRET
```

Or run the verification script:
```bash
npm run verify:stripe
```

## Using Railway CLI (Alternative)

You can also set variables via CLI:

```bash
# Set Secret Key
railway variables --set "STRIPE_SECRET_KEY=sk_test_..."

# Set Publishable Key
railway variables --set "STRIPE_PUBLISHABLE_KEY=pk_test_..."

# Set Webhook Secret
railway variables --set "STRIPE_WEBHOOK_SECRET=whsec_..."
```

## Important Notes

- **Test vs Live**: Use `sk_test_`/`pk_test_` for testing, `sk_live_`/`pk_live_` for production
- **Webhook URL**: Make sure webhook endpoint in Stripe matches your Railway URL
- **Security**: Never commit these keys to Git
- **Redeploy**: Railway auto-redeploys when you add variables

