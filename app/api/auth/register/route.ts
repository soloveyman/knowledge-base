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

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const [created] = await db.insert(users).values({
      email,
      name: name ?? null,
      role: 'owner',
      password: hashed,
      country: 'US',
    }).returning()

    return NextResponse.json({ success: true, id: created.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Register error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


