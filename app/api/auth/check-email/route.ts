import { NextResponse } from 'next/server'
import { isValidEmailFormat, normalizeEmail, isNotDisposableEmail } from '@/lib/email-validation'
import { emailExists } from '@/lib/email-validation-server'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { registrationRateLimiter } from '@/lib/rate-limit'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Check if an email is available for registration
 * GET /api/auth/check-email?email=user@example.com
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { available: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(
      registrationRateLimiter,
      `check-email:${ip}`,
      20, // 20 requests
      60 * 1000 // per minute
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { available: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Validate email format
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { available: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if email is disposable/temporary
    if (!isNotDisposableEmail(email)) {
      return NextResponse.json(
        { available: false, error: 'Disposable/temporary email addresses are not allowed' },
        { status: 400 }
      )
    }

    const normalizedEmail = normalizeEmail(email)

    // Check if email exists and get password status
    const existingUsers = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
    const exists = existingUsers.length > 0
    const hasPassword = exists && existingUsers[0].password !== null

    return NextResponse.json({
      available: !exists,
      email: normalizedEmail,
      exists,
      hasPassword: exists ? hasPassword : undefined
    })
  } catch (error) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { available: false, error: 'Failed to check email availability' },
      { status: 500 }
    )
  }
}

