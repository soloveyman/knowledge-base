import { NextResponse } from 'next/server'
import { testSimpleConnection } from '@/lib/db/simple-connection'

export async function GET() {
  try {
    const isConnected = await testSimpleConnection()
    
    if (isConnected) {
      return NextResponse.json({ 
        success: true, 
        message: 'Database connection successful',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Database connection failed' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
