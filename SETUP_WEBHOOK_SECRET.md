# Setup STRIPE_WEBHOOK_SECRET

## Quick Steps

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/webhooks

2. **Create or Select Webhook Endpoint:**
   - Click **+ Add endpoint**
   - **Endpoint URL**: `https://knowledge-base.up.railway.app/api/stripe/webhook`
   - **Description**: Railway Production Webhook

3. **Select Events:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

4. **Get Signing Secret:**
   - Click on your webhook endpoint
   - Click **Reveal** next to "Signing secret"
   - Copy the secret (starts with `whsec_`)

5. **Set in Railway:**

   **Option A: Railway Dashboard**
   - Go to Railway Dashboard → knowledge-base service → Variables
   - Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...`

   **Option B: Railway CLI**
   ```powershell
   railway variables --set "STRIPE_WEBHOOK_SECRET=whsec_..."
   ```

6. **Railway will auto-redeploy** after adding the variable

## Verify

After setting, verify it's configured:

```powershell
railway variables --json | ConvertFrom-Json | Select-Object STRIPE_WEBHOOK_SECRET
```

## Test Webhook

Once set, you can test in Stripe Dashboard:
1. Go to your webhook endpoint
2. Click **Send test webhook**
3. Select event type (e.g., `checkout.session.completed`)
4. Check Railway logs to see if it was received

