import { handlers } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { checkAuthRateLimit } from "@/lib/auth-rate-limit"

const { GET: originalGET, POST: originalPOST } = handlers

export async function GET(req: NextRequest) {
  return originalGET(req)
}

export async function POST(req: NextRequest) {
  // Apply rate limiting for login attempts
  const rateLimitResult = await checkAuthRateLimit(req)
  
  if (rateLimitResult && !rateLimitResult.success) {
    return NextResponse.json(
      { 
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimitResult.reset
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'Retry-After': rateLimitResult.reset.toString(),
        }
      }
    )
  }
  
  return originalPOST(req)
}
