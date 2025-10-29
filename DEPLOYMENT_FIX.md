# Railway Deployment Fix - Dependency Conflict

## Problem
Build fails with `ERESOLVE` error: `next-auth@5.0.0-beta.29` requires Next.js 14-15, but project uses Next.js 16.

## Solution Applied

### Option 1: Railway Config File (Recommended)
Created `railway.json` that explicitly sets the build command with `--legacy-peer-deps` flag.

**File created:** `railway.json`

Railway will automatically read this file and use the specified build command.

### Option 2: Manual Railway Dashboard Setting

If `railway.json` doesn't work, set this manually in Railway:

1. Go to your **app service** in Railway dashboard
2. Click **Settings**
3. Under **Build & Deploy**, set **Build Command** to:
   ```bash
   npm ci --legacy-peer-deps && npm run build
   ```
4. Save and redeploy

### Option 3: Ensure `.npmrc` is Committed

Make sure `.npmrc` is committed to your repository:

```bash
git add .npmrc
git commit -m "Add .npmrc for legacy peer deps"
git push
```

## Files Created/Updated

✅ `.npmrc` - Configures npm to use legacy peer deps  
✅ `railway.json` - Explicit Railway build configuration  

## Next Steps

1. **Commit and push both files:**
   ```bash
   git add .npmrc railway.json
   git commit -m "Fix Railway build: handle next-auth peer dependency conflict"
   git push
   ```

2. **Trigger new Railway deployment** (happens automatically on push if connected to Git)

3. **Monitor the build** - It should now succeed

## Verification

After deployment succeeds, you can verify with:
```bash
# Check health endpoint
curl https://your-app.railway.app/api/health
```

## Why This Works

- `--legacy-peer-deps` tells npm to use the old (less strict) peer dependency resolution algorithm
- This allows `next-auth@5.0.0-beta.29` (which expects Next.js 14-15) to work with Next.js 16
- This is safe because Next.js 16 is backward compatible with the Next.js 15 API that next-auth uses

## Long-term Fix

When `next-auth` releases a stable version that officially supports Next.js 16, you can:
1. Update `next-auth` to the latest version
2. Remove `railway.json` (or update build command)
3. Remove or update `.npmrc` if no longer needed

