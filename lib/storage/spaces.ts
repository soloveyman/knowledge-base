import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const spacesOriginEndpoint = process.env.DO_SPACES_ENDPOINT || 'your-space.ams3.digitaloceanspaces.com'
const spacesCdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || 'your-space.ams3.cdn.digitaloceanspaces.com'
const spacesKey = process.env.DO_SPACES_KEY
const spacesSecret = process.env.DO_SPACES_SECRET
const spacesBucket = process.env.DO_SPACES_BUCKET || 'your-bucket-name'
const spacesRegion = process.env.DO_SPACES_REGION || 'ams3'
const useCdn = process.env.DO_SPACES_USE_CDN !== 'false' // По умолчанию используем CDN

const isSpacesConfigured = !!(spacesKey && spacesSecret)

if (!isSpacesConfigured) {
  console.warn('DigitalOcean Spaces credentials not configured')
}

// Only create S3Client if credentials are configured
const s3Client = isSpacesConfigured ? new S3Client({
  endpoint: `https://${spacesOriginEndpoint}`,
  region: spacesRegion,
  credentials: {
    accessKeyId: spacesKey!,
    secretAccessKey: spacesSecret!,
  },
  forcePathStyle: false,
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

  // Используем CDN endpoint для публичных URL (быстрее)
  const cdnUrl = `https://${spacesCdnEndpoint}/${key}`
  const originUrl = `https://${spacesOriginEndpoint}/${key}`
  
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

  // Для публичных файлов используем CDN
  const publicUrl = useCdn 
    ? `https://${spacesCdnEndpoint}/${key}`
    : `https://${spacesOriginEndpoint}/${key}`
  
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

