import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const spacesOriginEndpoint = process.env.DO_SPACES_ENDPOINT || 'uppstaff.ams3.digitaloceanspaces.com'
const spacesCdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || 'uppstaff.ams3.cdn.digitaloceanspaces.com'
const spacesKey = process.env.DO_SPACES_KEY
const spacesSecret = process.env.DO_SPACES_SECRET
const spacesBucket = process.env.DO_SPACES_BUCKET || 'uppstaff'
const spacesRegion = process.env.DO_SPACES_REGION || 'ams3'
const useCdn = process.env.DO_SPACES_USE_CDN !== 'false' // По умолчанию используем CDN

if (!spacesKey || !spacesSecret) {
  console.warn('DigitalOcean Spaces credentials not configured')
}

const s3Client = new S3Client({
  endpoint: `https://${spacesOriginEndpoint}`,
  region: spacesRegion,
  credentials: {
    accessKeyId: spacesKey!,
    secretAccessKey: spacesSecret!,
  },
  forcePathStyle: false,
})

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
  if (!spacesKey || !spacesSecret) {
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
  if (!spacesKey || !spacesSecret) {
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
  if (!spacesKey || !spacesSecret) {
    throw new Error('DigitalOcean Spaces not configured')
  }

  const command = new DeleteObjectCommand({
    Bucket: spacesBucket,
    Key: key,
  })

  await s3Client.send(command)
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

