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
    // Debug logging for localhost
    if (process.env.NODE_ENV === 'development') {
      const url = req.url
      const host = req.headers.get('host')
      console.log('[NextAuth] POST request:', {
        url,
        host,
        hasNEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL
      })
    }
    
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
    
    // Call the original NextAuth POST handler - pass request as-is
    return await originalPOST(req)
  } catch (error) {
    console.error("NextAuth POST error:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error && error.cause ? error.cause : undefined
    })
    
    // Check if it's a URL parsing error
    if (error instanceof Error && (
      error.message.includes("Failed to parse URL") || 
      error.message.includes("Invalid URL") ||
      (error.cause && error.cause instanceof Error && error.cause.message.includes("Invalid URL"))
    )) {
      const invalidUrl = error.message.match(/\/[^\s]+/)?.[0] || 
        (error.cause && error.cause instanceof Error ? error.cause.message.match(/\/[^\s]+/)?.[0] : null) || 
        'unknown'
      
      console.error(`❌ URL parsing error - tried to parse: ${invalidUrl}`)
      console.error(`📍 Current NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'NOT SET'}`)
      console.error(`📍 Current NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`)
      console.error('💡 CRITICAL: Restart your dev server after setting NEXTAUTH_URL in .env.local')
      
      return NextResponse.json(
        { 
          error: "Authentication configuration error. Please check server settings.",
          details: process.env.NODE_ENV === 'development' ? 
            `Failed to parse URL: ${invalidUrl}. Make sure NEXTAUTH_URL=http://localhost:3000 is set in .env.local and restart dev server (Ctrl+C then npm run dev)` : 
            undefined
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
