export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { registrationRateLimiter, getClientIp, checkRateLimit } from '@/lib/rate-limit'

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
      email: typeof body.email === 'string' ? body.email.toLowerCase().trim() : body.email
    }
    const { email, password, name } = schema.parse(normalizedBody)
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
    if (existing.length > 0) {
      // If the user already exists and has a password, allow seamless sign-in by
      // validating the provided password and returning success instead of 409.
      const existingUser = existing[0] as { id: string; password: string | null }
      if (existingUser.password) {
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
    return NextResponse.json({ success: true, id: created.id, businessId: created.id })
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


