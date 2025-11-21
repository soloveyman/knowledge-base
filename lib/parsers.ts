import * as XLSX from 'xlsx'
import * as mammoth from 'mammoth'
import * as JSZip from 'jszip'

/**
 * Normalize whitespace in text while preserving structure and readability
 * - Collapses multiple spaces/tabs into single space
 * - Preserves line breaks and paragraph breaks
 * - Handles special characters and formatting
 */
function normalizeWhitespace(text: string): string {
  return text
    // Normalize tabs and multiple spaces to single space (within a line)
    // Split by lines first to avoid breaking formatting tags
    .split('\n')
    .map(line => {
      // Preserve empty lines (they're important for structure)
      if (line.trim().length === 0) return ''
      // Normalize spaces/tabs within the line, but preserve formatting tags
      // Replace multiple spaces/tabs with single space, but be careful with tags
      let normalized = line.replace(/[ \t]+/g, ' ')
      // Trim leading/trailing spaces
      return normalized.trim()
    })
    .join('\n')
    // Preserve paragraph breaks (2+ newlines)
    .replace(/\n{3,}/g, '\n\n')
    // Normalize single line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Final trim (but preserve structure)
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export interface ParseResult {
  readonly text: string
  readonly metadata?: ParseMetadata
  readonly tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
}

export interface ParseMetadata {
  readonly fileName?: string
  readonly fileSize?: number
  readonly parsedAt: Date
  readonly parserVersion: string
  readonly parseTimestamp?: number
  readonly cacheBusting?: boolean
}

interface MammothMessage {
  type: string
  message: string
  image?: {
    filename?: string
    src: string
    contentType?: string
  }
}

export interface ParsedContent {
  sections: Array<{
    title: string
    level: number
    content: string
    order: number
  }>
  tables: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
  images: Array<{
    filename: string
    data: string  // base64 encoded
    type: string
    position?: number
  }>
  metadata: {
    totalSections: number
    totalTables: number
    wordCount: number
    totalImages: number
    parseTimestamp?: number
    parserVersion?: string
    cacheBusting?: boolean
  }
}

export class UnsupportedFileTypeError extends Error {
  constructor(fileType: string) {
    super(`Unsupported file type: ${fileType}`)
    this.name = 'UnsupportedFileTypeError'
  }
}

export class FileReadError extends Error {
  constructor(message: string) {
    super(`File read error: ${message}`)
    this.name = 'FileReadError'
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(`Parse error: ${message}`)
    this.name = 'ParseError'
  }
}

export async function parseDocx(buffer: ArrayBuffer, options: {
  includeMetadata?: boolean
  normalizeWhitespace?: boolean
} = {}): Promise<ParseResult & { images?: Array<{filename: string, data: string, type: string}> }> {
  try {
    // Ensure we have a valid buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Empty or invalid buffer provided')
    }

    console.log('Buffer details:', {
      byteLength: buffer.byteLength,
      constructor: buffer.constructor.name,
      isArrayBuffer: buffer instanceof ArrayBuffer
    })

    console.log('Parsing DOCX with Mammoth.js...')
    
    let text = ''
    const images: Array<{filename: string, data: string, type: string}> = []
    
    try {
      // First, extract images using JSZip (more reliable than Mammoth messages)
      const uint8Array = new Uint8Array(buffer)
      const zip = await JSZip.loadAsync(uint8Array)
      const mediaFolder = zip.folder('word/media')
      
      if (mediaFolder) {
        console.log('Extracting images from word/media...')
        // Get only files that are actually in word/media (not nested folders)
        // and filter for image file extensions only
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        const mediaFiles = Object.keys(mediaFolder.files)
          .filter(filename => {
            const file = mediaFolder.files[filename]
            // Only process files (not directories) that are directly in word/media
            if (file.dir) return false
            // Check if it's an image file by extension
            const extension = filename.split('.').pop()?.toLowerCase()
            return extension && imageExtensions.includes(extension)
          })
        
        console.log(`Found ${mediaFiles.length} image files in word/media folder:`, mediaFiles)
        
        // Image size limits (warn about large high-res images)
        const MAX_IMAGE_SIZE = 500 * 1024 // 500KB per image (recommended)
        const WARNING_IMAGE_SIZE = 200 * 1024 // 200KB per image (warning threshold)
        const MAX_TOTAL_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB total for all images
        let totalImageSize = 0
        const largeImages: string[] = []
        
        for (const filename of mediaFiles) {
          try {
            // Get the file object directly from mediaFolder.files
            const fileEntry = mediaFolder.files[filename]
            if (!fileEntry || fileEntry.dir) {
              console.warn(`⚠️ Skipping ${filename} - not a file or is a directory`)
              continue
            }
            
            // Try to get file by full path first, then by relative path
            let imageBuffer: ArrayBuffer | undefined
            try {
              imageBuffer = await fileEntry.async('arraybuffer')
            } catch (fileError) {
              // Try alternative: get file by full path from root zip
              const fullPath = `word/media/${filename}`
              const rootFile = zip.file(fullPath)
              if (rootFile) {
                imageBuffer = await rootFile.async('arraybuffer')
                console.log(`✅ Retrieved ${filename} using full path: ${fullPath}`)
              } else {
                console.warn(`⚠️ Could not find file ${filename} in zip archive`)
                throw fileError
              }
            }
            
            if (imageBuffer && imageBuffer.byteLength > 0) {
              const imageSizeKB = imageBuffer.byteLength / 1024
              const imageSizeMB = imageBuffer.byteLength / (1024 * 1024)
              
              // Check for large high-resolution images
              if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
                largeImages.push(`${filename} (${imageSizeMB.toFixed(2)}MB)`)
                // Don't warn - images are uploaded to Spaces, size is not an issue
              }
              
              totalImageSize += imageBuffer.byteLength
              
              // Note: Large images will be uploaded to S3, not skipped
              // We only skip if they exceed a very large limit (10MB) to prevent memory issues
              const ABSOLUTE_MAX_SIZE = 10 * 1024 * 1024 // 10MB absolute limit
              if (imageBuffer.byteLength > ABSOLUTE_MAX_SIZE) {
                console.warn(`⚠️ Skipping image ${filename} - exceeds absolute limit (${imageSizeMB.toFixed(2)}MB). Maximum is ${(ABSOLUTE_MAX_SIZE / (1024 * 1024)).toFixed(2)}MB per image.`)
                continue
              }
              
              // Convert to base64 for transmission (will be uploaded to S3 on server)
              const base64 = Buffer.from(imageBuffer).toString('base64')
              const extension = filename.split('.').pop()?.toLowerCase() || 'png'
              // Map common extensions to MIME types
              const mimeTypeMap: Record<string, string> = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
                'svg': 'image/svg+xml'
              }
              const mimeType = mimeTypeMap[extension] || `image/${extension}`
              images.push({
                filename: filename,
                data: `data:${mimeType};base64,${base64}`,
                type: mimeType
              })
              console.log(`✅ Extracted image: ${filename} (${mimeType}, ${imageSizeKB.toFixed(2)}KB)`)
            } else {
              console.warn(`⚠️ Image buffer is null or empty for: ${filename}`)
            }
          } catch (error) {
            console.warn(`❌ Failed to extract image ${filename}:`, error)
          }
        }
        
        // Don't warn about total image size - images are uploaded to Spaces, size is not an issue
        
        // Don't warn about large images - they're uploaded to Spaces, size is not an issue
        console.log(`📸 Total images extracted from word/media: ${images.length}`)
      } else {
        console.log('⚠️ word/media folder not found in DOCX file')
      }
      
      // Use Mammoth to convert DOCX to HTML with style mapping for headings
      // Map Word heading styles to HTML headings
      const styleMap = [
        // Map built-in Word heading styles (case-insensitive matching)
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        // Map Russian heading styles
        "p[style-name='Заголовок 1'] => h1:fresh",
        "p[style-name='Заголовок 2'] => h2:fresh",
        "p[style-name='Заголовок 3'] => h3:fresh",
        "p[style-name='Заголовок 4'] => h4:fresh",
        "p[style-name='Заголовок 5'] => h5:fresh",
        "p[style-name='Заголовок 6'] => h6:fresh",
        // Map common heading style variations (lowercase)
        "p[style-name='heading 1'] => h1:fresh",
        "p[style-name='heading 2'] => h2:fresh",
        "p[style-name='heading 3'] => h3:fresh",
        "p[style-name='heading 4'] => h4:fresh",
        "p[style-name='heading 5'] => h5:fresh",
        "p[style-name='heading 6'] => h6:fresh",
        // Map by paragraph outline level (Word's built-in heading detection)
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        // Note: outline-level is not supported by mammoth styleMap syntax
        // We'll rely on style-name mappings and fallback detection instead
      ]
      
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        { 
          styleMap: styleMap,
          includeDefaultStyleMap: true // Include mammoth's default style mappings
        }
      )
      
      // Log messages to help debug heading detection
      if (result.messages.length > 0) {
        console.log('Mammoth conversion messages:')
        result.messages.forEach(msg => {
          if (msg.type === 'warning') {
            console.warn('Mammoth warning:', msg.message)
          } else {
            console.log('Mammoth message:', msg.type, msg.message)
          }
        })
      }
      
      console.log('Mammoth conversion completed')
      console.log('Messages:', result.messages.length)
      result.messages.forEach(msg => console.log('Message:', msg.type, msg.message))
      
      // Get the HTML text - keep it as HTML for proper formatting
      const htmlText = result.value
      console.log('HTML text length:', htmlText.length)
      console.log('First 200 chars of HTML:', htmlText.substring(0, 200))
      
      // Extract images from HTML img tags that Mammoth created, with their positions
      const imgTagRegex = /<img[^>]+src="data:([^;]+);base64,([^"]+)"[^>]*>/gi
      const imagePositions: Array<{ htmlPos: number; image: { filename: string; data: string; type: string } }> = []
      let htmlImageCount = 0
      
      // First pass: collect all image matches with their HTML positions
      const allMatches: Array<{ match: RegExpMatchArray; htmlPos: number }> = []
      let match
      while ((match = imgTagRegex.exec(htmlText)) !== null) {
        allMatches.push({ match, htmlPos: match.index })
      }
      
      // Process matches in reverse order to preserve positions when replacing
      for (let i = allMatches.length - 1; i >= 0; i--) {
        const { match, htmlPos } = allMatches[i]
        const mimeType = match[1]
        const base64Data = match[2]
        // Check if we already have this image (avoid duplicates)
        const existingImage = images.find(img => img.data.includes(base64Data.substring(0, 50)))
        if (!existingImage) {
          const imageData = {
            filename: `image_${images.length + 1}.${mimeType.split('/')[1] || 'png'}`,
            data: `data:${mimeType};base64,${base64Data}`,
            type: mimeType
          }
          images.push(imageData)
          imagePositions.push({ htmlPos, image: imageData })
          htmlImageCount++
          console.log(`✅ Extracted image from HTML: ${imageData.filename} (${mimeType}) at HTML position ${htmlPos}`)
        }
      }
      
      if (htmlImageCount > 0) {
        console.log(`📸 Extracted ${htmlImageCount} additional images from HTML`)
      }
      console.log(`📸 Total images after HTML extraction: ${images.length}`)
      
      // Replace img tags with placeholders before converting to text
      // This preserves position information
      // Sort by HTML position (descending) to process from end to start
      const sortedImagePositions = [...imagePositions].sort((a, b) => b.htmlPos - a.htmlPos)
      
      let htmlWithPlaceholders = htmlText
      for (let i = 0; i < sortedImagePositions.length; i++) {
        const { htmlPos, image } = sortedImagePositions[i]
        // Extract a portion of the base64 data to match the img tag
        const base64Prefix = image.data.split(',')[1]?.substring(0, 50) || ''
        
        // Try to find the img tag by matching the base64 data
        // First try at the exact position
        let beforeImg = htmlWithPlaceholders.substring(0, htmlPos)
        let afterImg = htmlWithPlaceholders.substring(htmlPos)
        let imgTagMatch = afterImg.match(/^<img[^>]+src="data:[^"]+"[^>]*>/i)
        
        // If not found at exact position, search for img tag with matching base64 data
        if (!imgTagMatch || !imgTagMatch[0].includes(base64Prefix)) {
          // Search for img tag containing this base64 data
          const imgTagRegex = new RegExp(`<img[^>]+src="data:[^"]*${base64Prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>`, 'i')
          const globalMatch = htmlWithPlaceholders.match(imgTagRegex)
          if (globalMatch && globalMatch.index !== undefined) {
            beforeImg = htmlWithPlaceholders.substring(0, globalMatch.index)
            afterImg = htmlWithPlaceholders.substring(globalMatch.index)
            imgTagMatch = afterImg.match(/^<img[^>]+src="data:[^"]+"[^>]*>/i)
            console.log(`📸 Found img tag for "${image.filename}" at position ${globalMatch.index} (was looking for ${htmlPos})`)
          }
        }
        
        if (imgTagMatch) {
          // Use the original index from imagePositions array as the placeholder index
          const originalIndex = imagePositions.findIndex(ip => ip.image === image)
          const placeholder = `[IMAGE_PLACEHOLDER_${originalIndex}]`
          htmlWithPlaceholders = beforeImg + placeholder + afterImg.substring(imgTagMatch[0].length)
          console.log(`📸 Replaced img tag with placeholder [IMAGE_PLACEHOLDER_${originalIndex}] for image "${image.filename}"`)
        } else {
          console.warn(`⚠️ Could not find img tag for image "${image.filename}" at HTML position ${htmlPos}`)
        }
      }
      
      // Convert HTML to plain text with formatting markers
      // Process in order: first extract formatting markers, then structure
      
      // Step 1: Convert paragraph tags to double newlines for paragraph separation
      let workingText = htmlWithPlaceholders.replace(/<p[^>]*>/gi, '\n\n')
      
      // Step 2: Convert closing paragraph tags
      workingText = workingText.replace(/<\/p>/gi, '')
      
      // Step 3: Convert formatting tags (bold, italic) - preserve nested tags
      workingText = workingText
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '[BOLD]$1[/BOLD]')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '[BOLD]$1[/BOLD]')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '[ITALIC]$1[/ITALIC]')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '[ITALIC]$1[/ITALIC]')
      
      // Step 4: Convert headings - extract text content properly
      // First, log HTML to debug heading detection
      const headingMatches = htmlWithPlaceholders.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi)
      if (headingMatches && headingMatches.length > 0) {
        console.log(`📋 Found ${headingMatches.length} heading tags in HTML:`)
        headingMatches.slice(0, 10).forEach((match, idx) => {
          console.log(`  Heading ${idx + 1}: ${match.substring(0, 100)}`)
        })
      } else {
        console.warn('⚠️ No heading tags (h1-h6) found in HTML. Checking for paragraphs with bold text that might be headings...')
      }
      
      // Convert headings - use non-greedy matching and extract text properly
      // Use [\s\S] instead of . with 's' flag for ES2017 compatibility
      workingText = workingText
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          console.log(`📋 H1 found: "${text}"`)
          return text ? `\n\n# ${text}\n\n` : '\n\n'
        })
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          console.log(`📋 H2 found: "${text}"`)
          return text ? `\n\n## ${text}\n\n` : '\n\n'
        })
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          console.log(`📋 H3 found: "${text}"`)
          return text ? `\n\n### ${text}\n\n` : '\n\n'
        })
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          return text ? `\n\n#### ${text}\n\n` : '\n\n'
        })
        .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          return text ? `\n\n##### ${text}\n\n` : '\n\n'
        })
        .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          return text ? `\n\n###### ${text}\n\n` : '\n\n'
        })
      
      // Fallback: Detect headings by formatting (bold paragraphs that are short and standalone)
      // This handles cases where headings aren't properly styled in Word
      workingText = workingText
        .replace(/<p[^>]*><strong[^>]*>([\s\S]*?)<\/strong><\/p>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          // If it's a short line (likely a heading), convert to h2
          if (text && text.length < 200 && !text.includes('\n')) {
            console.log(`📋 Detected potential heading by formatting: "${text}"`)
            return `\n\n## ${text}\n\n`
          }
          return match // Keep original if it doesn't look like a heading
        })
        .replace(/<p[^>]*><b[^>]*>([\s\S]*?)<\/b><\/p>/gi, (match, content) => {
          const text = content.replace(/<[^>]+>/g, '').trim()
          // If it's a short line (likely a heading), convert to h2
          if (text && text.length < 200 && !text.includes('\n')) {
            console.log(`📋 Detected potential heading by formatting: "${text}"`)
            return `\n\n## ${text}\n\n`
          }
          return match // Keep original if it doesn't look like a heading
        })
      
      // Step 5: Convert lists
      workingText = workingText
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n\n$1\n\n')
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n\n$1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      
      // Step 6: Remove remaining HTML tags (but preserve placeholders)
      // First, temporarily replace placeholders with a safe marker
      const placeholderMap = new Map<string, string>()
      imagePositions.forEach(({ image }, index) => {
        const placeholder = `[IMAGE_PLACEHOLDER_${index}]`
        const safeMarker = `__PLACEHOLDER_${index}__`
        placeholderMap.set(safeMarker, placeholder)
        workingText = workingText.replace(new RegExp(placeholder.replace(/[\[\]]/g, '\\$&'), 'g'), safeMarker)
      })
      
      // Now remove HTML tags
      workingText = workingText.replace(/<[^>]*>/g, '')
      
      // Restore placeholders
      placeholderMap.forEach((placeholder, safeMarker) => {
        workingText = workingText.replace(new RegExp(safeMarker.replace(/[\[\]]/g, '\\$&'), 'g'), placeholder)
      })
      
      // Step 7: Decode HTML entities
      workingText = workingText
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
      
      // Step 8: Clean up multiple newlines
      workingText = workingText
        .replace(/\n{4,}/g, '\n\n\n') // Max 3 newlines
        .replace(/^\n+/, '') // Remove leading newlines
        .replace(/\n+$/, '') // Remove trailing newlines
      
      // Step 9: Map image positions from HTML to text positions
      // Find placeholder positions in the converted text, then remove them in reverse order
      const placeholderPositions: Array<{ index: number; pos: number }> = []
      imagePositions.forEach(({ image }, index) => {
        const placeholder = `[IMAGE_PLACEHOLDER_${index}]`
        const placeholderPos = workingText.indexOf(placeholder)
        if (placeholderPos !== -1) {
          // Store the position in the image data
          ;(image as any).textPosition = placeholderPos
          placeholderPositions.push({ index, pos: placeholderPos })
          console.log(`📸 Mapped image "${image.filename}" to text position ${placeholderPos}`)
        } else {
          // Placeholder not found - log warning but don't fail
          console.warn(`⚠️ Placeholder [IMAGE_PLACEHOLDER_${index}] not found for image "${image.filename}"`)
        }
      })
      
      // Replace placeholders with markdown images in reverse order to preserve positions
      // Use exact position replacement to maintain image positions in text
      placeholderPositions.sort((a, b) => b.pos - a.pos) // Sort by position descending
      placeholderPositions.forEach(({ index }) => {
        const placeholder = `[IMAGE_PLACEHOLDER_${index}]`
        const image = imagePositions[index]?.image
        if (image) {
          // Replace placeholder with markdown image using data URL
          // Add newlines around image to ensure it's on its own line and preserves position
          const imageMarkdown = `\n\n![${image.filename}](${image.data})\n\n`
          // Use exact position replacement to maintain order
          const placeholderIndex = workingText.indexOf(placeholder)
          if (placeholderIndex !== -1) {
            workingText = workingText.substring(0, placeholderIndex) + 
                         imageMarkdown + 
                         workingText.substring(placeholderIndex + placeholder.length)
            console.log(`📸 Replaced placeholder [IMAGE_PLACEHOLDER_${index}] with markdown image for "${image.filename}" at position ${placeholderIndex}`)
          } else {
            console.warn(`⚠️ Placeholder [IMAGE_PLACEHOLDER_${index}] not found in text`)
          }
        } else {
          // If image not found, just remove placeholder
          workingText = workingText.replace(placeholder, '')
          console.warn(`⚠️ Image not found for placeholder [IMAGE_PLACEHOLDER_${index}], removing placeholder`)
        }
      })
      
      text = workingText.trim()
      
      console.log('Converted text length:', text.length)
      console.log('First 200 chars:', text.substring(0, 200))
      
    } catch (mammothError) {
      console.log('Mammoth.js parsing failed, using JSZip fallback:', mammothError)
      
      // Fallback to JSZip-based parsing
      const uint8Array = new Uint8Array(buffer)
        const zip = await JSZip.loadAsync(uint8Array)
        
      // Extract images from JSZip
        const mediaFolder = zip.folder('word/media')
        if (mediaFolder) {
        console.log('Extracting images from word/media (fallback)...')
          const mediaFiles = Object.keys(mediaFolder.files).filter(filename => !mediaFolder.files[filename].dir)
          
          for (const filename of mediaFiles) {
            try {
              const imageBuffer = await mediaFolder.file(filename)?.async('arraybuffer')
              if (imageBuffer) {
                const base64 = Buffer.from(imageBuffer).toString('base64')
                const extension = filename.split('.').pop()?.toLowerCase() || 'png'
                const mimeType = `image/${extension}`
                images.push({
                  filename: filename,
                  data: `data:${mimeType};base64,${base64}`,
                  type: mimeType
                })
              console.log(`Extracted image (fallback): ${filename}`)
              }
            } catch (error) {
              console.warn(`Failed to extract image ${filename}:`, error)
            }
          }
        }
        
      // Extract text using JSZip
      const documentXml = await zip.file('word/document.xml')?.async('text')
        if (documentXml) {
        // Simple text extraction from XML
        text = documentXml
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
      }
      
      console.log('Fallback text extracted, length:', text.length)
    }
    
    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '4.0.0' // Updated version for Mammoth.js
    } : undefined
    
    // Return images if they were extracted
    const result: ParseResult & { images?: Array<{filename: string, data: string, type: string}> } = { text, metadata }
    if (images.length > 0) {
      result.images = images
    }

    return result
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new ParseError(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}


export async function parseXlsx(buffer: ArrayBuffer, options: {
  includeMetadata?: boolean
  normalizeWhitespace?: boolean
} = {}): Promise<ParseResult & { images?: Array<{filename: string, data: string, type: string}> }> {
  try {
    // Convert ArrayBuffer to Uint8Array for xlsx
    const uint8Array = new Uint8Array(buffer)
    
    // Extract images from XLSX (XLSX is a ZIP archive, images are in xl/media/)
    const images: Array<{filename: string, data: string, type: string}> = []
    
    try {
      const zip = await JSZip.loadAsync(uint8Array)
      const mediaFolder = zip.folder('xl/media')
      
      if (mediaFolder) {
        console.log('Extracting images from xl/media...')
        // Get only files that are actually in xl/media (not nested folders)
        // and filter for image file extensions only
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        const mediaFiles = Object.keys(mediaFolder.files)
          .filter(filename => {
            const file = mediaFolder.files[filename]
            // Only process files (not directories) that are directly in xl/media
            if (file.dir) return false
            // Check if it's an image file by extension
            const extension = filename.split('.').pop()?.toLowerCase()
            return extension && imageExtensions.includes(extension)
          })
        
        console.log(`Found ${mediaFiles.length} image files in xl/media folder:`, mediaFiles)
        
        // Image size limits (warn about large high-res images)
        const MAX_IMAGE_SIZE = 500 * 1024 // 500KB per image (recommended)
        const WARNING_IMAGE_SIZE = 200 * 1024 // 200KB per image (warning threshold)
        const MAX_TOTAL_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB total for all images
        let totalImageSize = 0
        const largeImages: string[] = []
        
        for (const filename of mediaFiles) {
          try {
            // Get the file object directly from mediaFolder.files
            const fileEntry = mediaFolder.files[filename]
            if (!fileEntry || fileEntry.dir) {
              console.warn(`⚠️ Skipping ${filename} - not a file or is a directory`)
              continue
            }
            
            // Try to get file by full path first, then by relative path
            let imageBuffer: ArrayBuffer | undefined
            try {
              imageBuffer = await fileEntry.async('arraybuffer')
            } catch (fileError) {
              // Try alternative: get file by full path from root zip
              const fullPath = `xl/media/${filename}`
              const rootFile = zip.file(fullPath)
              if (rootFile) {
                imageBuffer = await rootFile.async('arraybuffer')
                console.log(`✅ Retrieved ${filename} using full path: ${fullPath}`)
              } else {
                console.warn(`⚠️ Could not find file ${filename} in zip archive`)
                throw fileError
              }
            }
            
            if (imageBuffer && imageBuffer.byteLength > 0) {
              const imageSizeKB = imageBuffer.byteLength / 1024
              const imageSizeMB = imageBuffer.byteLength / (1024 * 1024)
              
              // Check for large high-resolution images
              if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
                largeImages.push(`${filename} (${imageSizeMB.toFixed(2)}MB)`)
                // Don't warn - images are uploaded to Spaces, size is not an issue
              }
              
              totalImageSize += imageBuffer.byteLength
              
              // Note: Large images will be uploaded to S3, not skipped
              // We only skip if they exceed a very large limit (10MB) to prevent memory issues
              const ABSOLUTE_MAX_SIZE = 10 * 1024 * 1024 // 10MB absolute limit
              if (imageBuffer.byteLength > ABSOLUTE_MAX_SIZE) {
                console.warn(`⚠️ Skipping image ${filename} - exceeds absolute limit (${imageSizeMB.toFixed(2)}MB). Maximum is ${(ABSOLUTE_MAX_SIZE / (1024 * 1024)).toFixed(2)}MB per image.`)
                continue
              }
              
              // Convert to base64 for transmission (will be uploaded to S3 on server)
              const base64 = Buffer.from(imageBuffer).toString('base64')
              const extension = filename.split('.').pop()?.toLowerCase() || 'png'
              // Map common extensions to MIME types
              const mimeTypeMap: Record<string, string> = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
                'svg': 'image/svg+xml'
              }
              const mimeType = mimeTypeMap[extension] || `image/${extension}`
              images.push({
                filename: filename,
                data: `data:${mimeType};base64,${base64}`,
                type: mimeType
              })
              console.log(`✅ Extracted image: ${filename} (${mimeType}, ${imageSizeKB.toFixed(2)}KB)`)
            } else {
              console.warn(`⚠️ Image buffer is null or empty for: ${filename}`)
            }
          } catch (error) {
            console.warn(`❌ Failed to extract image ${filename}:`, error)
          }
        }
        
        // Don't warn about total image size - images are uploaded to Spaces, size is not an issue
        
        // Don't warn about large images - they're uploaded to Spaces, size is not an issue
        console.log(`📸 Total images extracted from xl/media: ${images.length}`)
      } else {
        console.log('⚠️ xl/media folder not found in XLSX file')
      }
    } catch (zipError) {
      console.warn('⚠️ Failed to extract images from XLSX (non-fatal):', zipError)
      // Continue parsing even if image extraction fails
    }
    
    const workbook = XLSX.read(uint8Array, { type: 'array' })
    
    let text = ''
    const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = []
    
    // Process each worksheet
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      
      if (jsonData.length > 0) {
        // Add sheet name as a section
        text += `\n## ${sheetName}\n\n`
        
        // Process rows
        const rows = jsonData as string[][]
        
        // Helper function to filter empty rows
        const filterEmptyRows = (rowsArray: string[][]) => {
          return rowsArray.filter(row => 
            row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim().length > 0)
          )
        }
        
        // Helper function to check if text looks like a table title
        const isTableTitle = (text: string): boolean => {
          if (!text || text.trim().length === 0) return false
          
          const lower = text.toLowerCase()
          const trimmed = text.trim()
          
          // Long text (likely a title)
          if (trimmed.length > 80) return true
          
          // Common table title keywords (Russian and English)
          const titleKeywords = [
            'план', 'график', 'список', 'отчет', 'таблица', 'расписание',
            'plan', 'schedule', 'list', 'report', 'table', 'chart',
            'инструкция', 'руководство', 'правила', 'процедура',
            'instruction', 'guide', 'rules', 'procedure',
            'выполнение', 'контроль', 'проверка', 'отметка',
            'execution', 'control', 'check', 'mark'
          ]
          
          // Check for title patterns
          if (titleKeywords.some(keyword => lower.includes(keyword))) {
            // If it's long or contains multiple words, likely a title
            if (trimmed.length > 30 || trimmed.split(/\s+/).length > 3) {
              return true
            }
          }
          
          // All caps with multiple words (often titles)
          if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length >= 3) {
            return true
          }
          
          return false
        }
        
        // Helper function to check if row looks like column headers
        const isColumnHeaders = (row: string[]): boolean => {
          if (!row || row.length === 0) return false
          
          // Check if cells look like headers (short, common header words)
          const headerKeywords = [
            'задача', 'сотрудник', 'отметка', 'контроль', '№', 'номер', 
            'task', 'employee', 'name', 'description', 'дата', 'date', 
            'время', 'time', 'имя', 'фамилия', 'должность', 'статус',
            'firstname', 'lastname', 'position', 'status', 'role', 'роль'
          ]
          
          const nonEmptyCells = row.filter(cell => {
            const str = String(cell).trim()
            return str.length > 0
          })
          
          if (nonEmptyCells.length === 0) return false
          
          // Most cells should be short (headers are typically short)
          const shortCells = nonEmptyCells.filter(cell => {
            const str = String(cell).trim()
            return str.length < 50 && str.length > 0
          })
          
          // Check if cells contain header keywords or are very short
          const hasHeaderKeywords = nonEmptyCells.some(cell => {
            const str = String(cell).trim().toLowerCase()
            return headerKeywords.some(keyword => str.includes(keyword))
          })
          
          // Headers should be:
          // 1. Mostly short cells (< 50 chars)
          // 2. Contain header keywords OR all cells are reasonably short
          // 3. Not contain quantities
          const isShortEnough = (shortCells.length / nonEmptyCells.length) >= 0.6
          const noQuantities = nonEmptyCells.every(cell => {
            const str = String(cell).trim()
            return !/^\d+(\.\d+)?\s*(ml|g|шт|гр|кг|л)$/i.test(str)
          })
          
          return isShortEnough && noQuantities && (hasHeaderKeywords || nonEmptyCells.every(cell => String(cell).trim().length < 30))
        }
        
        // Helper function to detect day of week headings (same as in parseTextToStructuredContent)
        const isDayOfWeekRow = (row: string[]): boolean => {
          if (!row || row.length === 0) return false
          const firstCell = String(row[0] || '').trim()
          if (!firstCell || firstCell.length < 3) return false
          
          const russianDays = [
            'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
            'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'
          ]
          const englishDays = [
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
          ]
          
          const dayPattern = new RegExp(
            `^(${[...russianDays, ...englishDays].join('|')})[:!.]?$`,
            'i'
          )
          
          return dayPattern.test(firstCell)
        }
        
        // Detect multiple tables by days of week (split by day headings)
        const dayRowIndices: number[] = []
        rows.forEach((row, idx) => {
          if (isDayOfWeekRow(row)) {
            dayRowIndices.push(idx)
          }
        })
        
        // If we have multiple day sections, process each separately
        if (dayRowIndices.length > 0) {
          // Process each day section
          for (let dayIdx = 0; dayIdx < dayRowIndices.length; dayIdx++) {
            const dayRowIdx = dayRowIndices[dayIdx]
            const nextDayRowIdx = dayIdx < dayRowIndices.length - 1 ? dayRowIndices[dayIdx + 1] : rows.length
            const daySection = rows.slice(dayRowIdx, nextDayRowIdx)
            
            if (daySection.length === 0) continue
            
            const dayTitleRow = daySection[0] || []
            const dayTitle = String(dayTitleRow[0] || '').trim()
            let columnHeaders: string[] = []
            let dataRows: string[][] = []
            
            // Look for headers in the section (usually row after day title)
            if (daySection.length > 1) {
              // Try to find headers in next few rows after day title
              for (let i = 1; i < Math.min(daySection.length, 4); i++) {
                const row = daySection[i] || []
                if (isColumnHeaders(row)) {
                  columnHeaders = row.map(h => String(h).trim())
                  // Get all rows after headers as data
                  dataRows = filterEmptyRows(daySection.slice(i + 1))
                  break
                }
              }
              
              // If no headers found, check if first row after day title looks like data
              // In this case, we'll create headers based on first data row length
              if (columnHeaders.length === 0 && daySection.length > 1) {
                // Find first non-empty row after day title
                const firstDataRow = daySection.find((row, idx) => idx > 0 && row.some(cell => String(cell).trim().length > 0))
                if (firstDataRow) {
                  // Create empty headers matching the number of columns in data
                  const numColumns = firstDataRow.length
                  columnHeaders = Array(numColumns).fill('')
                  dataRows = filterEmptyRows(daySection.slice(1))
                }
              }
            }
            
            // Normalize headers to match data rows length
            if (dataRows.length > 0) {
              const maxCols = Math.max(...dataRows.map(row => row.length))
              if (columnHeaders.length < maxCols) {
                // Extend headers with empty strings to match data columns
                columnHeaders = [...columnHeaders, ...Array(maxCols - columnHeaders.length).fill('')]
              } else if (columnHeaders.length > maxCols) {
                // Trim headers to match data columns
                columnHeaders = columnHeaders.slice(0, maxCols)
              }
            }
            
            // Create table for this day section
            if (dataRows.length > 0) {
              tables.push({
                title: dayTitle || `Day ${dayIdx + 1}`,
                headers: columnHeaders,
                rows: dataRows.map(row => row.map(cell => String(cell)))
              })
            }
          }
        } else {
          // Original logic for single table per sheet
          let tableTitle = sheetName // Default to sheet name
          let columnHeaders: string[] = []
          let dataRows: string[][] = []
          
          if (rows.length > 0) {
            const firstRow = rows[0] || []
            const firstRowText = firstRow.join(' ').trim()
            
            // Check if first row is a table title (long text, title keywords, spans many columns)
            if (isTableTitle(firstRowText) || (firstRow.length === 1 && firstRowText.length > 50)) {
              tableTitle = firstRowText
              
              // Check if second row (or next non-empty row) contains headers
              if (rows.length > 1) {
                for (let i = 1; i < Math.min(rows.length, 4); i++) {
                  const row = rows[i] || []
                  if (isColumnHeaders(row)) {
                    columnHeaders = row.map(h => String(h).trim())
                    dataRows = filterEmptyRows(rows.slice(i + 1))
                    break
                  }
                }
                
                // If no headers found, create empty headers based on data
                if (columnHeaders.length === 0 && dataRows.length === 0) {
                  const firstDataRow = rows.find((row, idx) => idx > 0 && row.some(cell => String(cell).trim().length > 0))
                  if (firstDataRow) {
                    const numColumns = firstDataRow.length
                    columnHeaders = Array(numColumns).fill('')
                    dataRows = filterEmptyRows(rows.slice(1))
                  }
                }
              }
            } else if (isColumnHeaders(firstRow)) {
              // First row is headers, no separate title
              columnHeaders = firstRow.map(h => String(h).trim())
              dataRows = filterEmptyRows(rows.slice(1))
            } else {
              // No clear title or headers, create empty headers based on data
              if (rows.length > 0) {
                const maxCols = Math.max(...rows.map(row => row.length))
                columnHeaders = Array(maxCols).fill('')
                dataRows = filterEmptyRows(rows)
              }
            }
          }
          
          // Normalize headers to match data rows length
          if (dataRows.length > 0) {
            const maxCols = Math.max(...dataRows.map(row => row.length))
            if (columnHeaders.length < maxCols) {
              columnHeaders = [...columnHeaders, ...Array(maxCols - columnHeaders.length).fill('')]
            } else if (columnHeaders.length > maxCols) {
              columnHeaders = columnHeaders.slice(0, maxCols)
            }
          }
          
          // Final check: if we have headers and data, create table
          const hasValidTable = columnHeaders.length > 0 && dataRows.length > 0
          
          // Create table if we have valid structure
          if (hasValidTable) {
            tables.push({
              title: tableTitle,
              headers: columnHeaders,
              rows: dataRows.map(row => row.map(cell => String(cell)))
            })
          } else if (dataRows.length > 0) {
            // Create table with data but no headers (but ensure headers array matches)
            tables.push({
              title: tableTitle,
              headers: columnHeaders,
              rows: dataRows.map(row => row.map(cell => String(cell)))
            })
          }
        }
        
        // Add text content only if no table was created for this sheet
        // (This is handled within the table creation logic above)
      }
    })

    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '1.0.0'
    } : undefined

    return {
      text,
      metadata,
      tables,
      ...(images.length > 0 ? { images } : {})
    }
  } catch (error) {
    throw new ParseError(`Failed to parse XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseDocument(file: File): Promise<ParsedContent> {
  console.log('parseDocument called with file:', file.name, 'size:', file.size, 'type:', file.type)
  
  // Add cache-busting timestamp to ensure fresh parsing
  const parseTimestamp = Date.now()
  console.log('Parse timestamp (cache-busting):', parseTimestamp)
  
  // Validate file size (100MB limit - images are stored separately in Spaces, only text content is counted)
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  if (file.size > MAX_FILE_SIZE) {
    throw new ParseError(`File size exceeds 100MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`)
  }
  
  const buffer = await file.arrayBuffer()
  console.log('Buffer created, size:', buffer.byteLength)
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  console.log('File extension detected:', fileExtension)
  
  // Validate file format by checking magic bytes
  const uint8Array = new Uint8Array(buffer)
  
  if (fileExtension === 'docx') {
    // DOCX files should start with PK (ZIP signature)
    if (uint8Array.length < 4 || uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new ParseError('Invalid DOCX file format - file does not appear to be a valid DOCX document')
    }
    console.log('DOCX file format validated')
  } else if (fileExtension === 'xlsx') {
    // XLSX files should also start with PK (ZIP signature)
    if (uint8Array.length < 4 || uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new ParseError('Invalid XLSX file format - file does not appear to be a valid XLSX document')
    }
    console.log('XLSX file format validated')
  }
  
  let parseResult: ParseResult
  
  try {
    switch (fileExtension) {
      case 'docx':
        console.log('Parsing DOCX file...')
        parseResult = await parseDocx(buffer, { 
          includeMetadata: true, 
          normalizeWhitespace: false // DON'T normalize - we want to preserve newlines!
        })
        console.log('DOCX parsing completed, text length:', parseResult.text.length)
        break
      case 'xlsx':
        console.log('Parsing XLSX file...')
        parseResult = await parseXlsx(buffer, { 
          includeMetadata: true, 
          normalizeWhitespace: false // Don't normalize - preserve line breaks and formatting
        })
        console.log('XLSX parsing completed, text length:', parseResult.text.length)
        break
      default:
        throw new UnsupportedFileTypeError(`File type '${fileExtension}' is not supported. Only DOCX and XLSX files are supported.`)
    }
  } catch (error) {
    console.error('Parse error in parseDocument:', error)
    if (error instanceof UnsupportedFileTypeError || error instanceof ParseError) {
      throw error
    }
    throw new FileReadError(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Parse the extracted text into structured content
  console.log('Converting to structured content...')
  const structuredContent = parseTextToStructuredContent(parseResult.text, file.name)
  
  // Merge tables from XLSX parsing if they exist
  if (parseResult.tables && parseResult.tables.length > 0) {
    console.log('Found tables in parseResult:', parseResult.tables.length)
    structuredContent.tables = [...structuredContent.tables, ...parseResult.tables]
  }
  
  // Merge images from document parsing (DOCX or XLSX) if they exist
  if ('images' in parseResult && parseResult.images && Array.isArray(parseResult.images) && parseResult.images.length > 0) {
    console.log('Found images in parseResult:', parseResult.images.length)
    structuredContent.images = parseResult.images.map((img, index) => {
      // Use textPosition if available (from HTML parsing), otherwise use index
      const position = (img as any).textPosition !== undefined 
        ? (img as any).textPosition 
        : (img.position !== undefined ? img.position : undefined)
      return {
        filename: img.filename || `image_${index + 1}.png`,
        data: img.data,
        type: img.type || 'image/png',
        position: position
      }
    })
    console.log('Images added to structured content:', structuredContent.images.length)
    structuredContent.images.forEach((img, idx) => {
      console.log(`Image ${idx + 1}: ${img.filename}, position: ${img.position}`)
    })
  } else {
    // Ensure images array exists even if empty
    structuredContent.images = []
  }
  
  // Ensure line breaks are preserved in the content
  if (structuredContent.sections && structuredContent.sections.length > 0) {
    structuredContent.sections = structuredContent.sections.map(section => ({
      ...section,
      content: section.content.replace(/\n/g, '\n') // Ensure line breaks are preserved
    }))
  }
  
  console.log('Structured content created:', structuredContent)
  console.log('Total tables in structured content:', structuredContent.tables.length)
  console.log('Total images in structured content:', structuredContent.images.length)
  
  // Add parsing metadata to track improvements
  structuredContent.metadata = {
    ...structuredContent.metadata,
    parseTimestamp,
    parserVersion: '4.0.0', // Updated for Mammoth.js integration
    cacheBusting: true,
    totalImages: structuredContent.images.length
  }
  return structuredContent
}

function parseTextToStructuredContent(text: string, fileName: string): ParsedContent {
  console.log('Raw text input to structured content:', text.substring(0, 200))
  console.log('Line breaks in raw text:', (text.match(/\n/g) || []).length)
  
  // Additional cleaning to remove any remaining HTML/CSS artifacts
  // Preserve structure and readability
  let cleanedText = text
    // Remove any HTML tags (but preserve our custom formatting tags)
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '') // Remove CSS
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Remove JavaScript
    // Only remove HTML tags, not our custom formatting tags like [BOLD], [ITALIC], etc.
    .replace(/<(?![A-Z])[^>]*>/g, '') // Remove HTML tags but not our custom tags
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove any other entities
    // Remove CSS property patterns (but be careful not to remove content)
    // Skip this - it's too aggressive and removes content
  
  // Only normalize whitespace if text doesn't already have good structure
  // If text has many newlines, it likely has good structure already
  const hasGoodStructure = (cleanedText.match(/\n/g) || []).length > 10
  if (!hasGoodStructure) {
    // Normalize whitespace while preserving structure
    cleanedText = normalizeWhitespace(cleanedText)
  } else {
    // Just normalize line endings
    cleanedText = cleanedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Normalize excessive whitespace within lines (but preserve line breaks)
      .replace(/[ \t]+/g, ' ')
      // Preserve paragraph breaks
      .replace(/\n{3,}/g, '\n\n')
  }
  
  console.log('Cleaned text for structured content:', cleanedText.substring(0, 200))
  console.log('Line breaks in cleaned text:', (cleanedText.match(/\n/g) || []).length)
  
  // Check if text has formatting tags - if so, don't force line breaks aggressively
  const hasFormattingTags = /\[(?:BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)/.test(cleanedText)
  
  // Force line breaks if text appears continuous
  let finalText = cleanedText
  if (finalText && finalText.length > 50 && !finalText.includes('\n')) {
    console.log('Structured content: Text appears continuous, forcing line breaks...')
    
    if (hasFormattingTags) {
      // If text has formatting tags, be more careful not to break them
      finalText = finalText
        .replace(/([.!?])\s+(?![^\[]*\[)/g, '$1\n') // After sentence endings, but not within tags
        .replace(/\n\s*\n/g, '\n') // Clean up multiple line breaks
        .trim()
    } else {
      // No formatting tags, can be more aggressive
      finalText = finalText
        .replace(/(\d+г\s+\d+р)/g, '$1\n') // After weight and price
        .replace(/([.!?])\s+/g, '$1\n') // After sentence endings
        .replace(/([а-яё])\s+([А-ЯЁ])/g, '$1\n$2') // Before capital letters after lowercase
        .replace(/(\d+р)\s+([А-ЯЁ])/g, '$1\n$2') // After price before capital letters
        .replace(/(🎞\s*СЛАЙД\s*\d+)/g, '\n$1\n') // Around slide markers
        .replace(/([А-ЯЁ][а-яё]+\s*[А-ЯЁ][а-яё]*\.)/g, '$1\n') // After names/titles ending with period
        .replace(/\n\s*\n/g, '\n') // Clean up multiple line breaks
        .trim()
    }
    
    console.log('Structured content: After forcing line breaks:', finalText.substring(0, 200))
    console.log('Line breaks after forcing:', (finalText.match(/\n/g) || []).length)
  }
  
  const sections: Array<{ title: string; level: number; content: string; order: number }> = []
  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = []
  
  let currentSection: { title: string; level: number; content: string; order: number } | null = null
  let sectionOrder = 1
  
  // Split lines - images are already in the text as markdown, just preserve them
  const lines = finalText.split('\n')
  console.log('Lines after splitting:', lines.length)
  console.log('First few lines:', lines.slice(0, 5))
  
  // Improved heading detection and list preservation
  for (const line of lines) {
    const trimmedLine = line.trim()
    const lineLength = line.length + 1 // +1 for newline
    
    // Check for markdown-style headings (with #)
    if (trimmedLine.startsWith('#')) {
      const level = (trimmedLine.match(/^#+/) || [''])[0].length
      const title = trimmedLine.replace(/^#+\s*/, '').trim()
      
      // Skip empty headings or headings that are just formatting tags (with or without closing tag)
      const isEmptyHeading = !title || 
        /^\[(BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]\s*\[\/\1\]$/i.test(title) ||
        /^\[(BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]$/i.test(title)
      
      if (!isEmptyHeading) {
        // Only create a new section if the heading has actual content
        if (currentSection) {
          sections.push(currentSection)
        }
        
        currentSection = {
          title,
          level: Math.min(level, 6), // Max level 6
          content: '',
          order: sectionOrder++
        }
      }
      // If it's an empty heading, continue adding content to current section (or create one if none exists)
      else if (!currentSection) {
        // Create a default section if we don't have one yet
        currentSection = {
          title: fileName.replace(/\.[^/.]+$/, ''), // Use filename as title
          level: 1,
          content: '',
          order: sectionOrder++
        }
      }
      // Otherwise, just continue with current section (don't create a new one)
    }
    // Check for days of the week (Monday, Tuesday, etc. or Russian equivalents)
    else if (isDayOfWeekHeading(trimmedLine)) {
      if (currentSection) {
        sections.push(currentSection)
      }
      
      currentSection = {
        title: trimmedLine,
        level: 2, // Все дни недели - один уровень
        content: '',
        order: sectionOrder++
      }
    }
    // Check for all-caps headings (simple heuristic)
    else if (trimmedLine.length > 3 && trimmedLine === trimmedLine.toUpperCase() && !trimmedLine.includes('|')) {
      if (currentSection) {
        sections.push(currentSection)
      }
      
      currentSection = {
        title: trimmedLine,
        level: 2,
        content: '',
        order: sectionOrder++
      }
    }
    // Regular content (preserve lists with markers like 1., 2., or •)
    else {
      // If no section exists, create a default section for content without headings
      if (!currentSection) {
        currentSection = {
          title: fileName.replace(/\.[^/.]+$/, ''), // Use filename as title
          level: 1,
          content: '',
          order: sectionOrder++
        }
      }
      
      // Add content as-is - images are already in the text at their correct positions
      // Check if line contains image markdown - always preserve these lines at their exact position
      const hasImageMarkdown = /!\[([^\]]*)\]\(data:[^)]+\)/.test(line)
      
      if (hasImageMarkdown) {
        // Line contains image - preserve it exactly as it appears (may have newlines before/after)
        // Don't add extra newlines, just preserve what's already there
        if (currentSection.content.trim().length > 0 && !currentSection.content.endsWith('\n\n')) {
          currentSection.content += '\n'
        }
        currentSection.content += line.trim()
        if (!currentSection.content.endsWith('\n\n')) {
          currentSection.content += '\n'
        }
      } else if (trimmedLine.length === 0) {
        // Empty line = paragraph break (add double newline)
        currentSection.content += '\n\n'
      } else {
        // Check if this line is a list item
        const isListItem = /^\s*(\d+\.|•|-|\*)\s/.test(trimmedLine)
        
        if (isListItem || trimmedLine.length > 0) {
          // Add line as-is
          currentSection.content += (currentSection.content ? '\n' : '') + line
        }
      }
    }
  }
  
  // Add the last section
  if (currentSection) {
    sections.push(currentSection)
  }
  
  // If no sections were found, create a single section with all content
  if (sections.length === 0) {
    sections.push({
      title: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
      level: 1,
      content: finalText,
      order: 1
    })
  }
  
  // Simple table detection (lines with | separators)
  const tableLines = lines.filter(line => line.includes('|') && line.trim().split('|').length > 2)
  if (tableLines.length > 0) {
    const tableData = tableLines.map(line => 
      line.split('|').map(cell => cell.trim()).filter(cell => cell)
    )
    
    if (tableData.length > 1) {
      tables.push({
        title: 'Data Table',
        headers: tableData[0],
        rows: tableData.slice(1)
      })
    }
  }
  
  // Calculate word count
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  
  console.log('Final sections created:', sections.length)
  console.log('First section content:', sections[0]?.content?.substring(0, 200))
  
  return {
    sections,
    tables,
    images: [], // Images would be extracted in parseDocx and passed here
    metadata: {
      totalSections: sections.length,
      totalTables: tables.length,
      wordCount,
      totalImages: 0
    }
  }
}

// Helper function to detect days of the week as headings
function isDayOfWeekHeading(line: string): boolean {
  if (!line || line.length < 3) return false
  
  // Normalize line - remove trailing punctuation but keep for matching
  const normalized = line.trim()
  
  // Russian days of the week (case-insensitive)
  const russianDays = [
    'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
    'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'
  ]
  
  // English days of the week (case-insensitive)
  const englishDays = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  ]
  
  // Check if line starts with or is a day name (with optional colon/punctuation)
  const dayPattern = new RegExp(
    `^(${[...russianDays, ...englishDays].join('|')})[:!.]?$`,
    'i'
  )
  
  // Check if it's a day name
  if (dayPattern.test(normalized)) {
    return true
  }
  
  // Check if it's a day name followed by colon/exclamation and optional text (like "ВТОРНИК:" or "СРЕДА:")
  const dayWithTextPattern = new RegExp(
    `^(${[...russianDays, ...englishDays].join('|')})[:!]\\s*.+`,
    'i'
  )
  
  if (dayWithTextPattern.test(normalized)) {
    return true
  }
  
  // Also check for uppercase versions (common in documents like "ВТОРНИК:" or "СРЕДА:")
  const upperLine = normalized.toUpperCase()
  const upperDayPattern = new RegExp(
    `^(${[...russianDays, ...englishDays].map(d => d.toUpperCase()).join('|')})[:!.]?$`,
    'i'
  )
  
  if (upperDayPattern.test(upperLine)) {
    return true
  }
  
  return false
}
