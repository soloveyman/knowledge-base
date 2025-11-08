import { db, users, verificationTokens } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendEmail } from './email'

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create email verification token for a user
 */
export async function createEmailVerificationToken(userId: string, email: string): Promise<string> {
  const token = generateVerificationToken()
  const expires = new Date()
  expires.setHours(expires.getHours() + 24) // Token expires in 24 hours

  // Delete any existing tokens for this user
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, email))

  // Create new verification token
  await db.insert(verificationTokens).values({
    identifier: email,
    token,
    expires
  })

  return token
}

/**
 * Verify email token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const tokenRecord = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, token),
          gt(verificationTokens.expires, new Date())
        )
      )
      .limit(1)

    if (tokenRecord.length === 0) {
      return { success: false, error: 'Invalid or expired verification token' }
    }

    const email = tokenRecord[0].identifier

    // Mark user's email as verified
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.email, email))

    // Delete the used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token))

    return { success: true, email }
  } catch (error) {
    console.error('Email verification error:', error)
    return { success: false, error: 'Failed to verify email' }
  }
}

/**
 * Send email verification email
 * @param email - Email address to send verification to
 * @param verificationUrl - Verification link URL
 * @param isAdminCreated - Whether the account was created by an admin (default: false)
 */
export async function sendVerificationEmail(
  email: string, 
  verificationUrl: string,
  isAdminCreated: boolean = false
): Promise<void> {
  const subject = 'Verify Your Email Address'
  
  const introText = isAdminCreated
    ? 'An account has been created for you! Please verify your email address by clicking the button below:'
    : 'Thank you for registering! Please verify your email address by clicking the button below:'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1A1D29; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0;">Verify Your Email</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>${introText}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify Email</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all;">${verificationUrl}</p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
          <p style="font-size: 14px; color: #666;">If you didn't expect this email, please ignore it.</p>
        </div>
      </body>
    </html>
  `
  
  const textIntro = isAdminCreated
    ? 'An account has been created for you! Please verify your email address by clicking the link below:'
    : 'Thank you for registering! Please verify your email address by clicking the link below:'
  
  const text = `Verify Your Email Address

${textIntro}

${verificationUrl}

This link will expire in 24 hours.

If you didn't expect this email, please ignore it.`

  await sendEmail({
    to: email,
    subject,
    html,
    text
  })
}

/**
 * Check if email is verified
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (user.length === 0) return false
  return user[0].emailVerified !== null
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string, baseUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (user.length === 0) {
      return { success: false, error: 'User not found' }
    }

    if (user[0].emailVerified) {
      return { success: false, error: 'Email is already verified' }
    }

    const token = await createEmailVerificationToken(user[0].id, email)
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`

    await sendVerificationEmail(email, verificationUrl)

    return { success: true }
  } catch (error) {
    console.error('Resend verification email error:', error)
    return { success: false, error: 'Failed to resend verification email' }
  }
}

