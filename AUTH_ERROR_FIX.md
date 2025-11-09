# Fixing "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" Error

This error occurs when the auth API endpoint returns HTML instead of JSON, usually due to:

1. **Database not running** (most common after Docker setup)
2. **Missing or incorrect DATABASE_URL**
3. **Missing NEXTAUTH_URL**

## Quick Fix

### 1. Start Docker Database

```bash
npm run docker:up
```

Wait for the database to be ready (check with `docker ps`).

### 2. Verify DATABASE_URL

Check your `.env.local` file has:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"
```

If missing, run:
```bash
npm run db:setup:docker
```

### 3. Verify NEXTAUTH_URL

Check your `.env.local` file has:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 4. Restart Dev Server

After setting environment variables, **always restart** your dev server:

```bash
# Stop server (Ctrl+C)
# Then restart
npm run dev
```

## Verify Setup

1. **Check Docker is running:**
   ```bash
   docker ps
   ```
   Should show `knowledge-base-db` container running.

2. **Test database connection:**
   ```bash
   npm run db:health
   ```

3. **Check environment variables:**
   ```bash
   npm run check:env
   ```

## Common Issues

### Database Connection Refused
- **Symptom**: `ECONNREFUSED` errors
- **Fix**: Start Docker database with `npm run docker:up`

### DATABASE_URL Not Set
- **Symptom**: "DATABASE_URL environment variable is required"
- **Fix**: Run `npm run db:setup:docker` or manually set in `.env.local`

### NEXTAUTH_URL Not Set
- **Symptom**: URL parsing errors
- **Fix**: Set `NEXTAUTH_URL="http://localhost:3000"` in `.env.local` and restart server

### Port Already in Use
- **Symptom**: Docker container won't start
- **Fix**: Change port in `docker-compose.yml` or stop other PostgreSQL instances

## After Fixing

The auth route now:
- ✅ Always returns JSON (never HTML)
- ✅ Provides helpful error messages
- ✅ Detects database connection errors
- ✅ Detects missing NEXTAUTH_URL

If you still see the error, check the browser console and server logs for specific error messages.

