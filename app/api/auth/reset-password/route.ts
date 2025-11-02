import { NextResponse } from 'next/server'
import { db, users, passwordResetTokens } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Find and verify token
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expires, new Date())
        )
      )
      .limit(1)

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.id, resetToken.userId)).limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetToken.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reset Password] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
