import { NextRequest, NextResponse } from 'next/server'
import { db, passwordResetTokens } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 })
    }

    // Find token
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
      return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 400 })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[Verify Reset Token] Error:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}
