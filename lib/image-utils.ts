/**
 * Image utility functions for better handling of small images
 */

// Thresholds for determining image size categories
export const IMAGE_SIZE_THRESHOLDS = {
  SMALL: 256, // 256px or less - icons, thumbnails, QR codes
  MEDIUM: 800, // 257-800px - small photos, previews
  LARGE: 1200, // 801-1200px - regular images
  XLARGE: 2000, // 1201px+ - high-res images
} as const

export type ImageSizeCategory = 'small' | 'medium' | 'large' | 'xlarge'

/**
 * Determines the size category of an image based on its dimensions
 */
export function getImageSizeCategory(
  width: number,
  height: number
): ImageSizeCategory {
  const maxDimension = Math.max(width, height)
  
  if (maxDimension <= IMAGE_SIZE_THRESHOLDS.SMALL) {
    return 'small'
  } else if (maxDimension <= IMAGE_SIZE_THRESHOLDS.MEDIUM) {
    return 'medium'
  } else if (maxDimension <= IMAGE_SIZE_THRESHOLDS.LARGE) {
    return 'large'
  } else {
    return 'xlarge'
  }
}

/**
 * Gets optimized image props based on size category
 */
export function getOptimizedImageProps(
  category: ImageSizeCategory,
  options: {
    width: number
    height: number
    src: string
    alt: string
    isDataUrl?: boolean
    isExternal?: boolean
    priority?: boolean
  }
) {
  const { width, height, src, alt, isDataUrl = false, isExternal = false, priority = false } = options
  const isOptimized = !isDataUrl && !isExternal

  // Base props
  const baseProps = {
    src,
    alt,
    width,
    height,
    unoptimized: !isOptimized,
  }

  switch (category) {
    case 'small':
      // Small images: high quality, no lazy loading, no blur, priority if needed
      return {
        ...baseProps,
        quality: 95, // Higher quality for small images (file size is negligible)
        loading: priority ? ('eager' as const) : ('lazy' as const),
        sizes: `${width}px`, // Exact size for small images
        // No blur placeholder for small images (loads too fast)
      }

    case 'medium':
      // Medium images: balanced quality, lazy loading, optional blur
      return {
        ...baseProps,
        quality: 85,
        loading: 'lazy' as const,
        sizes: `(max-width: 640px) 100vw, (max-width: 1024px) 90vw, ${width}px`,
        ...(isOptimized && {
          placeholder: 'blur' as const,
          blurDataURL: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        }),
      }

    case 'large':
    case 'xlarge':
      // Large images: standard quality, lazy loading, blur placeholder
      return {
        ...baseProps,
        quality: 85,
        loading: 'lazy' as const,
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px',
        ...(isOptimized && {
          placeholder: 'blur' as const,
          blurDataURL: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        }),
      }

    default:
      return baseProps
  }
}

/**
 * Detects if an image is likely a QR code based on dimensions and aspect ratio
 */
export function isLikelyQRCode(width: number, height: number): boolean {
  // QR codes are typically square (1:1 ratio) and small
  const aspectRatio = width / height
  const isSquare = aspectRatio >= 0.95 && aspectRatio <= 1.05
  const isSmall = Math.max(width, height) <= IMAGE_SIZE_THRESHOLDS.SMALL
  
  return isSquare && isSmall
}

/**
 * Detects if an image is likely an icon based on dimensions
 */
export function isLikelyIcon(width: number, height: number): boolean {
  const maxDimension = Math.max(width, height)
  return maxDimension <= 128 // Icons are typically 16x16 to 128x128
}

