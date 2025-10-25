import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: Replace with actual database queries
    // For now, return empty data to indicate no mock data
    const plans = []
    const currentSubscription = null
    const usage = null

    return NextResponse.json({
      success: true,
      data: {
        plans,
        currentSubscription,
        usage
      }
    })
  } catch (error) {
    console.error('Subscription API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch subscription data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
