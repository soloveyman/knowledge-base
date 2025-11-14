/**
 * Utility to load image data from either parsedContent (small images) or API (large images)
 */

export interface ImageData {
  filename: string
  data?: string | null // base64 data (for small images)
  type: string
  position?: number
  imageId?: string | null // ID for large images stored in database
}

/**
 * Get image data URL from either inline data or API
 */
export async function getImageDataUrl(img: ImageData): Promise<string> {
  // If image has inline data (small image)
  if (img.data) {
    // Check if it's already a data URL (starts with "data:")
    if (img.data.startsWith('data:')) {
      // Already a full data URL, return as-is
      return img.data
    } else {
      // Just base64 data, construct the data URL
      return `data:${img.type};base64,${img.data}`
    }
  }
  
  // If image has imageId (large image), fetch from API
  if (img.imageId) {
    try {
      const response = await fetch(`/api/documents/images/${img.imageId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }
      const result = await response.json()
      if (result.success && result.data?.dataUrl) {
        return result.data.dataUrl
      }
      throw new Error('Invalid response from image API')
    } catch (error) {
      console.error('Error loading image from API:', error)
      // Return placeholder or empty data URL
      return `data:${img.type};base64,` // Empty base64
    }
  }
  
  // Fallback: return empty data URL
  console.warn(`Image ${img.filename} has no data or imageId`)
  return `data:${img.type};base64,`
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

