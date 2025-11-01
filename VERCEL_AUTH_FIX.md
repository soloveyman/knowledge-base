# Fixing NextAuth URL Parsing Error on Vercel

## Problem

The error `TypeError: Failed to parse URL from /pipeline` occurs because NextAuth is trying to construct callback URLs without a proper base URL.

## Root Cause

NextAuth needs to know the base URL of your application to construct callback URLs. Even with `trustHost: true`, there are cases where NextAuth still needs an explicit `NEXTAUTH_URL`.

## Solution

### 1. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and set:

```
NEXTAUTH_URL=https://uppstaff.vercel.app
NEXTAUTH_SECRET=<your-secret-key>
```

**Important:**
- Do NOT include a trailing slash: `https://uppstaff.vercel.app` ✅ (correct)
- Do NOT use: `https://uppstaff.vercel.app/` ❌ (wrong)

### 2. For Custom Domain

If you have a custom domain, use that instead:

```
NEXTAUTH_URL=https://your-custom-domain.com
```

### 3. Verify Environment Variables

After setting the variables:
1. Redeploy your application
2. Check Vercel logs to ensure the variables are loaded
3. Test the login flow

## Current Configuration

The code is already configured with:
- ✅ `trustHost: true` - Allows NextAuth to use request headers as fallback
- ✅ Error handling with detailed logging
- ✅ Automatic fallback to `VERCEL_URL` if `NEXTAUTH_URL` is not set

## Testing

After setting `NEXTAUTH_URL`:
1. Try logging in
2. Check Vercel logs for any remaining errors
3. The error should be resolved

## Additional Notes

- The `trustHost: true` option should work, but having `NEXTAUTH_URL` explicitly set is more reliable
- Vercel automatically provides `VERCEL_URL` environment variable, but it's better to use your production URL
- Make sure to set these variables for all environments (Production, Preview, Development)

