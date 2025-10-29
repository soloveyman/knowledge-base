# Railway Database Integration Guide

Complete guide for integrating your Knowledge Base application with Railway PostgreSQL database.

## Overview

Railway provides managed PostgreSQL databases that can be easily integrated with your Next.js application. This guide covers setup, configuration, migrations, and best practices.

## Prerequisites

- Railway account (sign up at [railway.app](https://railway.app))
- Railway CLI installed (optional, but recommended)
- Your application already configured with Drizzle ORM and PostgreSQL

## Step 1: Create Railway Database

### Option A: Via Railway Web Dashboard

1. **Create a New Project**
   - Go to [railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo" (or "Empty Project")
   - Name your project (e.g., "knowledge-base")

2. **Add PostgreSQL Service**
   - In your project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically provision a PostgreSQL instance

3. **Get Connection String**
   - Click on the PostgreSQL service
   - Go to the "Variables" tab
   - Copy the `DATABASE_URL` value (or `POSTGRES_URL`, depending on Railway version)
   - Format: `postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway`

### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create new project
railway init

# Add PostgreSQL
railway add --database postgres

# Get connection string
railway variables
```

## Step 2: Configure Environment Variables

### Production Environment (Railway)

1. **In Railway Dashboard:**
   - Go to your project → PostgreSQL service → Variables tab
   - The `DATABASE_URL` is automatically set
   - Copy this value for your application service

2. **In Your Application Service:**
   - Create a new service (or use existing)
   - Go to Variables tab
   - Add `DATABASE_URL` and paste the PostgreSQL connection string
   - Add other required variables:
     ```
     DATABASE_URL=<from_postgres_service>
     NEXTAUTH_URL=<your_app_url>
     NEXTAUTH_SECRET=<generate_strong_secret>
     ```

### Local Development

Update your `.env.local`:

```env
# Railway Database (use your actual connection string)
DATABASE_URL="postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway"

# Or use local database for development
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-local-secret-key"
```

**Security Note:** Never commit `.env.local` to git. Railway connection strings contain sensitive credentials.

## Step 3: Test Connection

Test your Railway database connection:

```bash
# Using your existing test script
npm run test-db  # if you have this script

# Or manually test
npx tsx scripts/test-database-connection.ts
```

Expected output:
```
✅ Database connection successful!
✅ PostgreSQL version: PostgreSQL XX.X on...
```

## Step 4: Run Migrations

### Initial Migration (First Time Setup)

```bash
# Generate migration from your schema
npm run db:generate  # or: drizzle-kit generate

# Push migrations to Railway database
npm run db:push      # or: drizzle-kit push
```

### Using Railway Migration Script (Recommended)

A Railway-specific migration script is included in `scripts/migrate-railway.ts`:

```bash
# Run Railway migrations
npm run db:migrate:railway
```

This script:
- ✅ Tests connection before migrating
- ✅ Uses optimized connection pool settings
- ✅ Handles SSL configuration automatically
- ✅ Provides detailed error messages
- ✅ Masks passwords in logs

### Using Drizzle Migrate (Alternative)

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate   # or: drizzle-kit migrate
```

### Migration Strategy

**For Railway production:**
1. Use the included `migrate-railway.ts` script for optimized migrations
2. Store migration files in your repository
3. Run migrations as part of deployment process

The migration script is located at `scripts/migrate-railway.ts` and handles all Railway-specific optimizations automatically.

## Step 5: Connection Pooling Considerations

Railway PostgreSQL has connection limits. Optimize your pool configuration:

### Database Connection Configuration

The database connection in `lib/db/index.ts` is already optimized for Railway:

✅ Connection pooling (max: 10 connections)  
✅ SSL configuration for production  
✅ Connection timeouts configured  
✅ Graceful shutdown handlers  
✅ Error handling and monitoring  
✅ Debug logging (enable with `DEBUG_DB=true`)

The connection pool is configured in `lib/db/index.ts` with Railway-optimized settings. 

**Connection Limits by Railway Tier:**
- **Hobby**: ~20 connections
- **Pro**: ~100 connections
- **Enterprise**: Custom limits

### Connection Pooling Service (For High Traffic)

For production apps with high traffic, consider Railway's built-in connection pooling:

1. Railway provides connection pooling via `postgresql://` vs direct connections
2. Some Railway instances include pooling automatically
3. For manual pooling, use `pgbouncer` or Railway's pooler

**Using Railway's Pooler (if available):**
```env
# Use pooled connection string (if provided by Railway)
DATABASE_URL="postgresql://postgres:PASSWORD@pooler.railway.app:PORT/railway?pgbouncer=true"
```

## Step 6: Deployment Configuration

### Railway Deployment Settings

1. **Build Command:**
   ```bash
   npm ci && npm run build
   ```
   
   **Note:** If you encounter peer dependency conflicts (e.g., next-auth with Next.js 16), the `.npmrc` file in the project root is configured with `legacy-peer-deps=true` to handle this. Railway will automatically use this configuration.

2. **Start Command:**
   ```bash
   npm start
   ```

3. **Run Migrations on Deploy:**
   
   Update `package.json`:
   ```json
   {
     "scripts": {
       "deploy": "npm run db:migrate && npm start",
       "db:migrate": "drizzle-kit migrate"
     }
   }
   ```

   Or use Railway's deploy hooks in `railway.json`:
   ```json
   {
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "npm install && npm run build"
     },
     "deploy": {
       "startCommand": "npm run migrate && npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

## Step 7: Database Backup & Recovery

### Automatic Backups

Railway provides automatic backups:
- **Hobby Plan**: Daily backups (7-day retention)
- **Pro Plan**: Continuous backups (30-day retention)
- **Enterprise**: Custom backup schedule

### Manual Backup

```bash
# Export database
railway connect postgres
pg_dump -U postgres railway > backup.sql

# Or using connection string
pg_dump $DATABASE_URL > backup.sql
```

### Restore

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Or via Railway CLI
railway connect postgres < backup.sql
```

## Step 8: Environment-Specific Setup

### Local Development with Railway DB

For connecting local dev to Railway (useful for debugging):

```env
# .env.local
DATABASE_URL="<railway_connection_string>"
```

**Pros:** Test against production-like data structure
**Cons:** Network latency, shared database

### Recommended: Local + Railway

```env
# .env.local (local database)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"

# .env.production (Railway)
DATABASE_URL="<railway_connection_string>"
```

## Step 9: Monitoring & Debugging

### Railway Metrics

- **Dashboard**: View connection count, query performance
- **Logs**: Database logs available in Railway dashboard
- **Metrics**: CPU, memory, disk usage

### Database Health Check

A health check endpoint is included at `/api/health`:

```bash
# Test health check locally
npm run db:health

# Or manually
curl http://localhost:3000/api/health
```

The health check returns:
- Database connection status
- Database version and latency
- Environment information
- HTTP 200 if healthy, 503 if unhealthy

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": {
    "connected": true,
    "version": "PostgreSQL 15.1",
    "latency": 45
  },
  "environment": {
    "nodeEnv": "production",
    "hasDatabaseUrl": true
  }
}
```

### Adding Custom Health Checks

If you need to add additional health checks:

```typescript
// app/api/health/route.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', database: 'disconnected', error: error.message },
      { status: 503 }
    );
  }
}
```

### Query Performance

Enable query logging in development:

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Enable query logging in development
  ...(process.env.NODE_ENV === 'development' && {
    log: (msg) => console.log('[DB]', msg),
  }),
});

export const db = drizzle(pool, { schema });
```

## Step 10: Security Best Practices

1. **Never Commit Connection Strings**
   - Use Railway environment variables
   - Use `.env.local` for local (already in `.gitignore`)

2. **Rotate Credentials**
   - Railway allows password rotation
   - Update `DATABASE_URL` after rotation

3. **Network Security**
   - Railway databases have firewall rules
   - Restrict access to specific IPs if needed

4. **SSL/TLS**
   - Railway provides SSL connections by default
   - Configure `ssl: true` in production

5. **Connection String Format**
   ```typescript
   // Production: Always use SSL
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' 
       ? { rejectUnauthorized: false } 
       : false,
   });
   ```

## Step 11: Troubleshooting

### Common Issues

**Issue: Build fails with `ERESOLVE` dependency conflict**

**Error:** `npm error ERESOLVE: While resolving: next-auth@5.0.0-beta.29, Found: next@16.0.0`

**Solution:** The `.npmrc` file is already configured with `legacy-peer-deps=true` to handle this. Ensure the file is committed to your repository. Railway will automatically use this configuration during `npm ci`.

If the issue persists:
1. Verify `.npmrc` exists in project root
2. Manual build command workaround in Railway: `npm ci --legacy-peer-deps && npm run build`
3. Alternatively, update `next-auth` to a version compatible with Next.js 16 (check npm registry)

**Issue: Connection timeout**
```bash
# Solution: Increase timeout
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000, // 30 seconds
});
```

**Issue: Too many connections**
```bash
# Solution: Reduce pool size
max: 5, // Reduce from 10
```

**Issue: SSL connection error**
```bash
# Solution: Configure SSL
ssl: { rejectUnauthorized: false }
```

**Issue: Migration fails**
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Run migrations with verbose output
drizzle-kit migrate --verbose
```

### Connection String Validation

Test your connection string format:
```bash
# Should match pattern:
postgresql://[user]:[password]@[host]:[port]/[database]

# Railway format example:
postgresql://postgres:abcd1234@containers-us-west-123.railway.app:5432/railway
```

## Step 12: Migration from Local to Railway

1. **Export Local Database:**
   ```bash
   pg_dump postgresql://postgres:postgres@localhost:5432/knowledge_base > local_backup.sql
   ```

2. **Create Railway Database** (follow Step 1)

3. **Run Migrations on Railway:**
   ```bash
   DATABASE_URL="<railway_url>" npm run db:push
   ```

4. **Import Data (Optional):**
   ```bash
   psql $RAILWAY_DATABASE_URL < local_backup.sql
   ```

5. **Update Environment Variables:**
   - Update Railway service variables
   - Update local `.env.local` if needed

## Step 13: Railway-Specific Features

### Direct Database Access

```bash
# Via Railway CLI
railway connect postgres

# Opens psql shell directly connected to Railway database
```

### Database Extensions

Railway supports PostgreSQL extensions. Enable them:

```sql
-- Connect via Railway CLI or pgAdmin
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search
```

### Database Resizing

Railway allows easy database resizing:
- Go to PostgreSQL service → Settings → Resize
- Choose plan based on needs

## Summary Checklist

- [ ] Created Railway PostgreSQL database
- [ ] Copied `DATABASE_URL` from Railway
- [ ] Set environment variables in Railway app service
- [ ] Updated local `.env.local` if using Railway for dev
- [ ] Tested database connection
- [ ] Ran initial migrations (`npm run db:push`)
- [ ] Configured connection pooling (max: 10)
- [ ] Set up SSL for production
- [ ] Added health check endpoint
- [ ] Configured deployment to run migrations
- [ ] Set up monitoring/alerting
- [ ] Documented connection string locations

## Additional Resources

- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [pg Pool Configuration](https://node-postgres.com/api/pool)
- [Railway CLI Docs](https://docs.railway.app/develop/cli)

## Quick Reference Commands

```bash
# Railway CLI
railway login                    # Login to Railway
railway init                     # Initialize project
railway add --database postgres  # Add PostgreSQL
railway variables                # View env vars
railway connect postgres         # Connect to DB shell

# Database Management
npm run db:generate              # Generate migrations
npm run db:push                  # Push schema changes
npm run db:migrate               # Run Drizzle migrations
npm run db:migrate:railway       # Run Railway-optimized migrations
npm run db:studio                # Open Drizzle Studio
npm run db:health                # Check database health

# Connection Testing
npx tsx scripts/test-database-connection.ts
npx tsx scripts/check-health.ts  # Test health endpoint
```

## New Files Created

The following files were added for Railway integration:

1. **`scripts/migrate-railway.ts`** - Railway-optimized migration runner
2. **`scripts/check-health.ts`** - Health check testing script
3. **`app/api/health/route.ts`** - Health check API endpoint
4. **Updated `lib/db/index.ts`** - Railway-optimized connection pool

## Enabling Debug Logging

To enable database connection logging for debugging:

```bash
# In your .env.local or Railway environment variables
DEBUG_DB=true
```

This will log:
- New connections
- Connection removals
- Pool queries (in development)

