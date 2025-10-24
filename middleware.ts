import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/api/auth']
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Get the token
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development"
  })
  
  // If no token and trying to access protected route, redirect to sign-in
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
  
  // Handle root path redirect for authenticated users
  if (pathname === '/') {
    const userRole = token.role
    if (userRole === 'owner') {
      return NextResponse.redirect(new URL('/owner', request.url))
    } else if (userRole === 'manager') {
      return NextResponse.redirect(new URL('/manager', request.url))
    } else {
      return NextResponse.redirect(new URL('/employee', request.url))
    }
  }
  
  // Check if user is trying to access a role page that doesn't match their role
  const userRole = token.role
  
  if (pathname === '/owner' && userRole !== 'owner') {
    // Redirect to correct role page
    if (userRole === 'manager') {
      return NextResponse.redirect(new URL('/manager', request.url))
    } else {
      return NextResponse.redirect(new URL('/employee', request.url))
    }
  }
  if (pathname === '/manager' && userRole !== 'manager') {
    // Redirect to correct role page
    if (userRole === 'owner') {
      return NextResponse.redirect(new URL('/owner', request.url))
    } else {
      return NextResponse.redirect(new URL('/employee', request.url))
    }
  }
  if (pathname === '/employee' && userRole !== 'employee') {
    // Redirect to correct role page
    if (userRole === 'owner') {
      return NextResponse.redirect(new URL('/owner', request.url))
    } else {
      return NextResponse.redirect(new URL('/manager', request.url))
    }
  }
  
  // If authenticated, allow access to protected routes
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
