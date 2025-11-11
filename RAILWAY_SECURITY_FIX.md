# Railway Security Warnings Fix

## The Problem

Railway's Docker scanner is warning about:
1. **SecretsUsedInArgOrEnv**: `GROK_API_KEY` and `NEXTAUTH_SECRET` are being used as build-time ARG/ENV
2. **UndefinedVar**: `$NIXPACKS_PATH` is undefined

These secrets should **only** be runtime environment variables, not build-time variables.

## Why This Matters

- Build-time ARG values are visible in Docker image history
- Build-time ENV values can be exposed in image layers
- Secrets should never be baked into the image

## ✅ Solution: Configure Railway Environment Variables

### Step 1: Verify Variables in Railway Dashboard

1. Go to Railway Dashboard → Your Project → Your Service
2. Click **Variables** tab
3. Ensure these are set as **Runtime Variables** (not build-time):
   - `GROK_API_KEY`
   - `NEXTAUTH_SECRET`
   - Any other secrets

### Step 2: Remove from Build-Time (if present)

If Railway is auto-detecting these as build-time variables:

1. In Railway Dashboard → Service → Settings
2. Check **Build** section
3. Ensure no build-time environment variables include secrets
4. Secrets should only be in **Variables** tab (runtime)

### Step 3: Verify Next.js Doesn't Need Them at Build Time

Your `next.config.ts` doesn't access these secrets at build time, which is correct. They're only needed at runtime.

## About the `$NIXPACKS_PATH` Warning

This is an internal Nixpacks variable issue. It doesn't affect functionality but indicates Nixpacks might be referencing a variable that doesn't exist. This is a Nixpacks bug and can be safely ignored, or you can:

- Use a custom Dockerfile instead of Nixpacks (more control)
- Wait for Nixpacks update that fixes this

## Verification

After fixing:
1. Redeploy your service
2. Check build logs - warnings should be gone or reduced
3. Verify app works correctly (secrets are available at runtime)

## Alternative: Use Custom Dockerfile

If warnings persist, you can switch from Nixpacks to a custom Dockerfile:

1. ✅ `Dockerfile` has been created in project root
2. Update `railway.json` to use `DOCKERFILE` builder:
   ```json
   {
     "build": {
       "builder": "DOCKERFILE"
     }
   }
   ```
3. This gives you full control over build process and eliminates Nixpacks warnings

**Note**: The Dockerfile uses Next.js standalone output mode, which requires `output: 'standalone'` in `next.config.ts` (already added).

