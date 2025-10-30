export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, name } = schema.parse(body)
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
    // Immediately set businessId = owner id
    await db.update(users).set({ businessId: created.id }).where(eq(users.id, created.id))
    return NextResponse.json({ success: true, id: created.id, businessId: created.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Register error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


