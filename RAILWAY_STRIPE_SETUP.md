# Railway Database Sync & Stripe Setup Guide

This guide helps you sync your local database schema to Railway and verify Stripe integration is properly configured.

## Quick Start

### 1. Set Railway Database URL

**Step 1: Get your Railway PostgreSQL connection string**
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your **PostgreSQL service**
3. Go to the **Variables** tab
4. Find `DATABASE_URL` and click **Copy** (or copy the connection string shown)

**Step 2: Set it locally (choose one method):**

**Method A: Create/Edit `.env.local` file (Recommended)**
1. In your project root (`D:\nowledgeBase\knowledge-base`), create or edit `.env.local`
2. Add this line (replace with your actual Railway connection string):
```env
DATABASE_URL="postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway"
```

**Method B: Set in PowerShell session (Temporary - only for current terminal)**
```powershell
$env:DATABASE_URL="postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway"
```

**Note:** Method A is better because the variable persists. Method B only works for the current PowerShell window.

### 2. Sync Database Schema to Railway

Run the sync script which will:
- ✅ Test database connection
- ✅ Run all migrations
- ✅ Verify Stripe tables (subscriptions, payments, subscription_plans)
- ✅ Check table structure

```bash
npm run db:sync:railway
```

**Alternative: Use migrations directly**
```bash
npm run db:migrate:railway
```

**Alternative: Use drizzle-kit push (for quick schema sync)**
```bash
npm run db:push
```

### 3. Verify Stripe Configuration

#### Required Environment Variables in Railway

Set these in Railway Dashboard → Your App Service → Variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard)

# Database (already set from PostgreSQL service)
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=https://your-app.railway.app
NEXTAUTH_SECRET=your-secret-key
```

#### Get Stripe Webhook Secret

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Create or select your webhook endpoint
3. Set endpoint URL to: `https://your-app.railway.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to Railway as `STRIPE_WEBHOOK_SECRET`

### 4. Verify Database Tables

After syncing, verify all Stripe-related tables exist:

```sql
-- Connect to Railway database
railway connect postgres

-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscriptions', 'payments', 'subscription_plans')
ORDER BY table_name;
```

Expected output:
```
subscription_plans
subscriptions
payments
```

### 5. Test Stripe Integration

#### Test Webhook Locally (Development)

```bash
# Start local server
npm run dev

# In another terminal, forward Stripe webhooks
npm run stripe:webhook
```

#### Verify Stripe Setup

```bash
npm run verify:stripe
```

## Database Schema Overview

### Stripe-Related Tables

#### `subscription_plans`
Stores available subscription plans (trial, starter, pro, etc.)
- `id` (uuid)
- `name` (text) - 'trial', 'starter', 'pro'
- `display_name` (text)
- `price` (integer) - in cents
- `max_users`, `max_imports_per_month`, etc.

#### `subscriptions`
Stores user subscriptions linked to Stripe
- `id` (uuid)
- `user_id` (uuid) - references users.id
- `plan_id` (uuid) - references subscription_plans.id
- `status` (text) - 'active', 'cancelled', 'expired'
- `current_period_start`, `current_period_end` (timestamp)
- `cancel_at_period_end` (boolean)
- `stripe_subscription_id` (text) - Stripe subscription ID

#### `payments`
Stores payment records from Stripe
- `id` (uuid)
- `owner_id` (uuid) - references users.id
- `subscription_id` (uuid) - references subscriptions.id
- `provider` (text) - 'stripe'
- `provider_payment_id` (text) - Stripe invoice/session ID
- `amount` (integer) - in cents
- `currency` (text)
- `status` (text) - 'pending', 'completed', 'failed', 'refunded'
- `metadata` (json) - additional Stripe data

## Webhook Events Handled

The webhook handler (`app/api/stripe/webhook/route.ts`) processes:

1. **`checkout.session.completed`**
   - Creates/updates subscription
   - Creates payment record
   - Creates user account (for guest checkout)

2. **`customer.subscription.updated`**
   - Updates subscription status
   - Updates period dates

3. **`customer.subscription.deleted`**
   - Marks subscription as expired

4. **`invoice.payment_succeeded`**
   - Creates/updates payment record
   - Links to subscription

5. **`invoice.payment_failed`**
   - Marks payment as failed
   - Logs failure for retry

## Troubleshooting

### Migration Fails

**Error: "SSL connection required"**
- Railway requires SSL. The script handles this automatically.
- If using manual connection, add: `?sslmode=require`

**Error: "Connection timeout"**
- Check Railway service is running
- Verify DATABASE_URL is correct
- Check Railway service logs

### Stripe Webhook Not Working

**Error: "Signature verification failed"**
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Ensure webhook endpoint URL is correct
- Check that raw body is being sent (Next.js handles this)

**Webhook not receiving events**
- Verify endpoint URL in Stripe Dashboard
- Check Railway deployment URL
- Test with Stripe CLI: `stripe listen --forward-to https://your-app.railway.app/api/stripe/webhook`

### Tables Missing After Sync

If tables are missing:
1. Check migration files exist in `drizzle/` folder
2. Verify schema file (`lib/db/schema.ts`) includes all tables
3. Run sync again: `npm run db:sync:railway`
4. Check Railway logs for errors

## Next Steps

1. ✅ Database synced to Railway
2. ✅ Stripe tables verified
3. ✅ Environment variables set in Railway
4. ✅ Webhook endpoint configured in Stripe
5. ⏭️ Seed subscription plans: `npm run setup:trial && npm run setup:starter && npm run setup:pro`
6. ⏭️ Test checkout flow
7. ⏭️ Monitor webhook events in Stripe Dashboard

## Useful Commands

```bash
# Database
npm run db:sync:railway          # Sync schema with verification
npm run db:migrate:railway         # Run migrations only
npm run db:push                    # Quick schema push
npm run db:studio                  # Open Drizzle Studio

# Stripe
npm run verify:stripe              # Verify Stripe configuration
npm run stripe:webhook             # Forward webhooks locally

# Setup
npm run setup:trial                # Create trial plan
npm run setup:starter              # Create starter plan
npm run setup:pro                  # Create pro plan
```

## Railway-Specific Notes

- **SSL**: Railway requires SSL for all connections (handled automatically)
- **Connection Pooling**: Max 10 connections (configured in `lib/db/index.ts`)
- **Backups**: Railway provides automatic backups (daily on Hobby plan)
- **Scaling**: Database can be resized in Railway Dashboard

## Support

- [Railway Docs](https://docs.railway.app/databases/postgresql)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

