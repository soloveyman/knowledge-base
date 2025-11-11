# Test Stripe Webhook - Step by Step

## Current Status ✅

- ✅ Database: All Stripe tables present
- ✅ Stripe Variables: All set in Railway
- ✅ Webhook Endpoint: Created in Stripe Dashboard
- ⚠️  App Deployment: Need to verify

## Testing Steps

### Step 1: Verify App is Deployed

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your project
3. Click on **knowledge-base** service (not Postgres)
4. Go to **Deployments** tab
5. Check if latest deployment is **Active** (green status)
6. If not deployed or failed, trigger a new deployment

### Step 2: Send Test Webhook from Stripe

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. Click **"Send test webhook"** button (top right)
4. In the modal:
   - **Select event**: Choose `checkout.session.completed`
   - Click **"Send test webhook"**
5. You should see:
   - ✅ Green checkmark if successful
   - Or error message if failed

### Step 3: Check Railway Logs

**Option A: Railway Dashboard**
1. Go to Railway Dashboard → knowledge-base service
2. Click **Logs** tab
3. Look for messages like:
   ```
   [Stripe Webhook] Received event: checkout.session.completed
   [Stripe Webhook] Processing checkout.session.completed for session: ...
   ```

**Option B: Railway CLI**
```powershell
# Link to app service first
railway service

# Then check logs
railway logs --tail 50
```

### Step 4: Verify Data Created

After sending test webhook, check if data was created:

```powershell
npx tsx scripts/test-stripe-webhook.ts
```

This will show:
- Recent payments (should be > 0 if webhook worked)
- Recent subscriptions (should be > 0 if webhook worked)

## Expected Results

### ✅ Success Indicators:
- Stripe shows webhook was sent successfully
- Railway logs show webhook received and processed
- Database has new payment/subscription records
- No errors in Railway logs

### ❌ Failure Indicators:
- Stripe shows webhook failed (red X)
- Railway logs show errors
- 404 or 500 errors in logs
- No data created in database

## Troubleshooting

### Webhook Returns 404
- **Cause**: App not deployed or route not accessible
- **Fix**: Deploy app in Railway Dashboard

### Webhook Returns 500
- **Cause**: Missing STRIPE_WEBHOOK_SECRET or invalid signature
- **Fix**: Verify STRIPE_WEBHOOK_SECRET is set correctly in Railway

### Webhook Succeeds but No Data
- **Cause**: Database connection issue or handler error
- **Fix**: Check Railway logs for specific error messages

### Can't See Logs
- **Cause**: Railway CLI linked to wrong service
- **Fix**: Run `railway service` and select knowledge-base (not Postgres)

## Quick Test Command

After setting up, run this to verify everything:

```powershell
# 1. Test configuration
npx tsx scripts/test-stripe-webhook.ts

# 2. Send test webhook from Stripe Dashboard

# 3. Check logs
railway logs --tail 50

# 4. Verify data again
npx tsx scripts/test-stripe-webhook.ts
```

