import { NextResponse } from 'next/server'
import { users } from '@/lib/db'
import { getTenantDb } from '@/lib/db/tenant'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { strictRateLimiter, getClientIp, checkRateLimit } from '@/lib/rate-limit'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 30 // Revalidate every 30 seconds (stale-while-revalidate)

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.businessId) {
      return NextResponse.json({ success: false, message: 'Unauthorized: missing tenant' }, { status: 401 })
    }
    const tenantDb = getTenantDb(session.user.businessId)
    const tenantId = session.user.businessId
    const allUsers = await tenantDb
      .select()
      .from(users)
      .where(eq(users.businessId, tenantId))

    return NextResponse.json({
      success: true,
      data: {
        users: allUsers
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    console.error('Users API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.businessId) {
      return NextResponse.json({ success: false, message: 'Unauthorized: missing tenant' }, { status: 401 })
    }
    
    // Rate limiting for user creation (per user, not per IP)
    const identifier = session.user.id || getClientIp(request)
    const rateLimitResult = await checkRateLimit(
      strictRateLimiter,
      `create-user:${identifier}`,
      3, // fallback: 3 requests per hour
      60 * 60 * 1000 // fallback: 1 hour
    )
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many user creation attempts. Please try again later.',
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
    
    const tenantDb = getTenantDb(session.user.businessId)
    const tenantId = session.user.businessId
    const body = await request.json()
    const { name, job, email, password, role } = body

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json({
        success: false,
        message: 'Name, email, password, and role are required'
      }, { status: 400 })
    }

    // Check if user already exists
    const normalizedEmail = String(email).toLowerCase().trim()
    const existingUser = await tenantDb.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
    if (existingUser.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create new user
    const newUser = await tenantDb.insert(users).values({
      name,
      job,
      email: normalizedEmail,
      password: hashedPassword,
      role: role as 'owner' | 'manager' | 'employee',
      businessId: tenantId,
    }).returning()

    return NextResponse.json({
      success: true,
      data: {
        user: newUser[0]
      },
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('Create user API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
