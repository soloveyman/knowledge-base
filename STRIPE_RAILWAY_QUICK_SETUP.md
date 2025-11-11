# Quick Setup: Stripe Variables in Railway

## Required Variables

Set these 3 variables in Railway:

1. `STRIPE_SECRET_KEY` - Secret API key
2. `STRIPE_PUBLISHABLE_KEY` - Publishable key
3. `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

## Method 1: Railway Dashboard (Easiest)

### Step 1: Get Your Stripe Keys

**API Keys:**
1. Go to https://dashboard.stripe.com/apikeys
2. Copy **Secret key** → `sk_test_...` or `sk_live_...`
3. Copy **Publishable key** → `pk_test_...` or `pk_live_...`

**Webhook Secret:**
1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. Set **Endpoint URL**: `https://knowledge-base.up.railway.app/api/stripe/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. Click **Add endpoint**
6. Click on the endpoint → Click **Reveal** next to "Signing secret"
7. Copy the secret → `whsec_...`

### Step 2: Set in Railway

1. Go to https://railway.app/dashboard
2. Select project → **knowledge-base** service (not Postgres!)
3. Click **Variables** tab
4. Click **+ New Variable** for each:

   **Variable 1:**
   ```
   Key: STRIPE_SECRET_KEY
   Value: sk_test_... (paste your secret key)
   Environment: Production
   ```

   **Variable 2:**
   ```
   Key: STRIPE_PUBLISHABLE_KEY
   Value: pk_test_... (paste your publishable key)
   Environment: Production
   ```

   **Variable 3:**
   ```
   Key: STRIPE_WEBHOOK_SECRET
   Value: whsec_... (paste your webhook secret)
   Environment: Production
   ```

5. Railway will auto-redeploy after adding variables

## Method 2: Railway CLI

Run the interactive script:

```powershell
npm run stripe:set-railway
```

Or manually:

```powershell
railway variables --set "STRIPE_SECRET_KEY=sk_test_..."
railway variables --set "STRIPE_PUBLISHABLE_KEY=pk_test_..."
railway variables --set "STRIPE_WEBHOOK_SECRET=whsec_..."
```

## Verify Setup

After setting variables, verify:

```powershell
# Check variables are set
railway variables --json | ConvertFrom-Json | Select-Object STRIPE_SECRET_KEY,STRIPE_PUBLISHABLE_KEY,STRIPE_WEBHOOK_SECRET

# Or run verification script
npm run verify:stripe
```

## Important Notes

- **Test vs Live**: 
  - Use `sk_test_`/`pk_test_` for testing
  - Use `sk_live_`/`pk_live_` for production
- **Webhook URL**: Must match your Railway app URL
- **Auto-redeploy**: Railway redeploys automatically when you add variables
- **Security**: Never commit these keys to Git

## Troubleshooting

**Variables not showing?**
- Make sure you're in the **knowledge-base** service (not Postgres)
- Check you're in the correct environment (Production)

**Webhook not working?**
- Verify webhook URL in Stripe matches: `https://knowledge-base.up.railway.app/api/stripe/webhook`
- Check webhook secret matches in Railway
- View Railway logs to see webhook events

**Need help?**
- See full guide: `scripts/set-stripe-vars-railway.md`
- Check Stripe docs: https://stripe.com/docs/webhooks

