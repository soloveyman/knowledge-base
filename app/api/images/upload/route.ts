import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadImageToSpaces } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { base64Data, filename, contentType, folder } = body

    if (!base64Data || !filename || !contentType) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: base64Data, filename, contentType'
      }, { status: 400 })
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    // Upload to Spaces
    const uploadResult = await uploadImageToSpaces(
      imageBuffer,
      filename,
      contentType,
      folder || 'images'
    )

    return NextResponse.json({
      success: true,
      data: {
        url: uploadResult.url,
        cdnUrl: uploadResult.cdnUrl,
        key: uploadResult.key
      }
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to upload image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

