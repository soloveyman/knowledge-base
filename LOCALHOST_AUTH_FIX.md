# Fixing Authentication Error on Localhost

## Problem

Getting 500 error when trying to sign in/sign up on localhost:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
/api/auth/callback/credentials
```

## Quick Fix

### 1. Check/Create `.env.local` file

Make sure you have a `.env.local` file in your project root with:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_base
```

### 2. Restart Dev Server

After creating/updating `.env.local`:

1. Stop your dev server (Ctrl+C)
2. Start it again: `npm run dev`

### 3. Test Again

Try signing in/signing up again. The error should be resolved.

## Generate a Secret Key

If you need to generate a `NEXTAUTH_SECRET`:

```bash
# On Windows (PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString() + (New-Guid).ToString()))

# On Mac/Linux
openssl rand -base64 32
```

Or use any random string (minimum 32 characters for production).

## Verify It's Working

1. Check browser console - no more 500 errors
2. Try to sign up with a new account
3. Try to sign in with existing account
4. Check server logs - should see debug info showing NEXTAUTH_URL is set

## Debugging

If it still doesn't work:

1. **Check server logs** - look for:
   ```
   [NextAuth] POST request: { url: '...', host: '...', hasNEXTAUTH_URL: true/false }
   ```

2. **Verify .env.local is loaded**:
   - The file must be named `.env.local` (not `.env`)
   - Restart the dev server after changing it
   - Variables are loaded at server start

3. **Check Next.js console** - Should see warnings if NEXTAUTH_URL is missing

