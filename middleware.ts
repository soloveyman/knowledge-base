import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { apiRateLimiter, getClientIp, checkRateLimit } from "@/lib/rate-limit"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    // Skip rate limiting for NextAuth internal routes and health checks
    if (
      pathname.startsWith('/api/auth/') || 
      pathname.startsWith('/api/health')
    ) {
      return NextResponse.next()
    }
    
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(
      apiRateLimiter,
      `api:${ip}`,
      100, // fallback: 100 requests per minute
      60 * 1000 // fallback: 1 minute
    )
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
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
    
    // Add rate limit headers to successful responses
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    return response
  }
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/api/auth']
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  if (isPublicRoute) {
    // If already authenticated, avoid staying on auth pages
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development"
    })
    if (token) {
      const userRole = (token.role as string | undefined)?.toLowerCase()
      if (userRole === 'super-admin') return NextResponse.redirect(new URL('/super-admin', request.url))
      if (userRole === 'owner') return NextResponse.redirect(new URL('/owner', request.url))
      if (userRole === 'manager') return NextResponse.redirect(new URL('/manager', request.url))
      // Default to owner dashboard if role is missing/unknown
      return NextResponse.redirect(new URL('/owner', request.url))
    }
    return NextResponse.next()
  }
  
  // Get token if present (do not block if absent to avoid brittle redirects)
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development"
  })
  
  // Handle root path redirect for authenticated users
  if (pathname === '/') {
    const userRole = (token?.role as string | undefined)?.toLowerCase()
    if (userRole === 'super-admin') {
      return NextResponse.redirect(new URL('/super-admin', request.url))
    } else if (userRole === 'owner') {
      return NextResponse.redirect(new URL('/owner', request.url))
    } else if (userRole === 'manager') {
      return NextResponse.redirect(new URL('/manager', request.url))
    } else {
      // Default to owner if role missing/unknown
      return NextResponse.redirect(new URL('/owner', request.url))
    }
  }
  
  // Soft-role routing only on root; otherwise allow and let pages handle auth
  const userRole = token?.role as string | undefined
  
  // If authenticated, allow access to protected routes
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
}
