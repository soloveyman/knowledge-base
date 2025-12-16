import { NextResponse } from 'next/server'
import { users } from '@/lib/db'
import { getTenantDb } from '@/lib/db/tenant'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { strictRateLimiter, getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { normalizeEmail, isNotDisposableEmail, isValidEmailFormat } from '@/lib/email-validation'
import { emailExists } from '@/lib/email-validation-server'
import { createEmailVerificationToken, sendVerificationEmail, getBaseUrl } from '@/lib/email-verification'
import { createUserSchema } from '@/lib/schemas/users'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'
import { ensureOnboardingRow } from '@/lib/onboarding/getOnboardingState'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Removed revalidate to ensure fresh data after mutations (no cache delay)

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
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    return handleApiError(error, 'Failed to fetch users', 500)
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
    
    // Validate request body
    const validation = await validateRequest(request, createUserSchema)
    if (!validation.success) {
      return validation.response
    }

    const { name, job, email, password, role } = validation.data

    const tenantDb = getTenantDb(session.user.businessId)
    const tenantId = session.user.businessId

    // Normalize and validate email
    const normalizedEmail = normalizeEmail(email)
    
    // Validate email format (double-check, schema already validates but this is extra safety)
    if (!isValidEmailFormat(normalizedEmail)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid email format'
      }, { status: 400 })
    }

    // Check if email is disposable/temporary
    if (!isNotDisposableEmail(normalizedEmail)) {
      return NextResponse.json({
        success: false,
        message: 'Disposable/temporary email addresses are not allowed. Please use a real email address.'
      }, { status: 400 })
    }

    // Check if user already exists globally (emails must be unique across all tenants)
    const exists = await emailExists(normalizedEmail)
    if (exists) {
      return NextResponse.json({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 })
    }

    // Check usage limit for users (only for owners)
    if (session.user.role === 'owner') {
      const { checkUsageLimit } = await import('@/lib/subscription/usage-check')
      const limitCheck = await checkUsageLimit(session.user.id, 'users')
      
      if (!limitCheck.allowed) {
        return NextResponse.json({
          success: false,
          message: limitCheck.message || 'User limit reached. Please upgrade your plan to continue.',
          error: 'USAGE_LIMIT_EXCEEDED',
          current: limitCheck.current,
          max: limitCheck.max
        }, { status: 403 })
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create new user
    const newUser = await tenantDb.insert(users).values({
      name,
      job,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      businessId: tenantId,
    }).returning()

    // Create onboarding progress for managers and owners
    if (role === 'manager' || role === 'owner') {
      try {
        await ensureOnboardingRow(tenantId, newUser[0].id)
        console.log('[User Creation] Onboarding progress created for:', normalizedEmail, `(${role})`)
      } catch (error) {
        console.error('[User Creation] Failed to create onboarding progress, proceeding anyway:', error)
        // Don't fail user creation if onboarding setup fails
      }
    }

    // Send email verification (non-blocking)
    try {
      const token = await createEmailVerificationToken(newUser[0].id, normalizedEmail)
      const baseUrl = getBaseUrl()
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
      // Pass isAdminCreated=true since this is an admin-created user
      await sendVerificationEmail(normalizedEmail, verificationUrl, true)
      console.log('[User Creation] Verification email sent to:', normalizedEmail)
    } catch (error) {
      console.error('Create user: failed to send verification email, proceeding anyway:', error)
      // Don't fail user creation if email sending fails
    }

    return NextResponse.json({
      success: true,
      data: {
        user: newUser[0]
      },
      message: 'User created successfully. Verification email has been sent to the user.'
    })
  } catch (error) {
    return handleApiError(error, 'Failed to create user', 500)
  }
}
