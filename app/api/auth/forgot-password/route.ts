import { NextResponse } from 'next/server'
import { db, users, passwordResetTokens } from '@/lib/db'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

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

    // In production, you would send an email here
    // For now, we'll log it (in development) or use your email service
    const resetUrl = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/auth/reset-password?token=${token}`
    
    console.log('[Password Reset] Reset URL:', resetUrl)
    
    // TODO: Send email with reset link
    // await sendPasswordResetEmail(user.email, resetUrl)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Password Reset] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}
