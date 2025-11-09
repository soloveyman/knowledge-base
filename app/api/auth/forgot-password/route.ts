import { NextResponse } from 'next/server'
import { db, users, passwordResetTokens } from '@/lib/db'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/email-verification'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)

    // Always return success (security best practice - don't reveal if email exists)
    if (!user || !user.password) {
      // User doesn't exist or doesn't have a password (OAuth only)
      return NextResponse.json({ success: true })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing reset tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))

    // Create new reset token
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expires,
      used: false,
    })

    const baseUrl = getBaseUrl()
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`
    
    // Send email with reset link
    try {
      await sendPasswordResetEmail(user.email, resetUrl)
      console.log('[Password Reset] Email sent successfully to:', user.email)
    } catch (emailError) {
      // Log detailed error for debugging
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError)
      console.error('[Password Reset] Failed to send email:', errorMessage)
      console.error('[Password Reset] Error details:', emailError)
      
      // Check if SMTP is configured
      const smtpConfigured = !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD
      )
      
      if (!smtpConfigured) {
        console.error('[Password Reset] SMTP not configured! Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD')
        console.error('[Password Reset] For Gmail: Use App Password (https://support.google.com/accounts/answer/185833)')
      }
      
      // In development, still log the URL
      if (process.env.NODE_ENV === 'development') {
        console.log('[Password Reset] Reset URL (email failed):', resetUrl)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Password Reset] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}
