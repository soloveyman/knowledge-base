# Railway Build Fix - Immediate Steps

## The Problem
Railway is running `npm ci` without `--legacy-peer-deps`, causing the build to fail.

## ⚡ Quick Fix (Do This Now)

### Option 1: Railway Dashboard (Fastest - 2 minutes)

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Click on your **app service** (not the database service)

2. **Open Settings**
   - Click the **Settings** tab at the top

3. **Update Build Command**
   - Scroll to **Build & Deploy** section
   - Find **Build Command** field
   - Replace with:
     ```bash
     npm ci --legacy-peer-deps && npm run build
     ```
   - Click **Save**

4. **Redeploy**
   - Go to **Deployments** tab
   - Click **Redeploy** or push a new commit to trigger deployment

### Option 2: Check railway.json is Committed

Make sure `railway.json` is committed to your repo:

```bash
# Check if it's tracked
git status

# If not, add it
git add railway.json .npmrc
git commit -m "Fix Railway build command"
git push
```

Then trigger a new deployment.

## ✅ Verification

After redeploy:
- Build step should complete successfully
- Deploy step should start
- Your app should be live

## Why This Happens

Railway's default `npm ci` command doesn't use `--legacy-peer-deps` even if `.npmrc` exists. You need to explicitly set it in:
- `railway.json` (if Railway detects it), OR
- Railway dashboard Settings (most reliable)

## Current Status

✅ `.npmrc` created (for local dev)  
✅ `railway.json` created (should work on next deploy)  
⚠️ **Manual dashboard setting recommended for immediate fix**

