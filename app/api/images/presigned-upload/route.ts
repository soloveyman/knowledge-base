import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Parse endpoint - same logic as in spaces.ts
let spacesOriginEndpoint = process.env.DO_SPACES_ENDPOINT || 'your-space.ams3.digitaloceanspaces.com'
const spacesCdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || 'your-space.ams3.cdn.digitaloceanspaces.com'
let spacesBucket = process.env.DO_SPACES_BUCKET || 'your-bucket-name'
const spacesRegion = process.env.DO_SPACES_REGION || 'ams3'
const useCdn = process.env.DO_SPACES_USE_CDN !== 'false'
const spacesKey = process.env.DO_SPACES_KEY
const spacesSecret = process.env.DO_SPACES_SECRET

// Normalize endpoint - same logic as in spaces.ts
if (spacesOriginEndpoint.includes('.')) {
  const parts = spacesOriginEndpoint.split('.')
  if (parts.length >= 4 && parts[1] === spacesRegion) {
    spacesBucket = parts[0]
    spacesOriginEndpoint = `${spacesRegion}.digitaloceanspaces.com`
  }
}

const isSpacesConfigured = !!(spacesKey && spacesSecret)

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    if (!isSpacesConfigured) {
      return NextResponse.json({
        success: false,
        message: 'DigitalOcean Spaces not configured'
      }, { status: 500 })
    }

    const { filename, contentType, folder } = await request.json()
    
    if (!filename || !contentType) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: filename, contentType'
      }, { status: 400 })
    }

    // Create S3 client
    const s3Client = new S3Client({
      endpoint: `https://${spacesOriginEndpoint}`,
      region: spacesRegion,
      credentials: {
        accessKeyId: spacesKey!,
        secretAccessKey: spacesSecret!,
      },
      forcePathStyle: true,
    })

    // Generate unique key
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `${folder || 'images'}/${Date.now()}-${sanitizedFilename}`

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: spacesBucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    })

    // Generate presigned URL (valid for 15 minutes)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })

    // Generate final URLs (same logic as in spaces.ts)
    const originUrl = `https://${spacesOriginEndpoint}/${spacesBucket}/${key}`
    
    let cdnUrl: string
    if (spacesCdnEndpoint.includes(spacesBucket)) {
      cdnUrl = `https://${spacesCdnEndpoint}/${key}`
    } else {
      cdnUrl = `https://${spacesBucket}.${spacesCdnEndpoint}/${key}`
    }

    return NextResponse.json({
      success: true,
      data: {
        presignedUrl,
        key,
        url: useCdn ? cdnUrl : originUrl,
        cdnUrl,
      }
    })
  } catch (error) {
    console.error('Presigned URL generation error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to generate presigned URL',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

