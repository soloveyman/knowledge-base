import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Initialize Redis client (works with Upstash or any Redis instance)
// If Upstash env vars are not set, fallback to in-memory rate limiting
let redis: Redis | null = null
try {
  redis = Redis.fromEnv()
} catch {
  // If Redis is not configured, we'll use in-memory fallback
  console.warn("Upstash Redis not configured. Rate limiting will use in-memory fallback.")
}

// In-memory rate limit fallback (for development or when Redis is unavailable)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function getMemoryRateLimit(key: string, maxRequests: number, windowMs: number): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now()
  const record = memoryStore.get(key)
  
  if (record && record.resetAt > now) {
    if (record.count >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: Math.ceil(record.resetAt / 1000)
      }
    }
    record.count++
  } else {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
  }
  
  // Cleanup old entries periodically
  if (memoryStore.size > 10000) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < now) memoryStore.delete(k)
    }
  }
  
  const current = memoryStore.get(key)!
  return {
    success: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - current.count),
    reset: Math.ceil(current.resetAt / 1000)
  }
}

// Rate limiter for registration (strict: 5 requests per 15 minutes)
export const registrationRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "@upstash/ratelimit/registration",
    })
  : null

// Rate limiter for login attempts (moderate: 10 requests per 15 minutes)
export const loginRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      analytics: true,
      prefix: "@upstash/ratelimit/login",
    })
  : null

// Rate limiter for API endpoints (100 requests per minute)
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "@upstash/ratelimit/api",
    })
  : null

// Strict rate limiter for sensitive operations (3 requests per hour)
export const strictRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      analytics: true,
      prefix: "@upstash/ratelimit/strict",
    })
  : null

// Helper function to get client IP from request (works with both Request and NextRequest)
export function getClientIp(req: Request | { headers: Headers | { get: (key: string) => string | null }; ip?: string }): string {
  // Check if it's a NextRequest with ip property
  if ('ip' in req && typeof req.ip === 'string' && req.ip) {
    return req.ip
  }
  
  // Fallback to headers
  const headers = 'headers' in req ? req.headers : (req as Request).headers
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }
  const cfConnectingIp = headers.get("cf-connecting-ip") // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }
  return "unknown"
}

// Rate limit check helper with fallback
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
  fallbackMax: number,
  fallbackWindowMs: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (limiter) {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset
    }
  }
  // Fallback to in-memory
  return getMemoryRateLimit(identifier, fallbackMax, fallbackWindowMs)
}

