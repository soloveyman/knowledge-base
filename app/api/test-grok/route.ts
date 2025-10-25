import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('Test endpoint called')
    console.log('GROK_API_KEY exists:', !!process.env.GROK_API_KEY)
    
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ 
        error: 'GROK_API_KEY not set',
        hasKey: false 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'GROK_API_KEY is set',
      hasKey: true,
      keyLength: process.env.GROK_API_KEY.length
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
