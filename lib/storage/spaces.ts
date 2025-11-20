import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Parse endpoint - remove bucket name if it's included
let spacesOriginEndpoint = process.env.DO_SPACES_ENDPOINT || 'your-space.ams3.digitaloceanspaces.com'
const spacesCdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || 'your-space.ams3.cdn.digitaloceanspaces.com'
const spacesKey = process.env.DO_SPACES_KEY
const spacesSecret = process.env.DO_SPACES_SECRET
let spacesBucket = process.env.DO_SPACES_BUCKET || 'your-bucket-name'
const spacesRegion = process.env.DO_SPACES_REGION || 'ams3'
const useCdn = process.env.DO_SPACES_USE_CDN !== 'false' // По умолчанию используем CDN

// Normalize endpoint - ensure it doesn't contain bucket name
// Endpoint should be: region.digitaloceanspaces.com (e.g., ams3.digitaloceanspaces.com)
// Or: bucket.region.digitaloceanspaces.com (we'll extract bucket if needed)
if (spacesOriginEndpoint.includes('.')) {
  const parts = spacesOriginEndpoint.split('.')
  // If endpoint is like "bucket.ams3.digitaloceanspaces.com", extract bucket
  if (parts.length >= 4 && parts[1] === spacesRegion) {
    // Format: bucket.region.digitaloceanspaces.com
    spacesBucket = parts[0]
    spacesOriginEndpoint = `${spacesRegion}.digitaloceanspaces.com`
    console.log(`📦 Extracted bucket "${spacesBucket}" from endpoint, using normalized endpoint: ${spacesOriginEndpoint}`)
  } else if (parts.length === 3 && parts[0] === spacesRegion) {
    // Format: region.digitaloceanspaces.com (correct)
    spacesOriginEndpoint = spacesOriginEndpoint
  } else {
    // Keep as is, but log warning
    console.warn(`⚠️ Unusual endpoint format: ${spacesOriginEndpoint}. Expected: ${spacesRegion}.digitaloceanspaces.com or bucket.${spacesRegion}.digitaloceanspaces.com`)
  }
}

const isSpacesConfigured = !!(spacesKey && spacesSecret)

if (!isSpacesConfigured) {
  console.warn('DigitalOcean Spaces credentials not configured')
} else {
  console.log(`✅ Spaces configured: bucket="${spacesBucket}", endpoint="${spacesOriginEndpoint}", region="${spacesRegion}"`)
}

// Only create S3Client if credentials are configured
// Use path-style URLs to avoid hostname issues with bucket names
const s3Client = isSpacesConfigured ? new S3Client({
  endpoint: `https://${spacesOriginEndpoint}`,
  region: spacesRegion,
  credentials: {
    accessKeyId: spacesKey!,
    secretAccessKey: spacesSecret!,
  },
  forcePathStyle: true, // Use path-style URLs (bucket in path, not hostname)
}) : null

export interface UploadImageResult {
  url: string
  cdnUrl: string
  key: string
}

/**
 * Загружает изображение в DigitalOcean Spaces
 * @param buffer - Buffer с данными изображения
 * @param filename - Имя файла
 * @param contentType - MIME тип (например, 'image/png')
 * @param folder - Папка для хранения (по умолчанию 'images')
 * @returns URL изображения и ключ в хранилище
 */
export async function uploadImageToSpaces(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = 'images'
): Promise<UploadImageResult> {
  if (!isSpacesConfigured || !s3Client) {
    throw new Error('DigitalOcean Spaces not configured')
  }

  // Генерируем уникальное имя файла
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = `${folder}/${Date.now()}-${sanitizedFilename}`
  
  const command = new PutObjectCommand({
    Bucket: spacesBucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read', // Публичный доступ для изображений
  })

  await s3Client.send(command)

  // Формируем URL в зависимости от стиля (path-style или virtual-hosted-style)
  // Для path-style: https://endpoint/bucket/key
  // Для virtual-hosted-style: https://bucket.endpoint/key
  // Мы используем path-style (forcePathStyle: true), поэтому URL: https://endpoint/bucket/key
  const originUrl = `https://${spacesOriginEndpoint}/${spacesBucket}/${key}`
  
  // CDN URL использует virtual-hosted-style: https://bucket.cdn-endpoint/key
  // Но если CDN endpoint уже содержит bucket, используем его как есть
  let cdnUrl: string
  if (spacesCdnEndpoint.includes(spacesBucket)) {
    // CDN endpoint уже содержит bucket
    cdnUrl = `https://${spacesCdnEndpoint}/${key}`
  } else {
    // CDN endpoint не содержит bucket, добавляем его
    cdnUrl = `https://${spacesBucket}.${spacesCdnEndpoint}/${key}`
  }
  
  return { 
    url: useCdn ? cdnUrl : originUrl,
    cdnUrl,
    key 
  }
}

/**
 * Получает URL изображения (публичный или signed URL для приватных файлов)
 * @param key - Ключ файла в Spaces
 * @param expiresIn - Время жизни signed URL в секундах (по умолчанию 1 час)
 * @returns URL изображения
 */
export async function getImageUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!isSpacesConfigured) {
    throw new Error('DigitalOcean Spaces not configured')
  }

  // Формируем URL в зависимости от стиля
  // Для path-style: https://endpoint/bucket/key
  // Для virtual-hosted-style: https://bucket.endpoint/key
  let originUrl: string
  if (spacesOriginEndpoint.includes(spacesBucket)) {
    // Endpoint уже содержит bucket
    originUrl = `https://${spacesOriginEndpoint}/${key}`
  } else {
    // Path-style URL
    originUrl = `https://${spacesOriginEndpoint}/${spacesBucket}/${key}`
  }
  
  let cdnUrl: string
  if (spacesCdnEndpoint.includes(spacesBucket)) {
    // CDN endpoint уже содержит bucket
    cdnUrl = `https://${spacesCdnEndpoint}/${key}`
  } else {
    // CDN endpoint не содержит bucket, добавляем его
    cdnUrl = `https://${spacesBucket}.${spacesCdnEndpoint}/${key}`
  }
  
  // Для публичных файлов используем CDN
  const publicUrl = useCdn ? cdnUrl : originUrl
  
  // Если файл публичный, просто возвращаем URL
  // Для приватных файлов нужно генерировать signed URL (пока не используется)
  return publicUrl
}

/**
 * Удаляет изображение из Spaces
 * @param key - Ключ файла в Spaces
 */
export async function deleteImageFromSpaces(key: string): Promise<void> {
  if (!isSpacesConfigured || !s3Client) {
    throw new Error('DigitalOcean Spaces not configured')
  }

  // Validate key format
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(`Invalid storage key: ${key}`)
  }

  // Remove leading slash if present (S3 doesn't need it)
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key

  console.log(`🗑️ Attempting to delete from Spaces: bucket=${spacesBucket}, key=${normalizedKey}`)

  try {
    const command = new DeleteObjectCommand({
      Bucket: spacesBucket,
      Key: normalizedKey,
    })

    await s3Client.send(command)
    console.log(`✅ Successfully deleted from Spaces: ${normalizedKey}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as any)?.$metadata?.httpStatusCode
    const errorName = (error as any)?.name
    
    // If file doesn't exist (404), that's okay - it's already deleted
    if (errorCode === 404 || errorName === 'NotFound' || errorMessage.includes('NoSuchKey')) {
      console.log(`ℹ️ File not found in Spaces (already deleted?): ${normalizedKey}`)
      return // Success - file is already gone
    }
    
    // Log detailed error for debugging
    console.error(`❌ Failed to delete from Spaces:`, {
      key: normalizedKey,
      bucket: spacesBucket,
      error: errorMessage,
      code: errorCode,
      name: errorName,
      metadata: (error as any)?.$metadata
    })
    
    throw error // Re-throw for caller to handle
  }
}

/**
 * Извлекает ключ из URL Spaces
 * @param url - URL изображения
 * @returns Ключ файла или null
 */
export function extractKeyFromUrl(url: string): string | null {
  // Поддерживаем оба формата: CDN и origin
  const match = url.match(/https?:\/\/[^\/]+\/(.+)$/)
  return match ? match[1] : null
}

