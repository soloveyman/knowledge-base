import { NextResponse } from 'next/server'
import { resendVerificationEmail, getBaseUrl } from '@/lib/email-verification'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { registrationRateLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 * Body: { email: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Rate limiting
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(
      registrationRateLimiter,
      `resend-verification:${ip}`,
      3, // 3 requests
      60 * 60 * 1000 // per hour
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const baseUrl = getBaseUrl()
    const result = await resendVerificationEmail(email, baseUrl)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}

