import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const allUsers = await db.select().from(users)

    return NextResponse.json({
      success: true,
      data: {
        users: allUsers
      }
    })
  } catch (error) {
    console.error('Users API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, role } = body

    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json({
        success: false,
        message: 'Name, email, and role are required'
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existingUser.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 })
    }

    // Create new user
    const newUser = await db.insert(users).values({
      name,
      email,
      role: role as 'owner' | 'manager' | 'employee',
      // Note: In a real app, you'd hash the password and handle authentication properly
    }).returning()

    return NextResponse.json({
      success: true,
      data: {
        user: newUser[0]
      },
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('Create user API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
