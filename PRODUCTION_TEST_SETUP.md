# Production Build Test Setup

## Quick Start

1. **Install Playwright:**
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Set test user credentials (optional):**
   ```bash
   export TEST_USER_EMAIL=test-user@example.com
   export TEST_USER_PASSWORD=test-password-123
   ```
   
   Or create `tests/.env` file (see `tests/.env.example`).

3. **Build and start production server:**
   ```bash
   npm run build
   npm start
   ```

4. **Run tests:**
   ```bash
   npm test                    # All tests
   npm run test:auth          # Authenticated tests only
   ```

## Test Coverage

The test suite covers:

### ✅ Server-Side Responses
- API route server-side validation
- Proper error handling
- Security headers
- Content type correctness

### ✅ Static Pages
- Pre-rendering verification
- Meta tags
- Security headers
- Performance optimization

### ✅ Dynamic Pages
- On-demand rendering
- Authentication handling
- Error handling
- Cache headers

### ✅ Sessions & Cache
- Session cookie security
- Session persistence
- Cache strategies
- CSRF protection

### ✅ Next.js Best Practices
- Security headers
- Compression
- Image optimization
- Code splitting
- Server components
- Environment variable security

## Test Commands

```bash
# All tests
npm test

# Specific suites
npm run test:api          # API tests only
npm run test:pages         # Page tests only
npm run test:sessions      # Session/cache tests
npm run test:practices     # Best practices tests
npm run test:integration   # Integration tests
npm run test:auth          # Authenticated tests (requires test user)

# With UI
npm run test:ui

# Headed mode
npm run test:headed

# Automated (build + test + cleanup)
npm run test:prod
```

## Test Structure

```
tests/
├── api/server-side.test.ts          # Server-side API tests
├── pages/
│   ├── static-pages.test.ts         # Static page tests
│   └── dynamic-pages.test.ts       # Dynamic page tests
├── sessions/cache.test.ts           # Session & cache tests
├── best-practices/
│   └── nextjs-practices.test.ts    # Next.js best practices
└── integration/
    └── production-build.test.ts    # Production build integration
```

## Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `http://localhost:3000` (or `TEST_BASE_URL` env var)
- Auto-starts production server
- Runs in parallel
- Generates HTML reports
- Supports Chromium, Firefox, WebKit

## Viewing Reports

After tests complete:
```bash
npx playwright show-report
```

## CI/CD Integration

For CI/CD pipelines:
```bash
CI=true npm run test:prod
```

This will:
- Build production bundle
- Start server
- Run all tests
- Generate reports
- Clean up

## Troubleshooting

**Connection refused:**
- Ensure production server is running: `npm start`

**Tests timeout:**
- Check server health: `curl http://localhost:3000/api/health`
- Increase timeout in `playwright.config.ts`

**Authentication errors:**
- Some tests expect unauthenticated state
- For authenticated tests, set up test users or mock auth

## Adding New Tests

1. Place in appropriate directory (`tests/api/`, `tests/pages/`, etc.)
2. Use `*.test.ts` naming
3. Test server-side behavior with `request` API
4. Test pages with `page` API
5. Verify headers, status codes, response bodies

See `tests/README.md` for detailed documentation.

