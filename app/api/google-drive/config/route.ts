import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY

    if (!clientId) {
      return NextResponse.json({ 
        error: 'Google OAuth not configured',
        message: 'GOOGLE_CLIENT_ID is not set in environment variables'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      clientId,
      apiKey: apiKey || null // API key опционален для Picker
    })
  } catch (error) {
    console.error('Error getting Google Drive config:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

