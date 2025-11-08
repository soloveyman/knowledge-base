export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { registrationRateLimiter, getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { assignFreeTrialToOwner } from '@/lib/subscription/trial'
import { emailExists, normalizeEmail, isNotDisposableEmail } from '@/lib/email-validation'
import { createEmailVerificationToken, sendVerificationEmail } from '@/lib/email-verification'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
})

export async function POST(req: Request) {
  try {
    // Rate limiting check
    const ip = getClientIp(req)
    const rateLimitResult = await checkRateLimit(
      registrationRateLimiter,
      `register:${ip}`,
      5, // fallback: 5 requests
      15 * 60 * 1000 // fallback: 15 minutes
    )
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many registration attempts. Please try again later.',
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
    
    const body = await req.json()
    // Normalize email before validation
    const normalizedBody = {
      ...body,
      email: typeof body.email === 'string' ? normalizeEmail(body.email) : body.email
    }
    const { email, password, name } = schema.parse(normalizedBody)
    const normalizedEmail = normalizeEmail(email)

    // Check if email is disposable/temporary
    if (!isNotDisposableEmail(normalizedEmail)) {
      return NextResponse.json({ 
        error: 'Disposable/temporary email addresses are not allowed. Please use a real email address.' 
      }, { status: 400 })
    }

    // Check if email exists globally
    const exists = await emailExists(normalizedEmail)
    if (exists) {
      // Get existing user to check password
      const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
      const existingUser = existing[0] as { id: string; password: string | null } | undefined
      
      // If the user already exists and has a password, allow seamless sign-in by
      // validating the provided password and returning success instead of 409.
      if (existingUser?.password) {
        const ok = await bcrypt.compare(password, existingUser.password)
        if (ok) {
          return NextResponse.json({ success: true, id: existingUser.id, existing: true })
        }
      }
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const [created] = await db.insert(users).values({
      email: normalizedEmail,
      name: name ?? null,
      role: 'owner',
      password: hashed,
      businessId: undefined, // set after we get id below for clarity
      country: 'US',
    }).returning()
    // Immediately set businessId = owner id (best-effort; ignore if column not present yet)
    try {
      await db.update(users).set({ businessId: created.id }).where(eq(users.id, created.id))
    } catch {
      console.warn('Register: failed to set businessId, proceeding anyway')
    }

    // Assign free trial subscription to new owner (non-blocking)
    try {
      await assignFreeTrialToOwner(created.id)
    } catch (error) {
      console.error('Register: failed to assign free trial, proceeding anyway:', error)
    }

    // Send email verification (non-blocking)
    try {
      const token = await createEmailVerificationToken(created.id, normalizedEmail)
      const baseUrl = process.env.NEXTAUTH_URL || 
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
        'http://localhost:3000'
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
      await sendVerificationEmail(normalizedEmail, verificationUrl)
    } catch (error) {
      console.error('Register: failed to send verification email, proceeding anyway:', error)
      // Don't fail registration if email sending fails
    }

    return NextResponse.json({ 
      success: true, 
      id: created.id, 
      businessId: created.id,
      message: 'Registration successful. Please check your email to verify your account.'
    })
  } catch (err) {
    // Handle Zod validation errors
    if (err && typeof err === 'object' && 'issues' in err) {
      const zodError = err as z.ZodError
      const firstError = zodError.issues[0]
      
      // Create user-friendly error messages
      let message = 'Validation error'
      if (firstError?.path?.includes('password')) {
        if (firstError.code === 'too_small') {
          message = `Password must be at least ${firstError.minimum || 8} characters long`
        } else {
          message = firstError.message || 'Invalid password'
        }
      } else if (firstError?.path?.includes('email')) {
        message = firstError.message || 'Invalid email address'
      } else {
        message = firstError?.message || 'Validation error'
      }
      
      console.error('Register validation error:', zodError.issues)
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Register error:', message)
    
    // Check if it's a URL parsing error (may occur if NextAuth is called)
    if (err instanceof Error && (
      message.includes("Failed to parse URL") || 
      message.includes("Invalid URL")
    )) {
      console.error('URL parsing error in registration - this may indicate NEXTAUTH_URL is not set')
      return NextResponse.json({ 
        error: 'Registration service error. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? message : undefined
      }, { status: 500 })
    }
    
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


