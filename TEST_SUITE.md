# Test Suite Documentation

This document describes the comprehensive test suite for the application.

## Available Test Suites

### 1. Smoke Test (`test:smoke`)
Tests basic database integrity and data relationships.

**Run:** `npm run test:smoke`

**What it tests:**
- At least 3 users exist (owner, manager, employee)
- Modules exist
- Documents exist for modules
- Tests exist for modules
- Assignments can be created
- Test attempts can be recorded

### 2. Authentication Flow Test (`test:auth`)
Tests sign up and sign in functionality.

**Run:** `npm run test:auth`

**What it tests:**
- User registration
- Login with new user
- Registration with existing email (should fail)
- Invalid login credentials (should fail)
- Registration validation (email format, password length)
- Registration rate limiting

**Prerequisites:**
- Server must be running (`npm run dev`)
- Database must be running

### 3. Security & Rate Limiting Test (`test:security`)
Tests security headers, rate limiting, and build checks.

**Run:** `npm run test:security`

**What it tests:**
- TypeScript type checking
- ESLint checks
- Security headers (HSTS, X-Frame-Options, etc.)
- Honeypot field detection
- Registration rate limiting
- API rate limiting (middleware)
- Production build

### 4. Account Deletion Test (`test:account-deletion`)
Tests account deletion functionality and data cleanup.

**Run:** `npm run test:account-deletion`

**What it tests:**
- Account deletion API endpoint exists
- All related data is deleted:
  - Users in business
  - Modules and module versions
  - Sections
  - Documents and document images
  - Questions
  - Tests
  - User groups and members
  - Assignments and assignment users
  - Test attempts
  - Progress records
  - Usage records
  - Subscriptions
  - Payments
  - Auth records (sessions, accounts, tokens)

### 5. All Tests (`test:all`)
Runs all test suites in sequence.

**Run:** `npm run test:all`

**What it does:**
- Runs all test suites listed above
- Provides a comprehensive summary
- Exits with code 0 if all tests pass, 1 if any fail

## Running Tests

### Individual Test Suite
```bash
npm run test:smoke
npm run test:auth
npm run test:security
npm run test:account-deletion
```

### All Tests
```bash
npm run test:all
```

### Prerequisites
1. **Database must be running**
   - Local: `npm run docker:up` or ensure PostgreSQL is running
   - Production: Ensure database connection is configured

2. **Server must be running** (for API tests)
   - Development: `npm run dev`
   - Production: Ensure server is accessible

3. **Environment variables**
   - Ensure `.env` file is configured
   - Database connection string must be valid

## Test Results

All tests provide:
- ✅ Pass indicators
- ❌ Fail indicators
- Detailed error messages
- Summary statistics

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    npm run test:all
```

## Troubleshooting

### Tests Fail with Database Connection Error
- Ensure database is running
- Check database connection string in `.env`
- Verify database credentials

### Tests Fail with Server Not Running
- Start the development server: `npm run dev`
- Check if server is accessible at `http://localhost:3000`
- Verify `BASE_URL` environment variable if using custom URL

### Tests Fail with Authentication Errors
- Ensure test users exist in database
- Check authentication configuration
- Verify session handling

## Adding New Tests

To add a new test suite:

1. Create a new test file in `scripts/` directory
2. Follow the pattern of existing test files
3. Add the test script to `package.json`
4. Add the test to `test-all.ts` if it should run with all tests

Example:
```typescript
// scripts/test-new-feature.ts
async function main() {
  // Test logic here
  console.log('✅ Test passed')
  process.exit(0)
}

main().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
```

Then add to `package.json`:
```json
{
  "scripts": {
    "test:new-feature": "tsx scripts/test-new-feature.ts"
  }
}
```

