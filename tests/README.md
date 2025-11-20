# Production Build Tests

Comprehensive test suite for Next.js production build covering server-side responses, static/dynamic pages, sessions, cache, and best practices.

## Test Structure

```
tests/
├── api/
│   └── server-side.test.ts      # Server-side API route tests
├── pages/
│   ├── static-pages.test.ts      # Static page tests
│   └── dynamic-pages.test.ts    # Dynamic page tests
├── sessions/
│   └── cache.test.ts            # Session and cache tests
├── best-practices/
│   └── nextjs-practices.test.ts # Next.js best practices tests
└── integration/
    └── production-build.test.ts # Production build integration tests
```

## Authentication

Tests use a test user account for authenticated tests. Credentials can be set via environment variables:

```bash
export TEST_USER_EMAIL=test-user@example.com
export TEST_USER_PASSWORD=test-password-123
```

Or create a `.env` file in the `tests/` directory (see `tests/.env.example`).

**IMPORTANT**: Credentials must be set via environment variables. Never commit real credentials to git!

The helper will throw an error if credentials are not provided.

## Running Tests

### Prerequisites

1. **Build production build:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

3. **Install Playwright (if not already installed):**
   ```bash
   npx playwright install
   ```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# API tests only
npm run test:api

# Authenticated tests (requires test user)
npm run test:auth

# Page tests only
npm run test:pages

# Session/cache tests only
npm run test:sessions

# Best practices tests only
npm run test:practices

# Integration tests only
npm run test:integration
```

### Run with UI

```bash
npm run test:ui
```

### Run in Headed Mode

```bash
npm run test:headed
```

### Automated Production Test

```bash
# Builds, starts server, runs tests, and stops server
npm run test:prod
```

## Test Categories

### 1. Server-Side API Tests (`tests/api/server-side.test.ts`)

Tests that API routes:
- Return proper server-side responses
- Have correct security headers
- Handle authentication properly
- Return proper error responses
- Have correct content types
- Handle CORS correctly
- Have proper cache headers

### 2. Static Pages Tests (`tests/pages/static-pages.test.ts`)

Tests that static pages:
- Are properly pre-rendered
- Have correct meta tags
- Have security headers
- Load without JavaScript errors
- Have proper document structure
- Are cacheable

### 3. Dynamic Pages Tests (`tests/pages/dynamic-pages.test.ts`)

Tests that dynamic pages:
- Are server-rendered on demand
- Handle missing parameters gracefully
- Have proper error handling
- Respect authentication
- Have no-cache headers for user-specific content

### 4. Sessions and Cache Tests (`tests/sessions/cache.test.ts`)

Tests:
- Session cookie security (httpOnly, secure)
- Session persistence across navigations
- API response caching behavior
- Static asset caching
- Cache headers for different content types
- Session expiration
- CSRF protection

### 5. Next.js Best Practices Tests (`tests/best-practices/nextjs-practices.test.ts`)

Tests:
- Security headers configuration
- Compression enabled
- Image optimization
- Font preloading
- JavaScript code splitting
- CSS loading
- React Strict Mode
- API error handling
- SEO meta tags
- Static generation performance
- Server components usage
- Middleware functionality
- Environment variable security

### 6. Production Build Integration Tests (`tests/integration/production-build.test.ts`)

Tests:
- Optimized asset serving
- Correct NODE_ENV
- Console error removal
- Error page handling
- Concurrent request handling
- Response times
- Content type correctness
- Large payload handling

## Configuration

Tests use `playwright.config.ts` which:
- Sets base URL to `http://localhost:3000` (or `TEST_BASE_URL` env var)
- Automatically starts production server before tests
- Runs tests in parallel
- Generates HTML reports
- Supports multiple browsers (Chromium, Firefox, WebKit)

## Environment Variables

- `TEST_BASE_URL`: Override default test URL (default: `http://localhost:3000`)
- `CI`: Enable CI mode (reduces retries, uses single worker)

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Best Practices Tested

✅ **Security**
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- CSRF protection
- Session cookie security
- Environment variable protection

✅ **Performance**
- Static generation
- Code splitting
- Image optimization
- Font preloading
- Compression

✅ **Caching**
- Static asset caching
- API response caching
- Page caching strategies

✅ **Server-Side Rendering**
- Static page pre-rendering
- Dynamic page on-demand rendering
- API route server-side validation

✅ **Next.js Features**
- Middleware
- Server components
- React Strict Mode
- Error handling

## Continuous Integration

These tests are designed to run in CI/CD pipelines. Set `CI=true` environment variable for CI-optimized settings.

```bash
CI=true npm run test:prod
```

## Troubleshooting

### Tests fail with "Connection refused"

Make sure production server is running:
```bash
npm run build
npm start
```

### Tests timeout

Increase timeout in `playwright.config.ts` or check server is responding:
```bash
curl http://localhost:3000/api/health
```

### Tests fail due to authentication

Some tests expect unauthenticated state. For authenticated tests, you may need to set up test users or mock authentication.

## Writing New Tests

When adding new tests:

1. **Place in appropriate directory:**
   - API tests → `tests/api/`
   - Page tests → `tests/pages/`
   - Session tests → `tests/sessions/`
   - Best practices → `tests/best-practices/`
   - Integration → `tests/integration/`

2. **Follow naming convention:**
   - `*.test.ts` for test files
   - Use descriptive test names

3. **Test server-side behavior:**
   - Use `request` API for API tests
   - Use `page` API for page tests
   - Check headers, status codes, response bodies

4. **Test best practices:**
   - Security headers
   - Performance optimizations
   - Caching strategies
   - Error handling

