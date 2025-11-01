import { handlers } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { checkAuthRateLimit } from "@/lib/auth-rate-limit"

const { GET: originalGET, POST: originalPOST } = handlers

export async function GET(req: NextRequest) {
  try {
    return await originalGET(req)
  } catch (error) {
    console.error("NextAuth GET error:", error)
    return NextResponse.json(
      { error: "Authentication error occurred" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
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
    
    // Call the original NextAuth POST handler
    return await originalPOST(req)
  } catch (error) {
    console.error("NextAuth POST error:", error)
    
    // Check if it's a URL parsing error
    if (error instanceof Error && error.message.includes("Failed to parse URL")) {
      console.error("URL parsing error - check NEXTAUTH_URL environment variable")
      return NextResponse.json(
        { error: "Authentication configuration error. Please check server settings." },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: "Authentication error occurred" },
      { status: 500 }
    )
  }
}
