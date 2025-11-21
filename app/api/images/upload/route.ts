import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadImageToSpaces } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Increase body size limit for image uploads (50MB)
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Support both FormData (binary) and JSON (base64) for backward compatibility
    const contentType = request.headers.get('content-type') || ''
    
    let imageBuffer: Buffer
    let filename: string
    let imageContentType: string
    let folder: string = 'images'

    if (contentType.includes('multipart/form-data')) {
      // FormData upload (preferred - binary data, no size limit issues)
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const folderParam = formData.get('folder') as string | null

      if (!file) {
        return NextResponse.json({
          success: false,
          message: 'Missing file in FormData'
        }, { status: 400 })
      }

      filename = formData.get('filename') as string || file.name || 'image.png'
      imageContentType = file.type || 'image/png'
      folder = folderParam || 'images'
      
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else {
      // JSON upload (base64 - for backward compatibility, but has size limits)
      const body = await request.json()
      const { base64Data, filename: filenameParam, contentType: contentTypeParam, folder: folderParam } = body

      if (!base64Data || !filenameParam || !contentTypeParam) {
        return NextResponse.json({
          success: false,
          message: 'Missing required fields: base64Data, filename, contentType'
        }, { status: 400 })
      }

      filename = filenameParam
      imageContentType = contentTypeParam
      folder = folderParam || 'images'

      // Convert base64 to buffer
      // Remove data URL prefix if present
      let base64String = base64Data
      if (base64String.includes(',')) {
        base64String = base64String.split(',')[1]
      }
      imageBuffer = Buffer.from(base64String, 'base64')
    }

    // Validate image size (50MB limit for binary, but base64 will be larger)
    const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return NextResponse.json({
        success: false,
        message: `Image too large: ${(imageBuffer.length / (1024 * 1024)).toFixed(2)}MB. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      }, { status: 413 })
    }
    
    // Upload to Spaces
    const uploadResult = await uploadImageToSpaces(
      imageBuffer,
      filename,
      imageContentType,
      folder
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

