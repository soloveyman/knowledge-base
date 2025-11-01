# Security & Rate Limiting Implementation

This document describes the spam and DDoS protection mechanisms implemented in the application.

## Overview

The application now includes multiple layers of protection against spam, brute force attacks, and DDoS:

1. **Rate Limiting** - IP-based and user-based rate limiting on all critical endpoints
2. **Security Headers** - HTTP security headers to prevent common attacks
3. **Honeypot Fields** - Bot detection on authentication forms
4. **Request Size Limits** - Protection against large payload attacks

## Rate Limiting

### Configuration

Rate limiting uses **Upstash Redis** for production (distributed rate limiting) and falls back to in-memory storage for development.

To enable Upstash Redis (recommended for production):

1. Create an account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Add environment variables:
   ```
   UPSTASH_REDIS_REST_URL=your_rest_url
   UPSTASH_REDIS_REST_TOKEN=your_rest_token
   ```

If Upstash is not configured, the system automatically falls back to in-memory rate limiting (works for development, not recommended for production).

### Rate Limits

| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| Registration (`/api/auth/register`) | 5 requests | 15 minutes | IP address |
| Login (`/api/auth/[...nextauth]`) | 10 requests | 15 minutes | IP address |
| User Creation (`/api/users` POST) | 3 requests | 1 hour | User ID |
| General API (`/api/*`) | 100 requests | 1 minute | IP address |

### Rate Limit Headers

All rate-limited endpoints return standard headers:
- `X-RateLimit-Limit` - Maximum number of requests allowed
- `X-RateLimit-Remaining` - Number of requests remaining
- `Retry-After` - Unix timestamp when rate limit resets (when exceeded)

When rate limit is exceeded, endpoints return `429 Too Many Requests` with these headers.

## Security Headers

The following security headers are automatically added to all responses:

- **Strict-Transport-Security** - Forces HTTPS connections
- **X-Frame-Options** - Prevents clickjacking attacks
- **X-Content-Type-Options** - Prevents MIME type sniffing
- **X-XSS-Protection** - Enables XSS filter in browsers
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Restricts browser features
- **X-DNS-Prefetch-Control** - Controls DNS prefetching

Configured in `next.config.ts`.

## Bot Protection

### Honeypot Field

A hidden honeypot field is included in the signin form. Bots often fill all form fields, including hidden ones. If the honeypot field is filled, the request is rejected.

The honeypot field:
- Is visually hidden using CSS (`display: none`)
- Has `tabIndex={-1}` to prevent keyboard navigation
- Has `aria-hidden="true"` for accessibility
- Is checked on form submission

## Request Size Limits

Maximum request body size is limited to **1MB** to prevent large payload attacks. Configured in `next.config.ts`.

## Implementation Details

### Files Modified

1. **`lib/rate-limit.ts`** - Rate limiting utilities with Upstash/in-memory support
2. **`lib/auth-rate-limit.ts`** - NextAuth-specific rate limiting helpers
3. **`app/api/auth/register/route.ts`** - Registration rate limiting
4. **`app/api/auth/[...nextauth]/route.ts`** - Login rate limiting
5. **`app/api/users/route.ts`** - User creation rate limiting
6. **`middleware.ts`** - Global API rate limiting
7. **`next.config.ts`** - Security headers and request size limits
8. **`app/auth/signin/page.tsx`** - Honeypot field implementation

### Testing Rate Limits

You can test rate limiting by making rapid requests to protected endpoints:

```bash
# Test registration rate limit (should fail after 5 requests)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}'
  sleep 1
done
```

### Monitoring

Monitor rate limit violations in:
- Application logs (check for 429 responses)
- Upstash Redis dashboard (if using Upstash)
- API monitoring tools

## Best Practices

1. **Use Upstash Redis** in production for accurate distributed rate limiting
2. **Monitor rate limit violations** to detect potential attacks
3. **Adjust rate limits** based on your application's needs (in `lib/rate-limit.ts`)
4. **Use Cloudflare** for additional DDoS protection at the infrastructure level
5. **Regularly review** security headers and update as needed

## Next Steps

Consider implementing:

1. **CAPTCHA** (reCAPTCHA v3 or Cloudflare Turnstile) for additional bot protection
2. **IP blocking** for repeated violations
3. **Email verification** for registration
4. **Account lockout** after multiple failed login attempts
5. **Web Application Firewall (WAF)** for advanced protection

## Environment Variables

```bash
# Optional: Upstash Redis (recommended for production)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

Without these variables, rate limiting works in-memory (fine for development, not production).

