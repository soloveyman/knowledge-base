import { handlers } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { checkAuthRateLimit } from "@/lib/auth-rate-limit"

const { GET: originalGET, POST: originalPOST } = handlers

export async function GET(req: NextRequest) {
  try {
    return await originalGET(req)
  } catch (error) {
    console.error("NextAuth GET error:", error)
    const errorMessage = error instanceof Error ? error.message : "Authentication error occurred"
    return NextResponse.json(
      { error: errorMessage },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
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
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'Retry-After': rateLimitResult.reset.toString(),
          }
        }
      )
    }
    
    // Call the original NextAuth POST handler - pass request as-is
    const response = await originalPOST(req)
    
    // Ensure response is JSON (not HTML error page)
    // Check content-type first to avoid reading body unnecessarily
    const contentType = response?.headers.get('content-type') || ''
    if (response && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
      // Clone response to read body without consuming it
      const clonedResponse = response.clone()
      try {
        const text = await clonedResponse.text()
        // If we got HTML, it's likely an error page
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          console.error('NextAuth returned HTML instead of JSON:', text.substring(0, 200))
          return NextResponse.json(
            { 
              error: 'Authentication service error. Please check server configuration.',
              details: process.env.NODE_ENV === 'development' ? 'Server returned HTML instead of JSON. Check database connection and NEXTAUTH_URL.' : undefined
            },
            { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
      } catch (readError) {
        // If we can't read the response, log and return error
        console.error('Failed to read response body:', readError)
      }
    }
    
    return response
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
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          error: "Database connection error. Please ensure the database is running.",
          details: process.env.NODE_ENV === 'development' ? 
            'Make sure Docker database is running: npm run docker:up' : 
            undefined
        },
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    return NextResponse.json(
      { 
        error: "Authentication error occurred",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
