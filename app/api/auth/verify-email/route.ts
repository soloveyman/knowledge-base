import { NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-verification'
import { signIn } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { assignFreeTrialToOwner } from '@/lib/subscription/trial'

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

    // After successful verification, assign free trial to new owners
    if (result.email) {
      try {
        // Get the user by email to check if they're an owner
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, result.email))
          .limit(1)

        if (user.length > 0 && user[0].role === 'owner') {
          // Assign free trial subscription to new owner (non-blocking)
          await assignFreeTrialToOwner(user[0].id)
          console.log(`[Email Verification] Assigned free trial to owner ${user[0].id} after email verification`)
        }
      } catch (error) {
        // Don't fail verification if trial assignment fails
        console.error('[Email Verification] Failed to assign free trial after verification:', error)
      }
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

