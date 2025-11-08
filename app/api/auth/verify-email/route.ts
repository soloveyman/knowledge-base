import { NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-verification'
import { signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Verify email address
 * GET /api/auth/verify-email?token=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/auth/signin?error=missing_token', request.url)
      )
    }

    const result = await verifyEmailToken(token)

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/auth/signin?error=${encodeURIComponent(result.error || 'verification_failed')}`, request.url)
      )
    }

    // Redirect to sign in with success message
    return NextResponse.redirect(
      new URL('/auth/signin?verified=true', request.url)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL('/auth/signin?error=verification_error', request.url)
    )
  }
}

