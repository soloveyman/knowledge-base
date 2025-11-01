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
    // Log request URL for debugging
    const url = req.url
    const headers = Object.fromEntries(req.headers.entries())
    
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
    
    // Ensure request has proper URL and headers for NextAuth
    // NextAuth needs the full URL to construct callback URLs properly
    const host = headers['x-forwarded-host'] || headers.host || req.headers.get('host')
    const protocol = headers['x-forwarded-proto'] || 'https'
    
    if (!host && process.env.NODE_ENV === 'production') {
      console.error('Missing host header - this may cause URL parsing errors')
    }
    
    // Call the original NextAuth POST handler
    return await originalPOST(req)
  } catch (error) {
    console.error("NextAuth POST error:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Check if it's a URL parsing error
    if (error instanceof Error && (
      error.message.includes("Failed to parse URL") || 
      error.message.includes("Invalid URL") ||
      error.cause instanceof Error && error.cause.message.includes("Invalid URL")
    )) {
      const invalidUrl = error.message.match(/\/[^\s]+/)?.[0] || error.cause instanceof Error ? error.cause.message.match(/\/[^\s]+/)?.[0] : 'unknown'
      console.error(`URL parsing error - tried to parse: ${invalidUrl}`)
      console.error('Check NEXTAUTH_URL environment variable or ensure trustHost: true is working')
      return NextResponse.json(
        { 
          error: "Authentication configuration error. Please check server settings.",
          details: process.env.NODE_ENV === 'development' ? `Failed to parse URL: ${invalidUrl}` : undefined
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: "Authentication error occurred" },
      { status: 500 }
    )
  }
}
