# Deploy Database Changes Separately

Yes! You can update your Railway database schema independently of deploying your app code.

## Methods

### Method 1: Using Migration Scripts (Recommended)

**For existing migrations:**
```powershell
# Set Railway DATABASE_URL in .env.local first
npm run db:migrate:railway
```

**For schema sync (pushes current schema):**
```powershell
npm run db:sync:railway
```

### Method 2: Using Drizzle Push (Quick Schema Sync)

**Syncs your current schema directly:**
```powershell
# Make sure DATABASE_URL in .env.local points to Railway
npm run db:push
```

### Method 3: Manual Migration

**If you have new migration files:**
```powershell
# 1. Generate migrations from schema changes
npm run db:generate

# 2. Apply to Railway
npm run db:migrate:railway
```

## When to Deploy DB Separately

✅ **Good reasons:**
- Schema changes that don't require code changes
- Adding new columns/tables before deploying code that uses them
- Database maintenance/migrations
- Testing schema changes before deploying app

❌ **Avoid:**
- Breaking schema changes that require immediate code updates
- Changes that make existing app code incompatible

## Best Practices

### 1. **Deploy DB First, Then Code**
```
Step 1: Deploy database changes
Step 2: Wait for migration to complete
Step 3: Deploy app code that uses new schema
```

### 2. **Use Migrations for Production**
- Use `db:migrate:railway` for production (tracks migration history)
- Use `db:push` for quick development/testing

### 3. **Test Locally First**
```powershell
# Test migration locally
npm run db:migrate

# Then apply to Railway
npm run db:migrate:railway
```

### 4. **Backup Before Major Changes**
```powershell
# Railway provides automatic backups, but you can also:
railway connect postgres
pg_dump -U postgres railway > backup.sql
```

## Current Setup

Your `railway.json` currently runs migrations on every app deploy:
```json
{
  "deploy": {
    "startCommand": "npm run db:migrate:railway && npm start"
  }
}
```

**This means:**
- ✅ Migrations run automatically on app deploy (safe)
- ✅ You can also run them separately when needed
- ✅ Migrations are idempotent (safe to run multiple times)

## Quick Reference

| Command | Use Case | When |
|---------|----------|------|
| `npm run db:migrate:railway` | Apply existing migrations | After generating migrations |
| `npm run db:sync:railway` | Sync current schema + verify | Quick schema updates |
| `npm run db:push` | Direct schema push | Development/testing |
| `npm run db:generate` | Create migration files | After schema changes |

## Example Workflow

**Scenario: Adding a new column**

1. **Update schema** (`lib/db/schema.ts`)
2. **Generate migration:**
   ```powershell
   npm run db:generate
   ```
3. **Deploy to Railway:**
   ```powershell
   npm run db:migrate:railway
   ```
4. **Verify:**
   ```powershell
   npx tsx scripts/verify-stripe-complete.ts
   ```
5. **Deploy app code** (when ready)

## Important Notes

- ⚠️ **Breaking changes**: If you remove columns/tables, deploy app code immediately after DB changes
- ✅ **Additive changes**: Safe to deploy DB first, then code later
- 🔒 **Backup**: Railway auto-backups, but consider manual backup for major changes
- 🧪 **Test**: Always test migrations locally first

