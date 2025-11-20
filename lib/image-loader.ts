/**
 * Utility to load image data from either parsedContent (small images) or API (large images)
 */

export interface ImageData {
  filename: string
  data?: string | null // base64 data (legacy only - not used for new images)
  url?: string | null // URL from DigitalOcean Spaces (required for all new images)
  type: string
  position?: number
  imageId?: string | null // ID for images stored in database (for API lookup)
}

/**
 * Get image URL from Spaces or API
 * All images must be stored in S3 (DigitalOcean Spaces) - base64 storage is disabled
 */
export async function getImageDataUrl(img: ImageData): Promise<string> {
  // Priority 1: URL from Spaces (all new images use this)
  if (img.url) {
    console.log(`Using Spaces URL for ${img.filename}: ${img.url}`)
    return img.url
  }
  
  // Priority 2: Fetch from API using imageId (must have URL in Spaces)
  if (img.imageId) {
    try {
      console.log(`Loading image from API: ${img.filename} (imageId: ${img.imageId})`)
      const response = await fetch(`/api/documents/images/${img.imageId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        console.error(`Failed to fetch image ${img.imageId}: HTTP ${response.status} - ${errorText}`)
        throw new Error(`Failed to fetch image: HTTP ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      
      // URL из Spaces (обязательно для всех изображений)
      if (result.success && result.data?.url) {
        console.log(`Successfully loaded image ${img.filename} from Spaces: ${result.data.url}`)
        return result.data.url
      }
      
      // Если нет URL - изображение недоступно (base64 storage отключен)
      console.error(`Image ${img.imageId} has no URL in database - base64 storage is disabled`)
      throw new Error(`Image ${img.filename} is not available - URL from Spaces is required`)
    } catch (error) {
      console.error(`Error loading image ${img.filename} (imageId: ${img.imageId}) from API:`, error)
      throw error
    }
  }
  
  // No URL and no imageId - image is missing
  // This is expected for legacy data or corrupted files, so use warn instead of error
  console.warn(`Image ${img.filename} has no URL or imageId - image is missing (this is expected for some legacy documents)`)
  throw new Error(`Image ${img.filename} is not available`)
}

/**
 * Preload all images for a document (useful for batch loading)
 */
export async function preloadDocumentImages(images: ImageData[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>()
  
  await Promise.all(
    images.map(async (img) => {
      try {
        const dataUrl = await getImageDataUrl(img)
        const key = img.imageId || img.filename
        imageMap.set(key, dataUrl)
      } catch (error) {
        console.error(`Failed to preload image ${img.filename}:`, error)
      }
    })
  )
  
  return imageMap
}

