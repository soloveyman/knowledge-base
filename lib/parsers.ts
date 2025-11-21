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

// Enhanced image interface with position and context
export interface ParsedImage {
  filename: string
  data: string  // base64 encoded (temporary, will be replaced with S3 URL)
  type: string
  position: number  // Position in text (required)
  htmlPosition?: number  // Position in HTML (for DOCX)
  sectionIndex?: number  // Which section contains this image
  paragraphIndex?: number  // Which paragraph in section
  contextBefore?: string  // 50 chars before image
  contextAfter?: string  // 50 chars after image
  placeholder?: string  // Unique placeholder ID for replacement
  // XLSX specific
  cellRef?: string  // Cell reference (e.g., "A5")
  sheetName?: string  // Sheet name (for XLSX)
  rowIndex?: number  // Row index (for XLSX)
  colIndex?: number  // Column index (for XLSX)
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
  images: ParsedImage[]
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

// Image replacement log for debugging
export interface ImageReplacementLog {
  imageId: string
  filename: string
  originalPosition: number
  sectionIndex?: number
  replacementType: 'placeholder' | 'data-url' | 'relative-path' | 'new-insertion'
  success: boolean
  error?: string
  placeholder?: string
  s3Url?: string
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
} = {}): Promise<ParseResult & { images?: ParsedImage[] }> {
  try {
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Empty or invalid buffer provided')
    }

    console.log('📄 Parsing DOCX with Mammoth.js...')
    
    let text = ''
    const images: ParsedImage[] = []
    let imageCounter = 0
    
    try {
      // Step 1: Extract images from DOCX archive (word/media/)
      const uint8Array = new Uint8Array(buffer)
      const zip = await JSZip.loadAsync(uint8Array)
      const mediaFolder = zip.folder('word/media')
      
      if (mediaFolder) {
        console.log('📸 Extracting images from word/media...')
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        const mediaFiles = Object.keys(mediaFolder.files)
          .filter(filename => {
            const file = mediaFolder.files[filename]
            if (file.dir) return false
            const extension = filename.split('.').pop()?.toLowerCase()
            return extension && imageExtensions.includes(extension)
          })
        
        console.log(`📸 Found ${mediaFiles.length} image files`)
        
        const ABSOLUTE_MAX_SIZE = 10 * 1024 * 1024 // 10MB limit
        
        for (const filename of mediaFiles) {
          try {
            const fileEntry = mediaFolder.files[filename]
            if (!fileEntry || fileEntry.dir) continue
            
            let imageBuffer: ArrayBuffer | undefined
            try {
              imageBuffer = await fileEntry.async('arraybuffer')
            } catch (fileError) {
              const fullPath = `word/media/${filename}`
              const rootFile = zip.file(fullPath)
              if (rootFile) {
                imageBuffer = await rootFile.async('arraybuffer')
              } else {
                throw fileError
              }
            }
            
            if (imageBuffer && imageBuffer.byteLength > 0 && imageBuffer.byteLength <= ABSOLUTE_MAX_SIZE) {
              const base64 = Buffer.from(imageBuffer).toString('base64')
              const extension = filename.split('.').pop()?.toLowerCase() || 'png'
              const mimeTypeMap: Record<string, string> = {
                'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'bmp': 'image/bmp', 'webp': 'image/webp', 'svg': 'image/svg+xml'
              }
              const mimeType = mimeTypeMap[extension] || `image/${extension}`
              
              const placeholder = `[IMG_${imageCounter++}]`
              images.push({
                filename,
                data: `data:${mimeType};base64,${base64}`,
                type: mimeType,
                position: -1, // Will be set after HTML parsing
                placeholder
              })
              console.log(`✅ Extracted image: ${filename} (${mimeType})`)
            }
          } catch (error) {
            console.warn(`❌ Failed to extract image ${filename}:`, error)
          }
        }
      }
      
      // Step 2: Convert DOCX to HTML using Mammoth (basic conversion)
      const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        "p[style-name='Заголовок 1'] => h1:fresh",
        "p[style-name='Заголовок 2'] => h2:fresh",
        "p[style-name='Заголовок 3'] => h3:fresh",
        "p[style-name='Заголовок 4'] => h4:fresh",
        "p[style-name='Заголовок 5'] => h5:fresh",
        "p[style-name='Заголовок 6'] => h6:fresh",
      ]
      
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        { styleMap, includeDefaultStyleMap: true }
      )
      
      const htmlText = result.value
      console.log(`📄 HTML converted, length: ${htmlText.length}`)
      
      // Step 3: Extract images from HTML and replace with placeholders
      // Find all img tags in HTML and match with extracted images
      const imgTagRegex = /<img[^>]+src="data:([^;]+);base64,([^"]+)"[^>]*>/gi
      const htmlImageMatches: Array<{ match: RegExpMatchArray; htmlPos: number; mimeType: string; base64Data: string }> = []
      
      let match
      while ((match = imgTagRegex.exec(htmlText)) !== null) {
        htmlImageMatches.push({
          match,
          htmlPos: match.index,
          mimeType: match[1],
          base64Data: match[2]
        })
      }
      
      // Match HTML images with extracted images or create new ones
      let htmlWithPlaceholders = htmlText
      const processedImages: ParsedImage[] = []
      
      // Process in reverse order to preserve positions
      for (let i = htmlImageMatches.length - 1; i >= 0; i--) {
        const { match, htmlPos, mimeType, base64Data } = htmlImageMatches[i]
        const base64Prefix = base64Data.substring(0, 50)
        
        // Try to find matching image in extracted images
        let image = images.find(img => img.data.includes(base64Prefix))
        
        if (!image) {
          // Create new image from HTML
          const placeholder = `[IMG_${imageCounter++}]`
          image = {
            filename: `image_${processedImages.length + 1}.${mimeType.split('/')[1] || 'png'}`,
            data: `data:${mimeType};base64,${base64Data}`,
            type: mimeType,
            position: -1,
            htmlPosition: htmlPos,
            placeholder
          }
          images.push(image)
        }
        
        // Replace img tag with placeholder
        if (image.placeholder) {
          htmlWithPlaceholders = htmlWithPlaceholders.substring(0, htmlPos) + 
            image.placeholder + 
            htmlWithPlaceholders.substring(htmlPos + match[0].length)
          image.htmlPosition = htmlPos
          processedImages.push(image)
          console.log(`📸 Replaced img tag with placeholder ${image.placeholder} at HTML position ${htmlPos}`)
        }
      }
      
      // Step 4: Convert HTML to text (improved - extract all text before removing tags)
      // Helper function to extract text from HTML recursively
      const extractTextFromHtml = (html: string): string => {
        // First decode HTML entities
        let text = html
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#160;/g, ' ')
          .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Other entities
        
        // Extract text from all tags recursively - preserve text content
        // Replace block elements with newlines first
        text = text
          .replace(/<p[^>]*>/gi, '\n\n')
          .replace(/<\/p>/gi, '')
          .replace(/<br[^>]*>/gi, '\n')
          .replace(/<div[^>]*>/gi, '\n')
          .replace(/<\/div>/gi, '')
          .replace(/<h1[^>]*>/gi, '\n\n# ')
          .replace(/<\/h1>/gi, '\n\n')
          .replace(/<h2[^>]*>/gi, '\n\n## ')
          .replace(/<\/h2>/gi, '\n\n')
          .replace(/<h3[^>]*>/gi, '\n\n### ')
          .replace(/<\/h3>/gi, '\n\n')
          .replace(/<h4[^>]*>/gi, '\n\n#### ')
          .replace(/<\/h4>/gi, '\n\n')
          .replace(/<h5[^>]*>/gi, '\n\n##### ')
          .replace(/<\/h5>/gi, '\n\n')
          .replace(/<h6[^>]*>/gi, '\n\n###### ')
          .replace(/<\/h6>/gi, '\n\n')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<ul[^>]*>/gi, '\n')
          .replace(/<\/ul>/gi, '\n')
          .replace(/<ol[^>]*>/gi, '\n')
          .replace(/<\/ol>/gi, '\n')
        
        // Now remove all remaining tags (but keep their text content)
        // Use a more careful approach: replace tags with spaces to preserve word boundaries
        text = text.replace(/<[^>]+>/g, ' ')
        
        // Clean up multiple spaces and newlines
        text = text
          .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
          .replace(/\n{4,}/g, '\n\n\n') // Max 3 newlines
          .replace(/[ \t]+\n/g, '\n') // Spaces before newlines
          .replace(/\n[ \t]+/g, '\n') // Spaces after newlines
          .replace(/^\n+/, '') // Leading newlines
          .replace(/\n+$/, '') // Trailing newlines
        
        return text.trim()
      }
      
      let workingText = extractTextFromHtml(htmlWithPlaceholders)
      
      // Step 5: Map placeholder positions to text positions and extract context
      for (const image of processedImages) {
        if (image.placeholder) {
          const placeholderPos = workingText.indexOf(image.placeholder)
          if (placeholderPos !== -1) {
            image.position = placeholderPos
            
            // Extract context (50 chars before and after)
            image.contextBefore = workingText.substring(Math.max(0, placeholderPos - 50), placeholderPos).trim()
            image.contextAfter = workingText.substring(
              placeholderPos + image.placeholder.length,
              Math.min(workingText.length, placeholderPos + image.placeholder.length + 50)
            ).trim()
            
            // Replace placeholder with markdown (temporary, will be replaced with S3 URL later)
            const imageMarkdown = `\n\n![${image.filename}](${image.data})\n\n`
            workingText = workingText.substring(0, placeholderPos) + 
              imageMarkdown + 
              workingText.substring(placeholderPos + image.placeholder.length)
            
            console.log(`📸 Mapped image "${image.filename}" to position ${placeholderPos} (context: "${image.contextBefore.substring(Math.max(0, image.contextBefore.length - 20))}...${image.contextAfter.substring(0, 20)}")`)
          }
        }
      }
      
      text = workingText.trim()
      console.log(`📄 Text extracted, length: ${text.length}`)
      
    } catch (mammothError) {
      console.warn('⚠️ Mammoth.js parsing failed, using JSZip fallback:', mammothError)
      
      // Fallback: improved text extraction from document.xml
      const uint8Array = new Uint8Array(buffer)
      const zip = await JSZip.loadAsync(uint8Array)
      const documentXml = await zip.file('word/document.xml')?.async('text')
      
      if (documentXml) {
        // Extract text more carefully - preserve word boundaries
        // First decode HTML entities
        text = documentXml
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#160;/g, ' ')
          .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Other entities
        
        // Extract text from Word XML structure
        // Word uses <w:t> tags for text content
        const textMatches = documentXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)
        if (textMatches && textMatches.length > 0) {
          // Extract text from <w:t> tags
          text = textMatches
            .map(match => {
              const content = match.replace(/<w:t[^>]*>|<\/w:t>/gi, '')
              return content
            })
            .join(' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#160;/g, ' ')
            .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        } else {
          // Fallback to simple tag removal if <w:t> tags not found
          text = documentXml
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
        }
        
        // Clean up whitespace but preserve structure
        text = text
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }
    }
    
    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '5.0.0' // New version with enhanced image handling
    } : undefined
    
    // Ensure all images have required position (set to end if not found)
    for (const image of images) {
      if (image.position === -1) {
        image.position = text.length
        console.warn(`⚠️ Image "${image.filename}" position not found, set to end of text`)
      }
    }
    
    const result: ParseResult & { images?: ParsedImage[] } = { text, metadata }
    if (images.length > 0) {
      result.images = images
      console.log(`📸 Returning ${images.length} images with positions and context`)
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
} = {}): Promise<ParseResult & { images?: ParsedImage[] }> {
  try {
    const uint8Array = new Uint8Array(buffer)
    const images: ParsedImage[] = []
    let imageCounter = 0
    
    // Step 1: Extract images from XLSX archive (xl/media/)
    try {
      const zip = await JSZip.loadAsync(uint8Array)
      const mediaFolder = zip.folder('xl/media')
      
      if (mediaFolder) {
        console.log('📸 Extracting images from xl/media...')
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        const mediaFiles = Object.keys(mediaFolder.files)
          .filter(filename => {
            const file = mediaFolder.files[filename]
            if (file.dir) return false
            const extension = filename.split('.').pop()?.toLowerCase()
            return extension && imageExtensions.includes(extension)
          })
        
        const ABSOLUTE_MAX_SIZE = 10 * 1024 * 1024 // 10MB limit
        
        for (const filename of mediaFiles) {
          try {
            const fileEntry = mediaFolder.files[filename]
            if (!fileEntry || fileEntry.dir) continue
            
            let imageBuffer: ArrayBuffer | undefined
            try {
              imageBuffer = await fileEntry.async('arraybuffer')
            } catch (fileError) {
              const fullPath = `xl/media/${filename}`
              const rootFile = zip.file(fullPath)
              if (rootFile) {
                imageBuffer = await rootFile.async('arraybuffer')
              } else {
                throw fileError
              }
            }
            
            if (imageBuffer && imageBuffer.byteLength > 0 && imageBuffer.byteLength <= ABSOLUTE_MAX_SIZE) {
              const base64 = Buffer.from(imageBuffer).toString('base64')
              const extension = filename.split('.').pop()?.toLowerCase() || 'png'
              const mimeTypeMap: Record<string, string> = {
                'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'bmp': 'image/bmp', 'webp': 'image/webp', 'svg': 'image/svg+xml'
              }
              const mimeType = mimeTypeMap[extension] || `image/${extension}`
              
              const placeholder = `[IMG_${imageCounter++}]`
              images.push({
                filename,
                data: `data:${mimeType};base64,${base64}`,
                type: mimeType,
                position: -1, // Will be set based on cell position
                placeholder
              })
              console.log(`✅ Extracted image: ${filename} (${mimeType})`)
            }
          } catch (error) {
            console.warn(`❌ Failed to extract image ${filename}:`, error)
          }
        }
      }
    } catch (zipError) {
      console.warn('⚠️ Failed to extract images from XLSX (non-fatal):', zipError)
    }
    
    // Step 2: Parse XLSX workbook
    const workbook = XLSX.read(uint8Array, { type: 'array' })
    
    let text = ''
    const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = []
    
    // Step 3: Process each worksheet (simplified table extraction)
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      
      if (jsonData.length > 0) {
        text += `\n## ${sheetName}\n\n`
        const rows = jsonData as string[][]
        
        // Try to map images to cells (simplified: assign to first sheet if multiple)
        // In real XLSX, images are linked via drawing relationships, but we'll use a simple heuristic
        if (images.length > 0 && sheetIndex === 0) {
          // Distribute images across rows (simple heuristic)
          const imagesPerRow = Math.ceil(images.length / Math.max(rows.length, 1))
          images.forEach((img, imgIdx) => {
            const rowIndex = Math.floor(imgIdx / imagesPerRow)
            const colIndex = imgIdx % imagesPerRow
            if (rowIndex < rows.length) {
              img.sheetName = sheetName
              img.rowIndex = rowIndex
              img.colIndex = colIndex
              // Generate cell reference (A=0, B=1, etc.)
              const colLetter = String.fromCharCode(65 + (colIndex % 26))
              img.cellRef = `${colLetter}${rowIndex + 1}`
              console.log(`📸 Mapped image "${img.filename}" to cell ${img.cellRef} (row ${rowIndex}, col ${colIndex})`)
            }
          })
        }
        
        // Simplified table extraction: first row as headers, rest as data
        if (rows.length > 1) {
          const headers = rows[0].map(h => String(h).trim())
          const dataRows = rows.slice(1).filter(row => 
            row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim().length > 0)
          )
          
          if (dataRows.length > 0) {
            // Normalize column count
            const maxCols = Math.max(...dataRows.map(row => row.length), headers.length)
            const normalizedHeaders = [...headers, ...Array(Math.max(0, maxCols - headers.length)).fill('')]
            
            tables.push({
              title: sheetName,
              headers: normalizedHeaders.slice(0, maxCols),
              rows: dataRows.map(row => {
                const normalized = [...row.map(cell => String(cell)), ...Array(Math.max(0, maxCols - row.length)).fill('')]
                return normalized.slice(0, maxCols)
              })
            })
            console.log(`📊 Created table "${sheetName}" with ${normalizedHeaders.length} columns and ${dataRows.length} rows`)
          }
        }
        
        // Add text content from rows
        rows.forEach((row, rowIdx) => {
          const rowText = row.map(cell => String(cell).trim()).filter(cell => cell).join(' ')
          if (rowText) {
            text += rowText + '\n'
            
            // Check if any images should be inserted at this row position
            images.forEach(img => {
              if (img.rowIndex === rowIdx && img.sheetName === sheetName) {
                // Insert image placeholder in text at this position
                const placeholder = img.placeholder || `[IMG_${imageCounter++}]`
                text += `\n${placeholder}\n`
                img.position = text.length - placeholder.length - 1
                console.log(`📸 Inserted image placeholder ${placeholder} at row ${rowIdx} in sheet "${sheetName}"`)
              }
            })
          }
        })
      }
    })
    
    // Set positions for images that weren't assigned to specific rows
    let currentTextPos = text.length
    images.forEach(img => {
      if (img.position === -1) {
        img.position = currentTextPos
        currentTextPos += 100 // Space for image markdown
      }
    })

    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '5.0.0' // New version with enhanced image handling
    } : undefined

    // Ensure all images have required position
    for (const image of images) {
      if (image.position === -1) {
        image.position = text.length
        console.warn(`⚠️ Image "${image.filename}" position not found, set to end of text`)
      }
    }

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
  
  // Validate file size (20MB limit - images are stored separately in Spaces, only text content is counted)
  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
  if (file.size > MAX_FILE_SIZE) {
    throw new ParseError(`File size exceeds 20MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`)
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
    console.log(`📸 Found ${parseResult.images.length} images in parseResult`)
    structuredContent.images = parseResult.images.map((img) => {
      // Ensure all required fields are present
      return {
        filename: img.filename || `image_${img.placeholder || 'unknown'}.png`,
        data: img.data,
        type: img.type || 'image/png',
        position: img.position !== undefined ? img.position : -1,
        placeholder: img.placeholder,
        htmlPosition: img.htmlPosition,
        contextBefore: img.contextBefore,
        contextAfter: img.contextAfter,
        // XLSX specific
        cellRef: img.cellRef,
        sheetName: img.sheetName,
        rowIndex: img.rowIndex,
        colIndex: img.colIndex
      }
    })
    console.log(`📸 Images added to structured content: ${structuredContent.images.length}`)
    structuredContent.images.forEach((img, idx) => {
      console.log(`  Image ${idx + 1}: ${img.filename}, position: ${img.position}, placeholder: ${img.placeholder || 'none'}`)
      if (img.cellRef) {
        console.log(`    Cell: ${img.cellRef} in sheet "${img.sheetName}"`)
      }
    })
  } else {
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
    parserVersion: '5.0.0', // Enhanced with position tracking, placeholders, context, and cell references
    cacheBusting: true,
    totalImages: structuredContent.images.length
  }
  return structuredContent
}

function parseTextToStructuredContent(text: string, fileName: string): ParsedContent {
  console.log('Raw text input to structured content:', text.substring(0, 200))
  console.log('Line breaks in raw text:', (text.match(/\n/g) || []).length)
  
  // Additional cleaning to remove any remaining HTML/CSS artifacts
  // Preserve structure and readability - extract text from tags before removing them
  let cleanedText = text
    // First decode HTML entities to preserve special characters
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#160;/g, ' ')
    .replace(/&#32;/g, ' ')
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\r')
    // Decode numeric entities (common ones)
    .replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10)
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : ' '
    })
    // Remove script and style content (they don't contain visible text)
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
    // Remove HTML structure tags but preserve their text content
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    // Extract text from common HTML tags before removing them
    // Replace block elements with newlines to preserve structure
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br[^>]*>/gi, '\n')
    // Remove all remaining HTML tags (but text inside should already be extracted)
    // Use space replacement to preserve word boundaries
    .replace(/<(?![A-Z])[^>]*>/g, ' ') // Remove HTML tags but not our custom tags like [BOLD]
    .replace(/<\/[^>]*>/g, ' ') // Remove closing tags
    // Remove any remaining entities (should be rare after decoding above)
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
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

/**
 * Validates document structure after image replacement
 * Checks that all images are properly placed and no data URLs remain
 */
export function validateDocumentStructure(
  content: string, 
  images: ParsedImage[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check 1: All images should have valid positions
  images.forEach((img, idx) => {
    if (img.position === undefined || img.position === -1) {
      errors.push(`Image ${idx + 1} (${img.filename}) has invalid position`)
    }
  })
  
  // Check 2: No data URLs should remain in content (all should be replaced with S3 URLs)
  const dataUrlPattern = /data:image\/[^)]+/g
  const dataUrls = content.match(dataUrlPattern)
  if (dataUrls && dataUrls.length > 0) {
    warnings.push(`Found ${dataUrls.length} data URL(s) in content - should be replaced with S3 URLs`)
  }
  
  // Check 3: All placeholders should be replaced
  const placeholderPattern = /\[IMG_\d+\]/g
  const placeholders = content.match(placeholderPattern)
  if (placeholders && placeholders.length > 0) {
    errors.push(`Found ${placeholders.length} unreplaced placeholder(s) in content`)
  }
  
  // Check 4: Image count should match
  const imageRefs = content.match(/!\[.*?\]\([^)]+\)/g) || []
  if (imageRefs.length !== images.length) {
    warnings.push(`Image count mismatch: ${imageRefs.length} image references in content vs ${images.length} images in array`)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Creates a detailed log of image replacements for debugging
 */
export function createImageReplacementLog(
  images: ParsedImage[],
  replacements: Array<{
    imageId: string
    filename: string
    originalPosition: number
    sectionIndex?: number
    replacementType: 'placeholder' | 'data-url' | 'relative-path' | 'new-insertion'
    success: boolean
    error?: string
    placeholder?: string
    s3Url?: string
  }>
): ImageReplacementLog[] {
  return images.map((img, idx) => {
    const replacement = replacements.find(r => r.imageId === img.placeholder || r.filename === img.filename)
    
    return {
      imageId: img.placeholder || `img_${idx}`,
      filename: img.filename,
      originalPosition: img.position,
      sectionIndex: img.sectionIndex,
      replacementType: replacement?.replacementType || 'new-insertion',
      success: replacement?.success ?? false,
      error: replacement?.error,
      placeholder: img.placeholder,
      s3Url: replacement?.s3Url
    }
  })
}
