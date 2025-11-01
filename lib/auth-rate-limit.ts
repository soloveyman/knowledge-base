// Helper to extract IP from NextAuth request
// This is used in the NextAuth route handler to rate limit by IP
import { loginRateLimiter, checkRateLimit, getClientIp } from "./rate-limit"
import { NextRequest } from "next/server"

export async function checkAuthRateLimit(req: NextRequest): Promise<{ 
  success: boolean
  limit: number
  remaining: number
  reset: number
} | null> {
  // Only rate limit login attempts (POST requests)
  if (req.method !== "POST") {
    return null
  }
  
  const ip = getClientIp(req)
  if (ip === "unknown") {
    return null // Can't rate limit without IP
  }
  
  return await checkRateLimit(
    loginRateLimiter,
    `login:${ip}`,
    10, // fallback: 10 requests
    15 * 60 * 1000 // fallback: 15 minutes
  )
}

