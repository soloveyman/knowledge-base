# Authentication Testing Guide

## Quick Start

Before deploying to production, test the sign up and sign in flow.

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server should be running at `http://localhost:3000`

2. **Ensure database is running:**
   ```bash
   npm run docker:up
   ```

## Automated Tests

### Run Full Authentication Test Suite

```bash
npm run test:auth
```

This will test:
- ✅ Registration (Sign Up)
- ✅ Login (Sign In) with new user
- ✅ Registration with existing email
- ✅ Invalid login credentials
- ✅ Registration validation (email format, password length)
- ✅ Rate limiting on registration

### Manual Testing Steps

#### 1. Test Registration (Sign Up)

1. Navigate to: `http://localhost:3000/auth/signin`
2. Click "No account? Sign up"
3. Fill in the form:
   - **Name**: Test User
   - **Email**: `test@example.com`
   - **Password**: `testpassword123` (at least 8 characters)
4. Click "Sign Up"
5. **Expected**: Should redirect to `/owner` dashboard after successful registration

#### 2. Test Login (Sign In)

1. Navigate to: `http://localhost:3000/auth/signin`
2. Enter credentials:
   - **Email**: `test@example.com`
   - **Password**: `testpassword123`
3. Click "Sign In"
4. **Expected**: Should redirect to `/owner` dashboard

#### 3. Test Invalid Login

1. Navigate to: `http://localhost:3000/auth/signin`
2. Enter invalid credentials:
   - **Email**: `nonexistent@test.com`
   - **Password**: `wrongpassword`
3. Click "Sign In"
4. **Expected**: Should show error "Invalid email or password"

#### 4. Test Registration Validation

**Test Invalid Email:**
1. Navigate to: `http://localhost:3000/auth/signin`
2. Click "No account? Sign up"
3. Enter invalid email: `not-an-email`
4. **Expected**: Should show validation error

**Test Short Password:**
1. Enter password less than 8 characters: `short`
2. **Expected**: Should show error "Password must be at least 8 characters"

**Test Existing Email:**
1. Try to register with an email that already exists
2. **Expected**: Should handle gracefully (might auto-login if password matches, or show error)

#### 5. Test Rate Limiting

1. Try to register 6 times rapidly with different emails
2. **Expected**: After 5 attempts, should get rate limited (429 status)

#### 6. Test Honeypot Field

1. Open browser developer tools
2. Find the hidden honeypot field: `<input name="website" style="display: none">`
3. Fill it with any value using DevTools
4. Try to submit the form
5. **Expected**: Should show "Invalid request" error

## Testing Checklist

Before deploying to production, verify:

- [ ] Registration works with valid credentials
- [ ] Login works with registered user
- [ ] Invalid login shows appropriate error
- [ ] Registration validation works (email format, password length)
- [ ] Existing email registration is handled properly
- [ ] Rate limiting works (try multiple rapid requests)
- [ ] Honeypot field catches bots
- [ ] Session persists after login
- [ ] User is redirected to correct dashboard based on role
- [ ] No console errors during auth flow

## Common Issues

### Error: "Failed to parse URL from /pipeline"

**Cause**: `NEXTAUTH_URL` environment variable is not set in Vercel.

**Fix**: Set `NEXTAUTH_URL=https://uppstaff.vercel.app` in Vercel environment variables.

### Error: "Too many registration attempts"

**Cause**: Rate limiting is working (this is expected).

**Fix**: Wait 15 minutes or use a different IP address.

### Error: "Invalid email or password"

**Cause**: User doesn't exist or password is incorrect.

**Fix**: Check database for user or register a new account.

## Production Deployment Checklist

After local testing passes:

- [ ] Set `NEXTAUTH_URL` in Vercel environment variables
- [ ] Set `NEXTAUTH_SECRET` in Vercel environment variables
- [ ] Optionally: Set Upstash Redis credentials for distributed rate limiting
- [ ] Deploy to production
- [ ] Test sign up/sign in on production
- [ ] Monitor Vercel logs for any errors

## Test Results

After running `npm run test:auth`, you should see:

```
✅ Registration (Sign Up): PASSED
✅ Login (Sign In) with New User: PASSED
✅ Registration with Existing Email: PASSED
✅ Invalid Login Credentials: PASSED
✅ Registration Validation: PASSED
✅ Registration Rate Limiting: PASSED

📊 Results: 6/6 tests passed
✅ All authentication tests passed! Ready for production deployment.
```

## Troubleshooting

If tests fail:

1. **Check server is running**: `npm run dev`
2. **Check database is accessible**: `npm run db:health`
3. **Check environment variables**: Ensure `.env.local` has correct values
4. **Check browser console**: Look for client-side errors
5. **Check server logs**: Look for server-side errors

