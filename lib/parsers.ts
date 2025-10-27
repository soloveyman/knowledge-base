import * as XLSX from 'xlsx'
import * as pdfParse from 'pdf-parse'
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
    .replace(/[ \t]+/g, ' ')
    // Preserve paragraph breaks (2+ newlines)
    .replace(/\n{3,}/g, '\n\n')
    // Normalize single line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Trim each line to prevent leading/trailing spaces
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim()
}

export interface ParseResult {
  readonly text: string
  readonly metadata?: ParseMetadata
}

export interface ParseMetadata {
  readonly fileName?: string
  readonly fileSize?: number
  readonly parsedAt: Date
  readonly parserVersion: string
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
      // Use Mammoth to convert DOCX to HTML
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
        ignoreEmptyParagraphs: true,
      })
      
      console.log('Mammoth conversion completed')
      console.log('Messages:', result.messages.length)
      result.messages.forEach(msg => console.log('Message:', msg.type, msg.message))
      
      // Extract images from Mammoth messages
      result.messages
        .filter((msg: any) => msg.type === 'image')
        .forEach((msg: any) => {
          const image = (msg as any).image
          if (image) {
            images.push({
              filename: image.filename || 'unknown.png',
              data: image.src, // Already base64
              type: image.contentType || 'image/png'
            })
            console.log(`Extracted image: ${image.filename || 'unknown'}`)
          }
        })
      
      // Get the HTML text - keep it as HTML for proper formatting
      const htmlText = result.value
      console.log('HTML text length:', htmlText.length)
      console.log('First 200 chars of HTML:', htmlText.substring(0, 200))
      
      // Convert HTML to plain text with formatting markers
      // Process in order: first extract formatting markers, then structure
      
      // Step 1: Convert paragraph tags to double newlines for paragraph separation
      let workingText = htmlText.replace(/<p[^>]*>/gi, '\n\n')
      
      // Step 2: Convert closing paragraph tags
      workingText = workingText.replace(/<\/p>/gi, '')
      
      // Step 3: Convert formatting tags (bold, italic) - preserve nested tags
      workingText = workingText
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '[BOLD]$1[/BOLD]')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '[BOLD]$1[/BOLD]')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '[ITALIC]$1[/ITALIC]')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '[ITALIC]$1[/ITALIC]')
      
      // Step 4: Convert headings
      workingText = workingText
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n')
        .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n')
        .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n\n###### $1\n\n')
      
      // Step 5: Convert lists
      workingText = workingText
        .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '\n\n$1\n\n')
        .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '\n\n$1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      
      // Step 6: Remove remaining HTML tags
      workingText = workingText.replace(/<[^>]*>/g, '')
      
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
    const result: any = { text, metadata }
    if (images.length > 0) {
      result.images = images
    }

    return result
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new ParseError(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}


export async function parsePdf(buffer: ArrayBuffer, options: {
  includeMetadata?: boolean
  normalizeWhitespace?: boolean
} = {}): Promise<ParseResult> {
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

    // Convert ArrayBuffer to Buffer for pdf-parse
    const uint8Array = new Uint8Array(buffer)
    const pdfBuffer = Buffer.from(uint8Array)
    
    console.log('Parsing PDF with pdf-parse...')
    
    // Use pdf-parse to extract text from PDF with timeout
    const data = await Promise.race([
      pdfParse(pdfBuffer),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF parsing timeout after 15 seconds')), 15000)
      )
    ]) as any
    
    let text = data.text
    
    console.log('PDF parsing completed, text length:', text.length)
    console.log('PDF pages:', data.numpages)
    
    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '1.0.0'
    } : undefined

    return {
      text,
      metadata
    }
  } catch (error) {
    throw new ParseError(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseXlsx(buffer: ArrayBuffer, options: {
  includeMetadata?: boolean
  normalizeWhitespace?: boolean
} = {}): Promise<ParseResult> {
  try {
    // Convert ArrayBuffer to Uint8Array for xlsx
    const uint8Array = new Uint8Array(buffer)
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
        const headers = rows[0] || []
        const dataRows = rows.slice(1)
        
        if (headers.length > 0 && dataRows.length > 0) {
          tables.push({
            title: sheetName,
            headers: headers.map(h => String(h)),
            rows: dataRows.map(row => row.map(cell => String(cell)))
          })
        }
        
        // Add text content
        rows.forEach(row => {
          const rowText = row.filter(cell => cell && String(cell).trim()).join(' | ')
          if (rowText) {
            text += rowText + '\n'
          }
        })
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
      metadata
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
  
  // Validate file size (15MB limit)
  const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
  if (file.size > MAX_FILE_SIZE) {
    throw new ParseError(`File size exceeds 15MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`)
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
  
  // Ensure line breaks are preserved in the content
  if (structuredContent.sections && structuredContent.sections.length > 0) {
    structuredContent.sections = structuredContent.sections.map(section => ({
      ...section,
      content: section.content.replace(/\n/g, '\n') // Ensure line breaks are preserved
    }))
  }
  
  console.log('Structured content created:', structuredContent)
  
  // Add parsing metadata to track improvements
  structuredContent.metadata = {
    ...structuredContent.metadata,
    parseTimestamp,
    parserVersion: '4.0.0', // Updated for Mammoth.js integration
    cacheBusting: true
  }
  return structuredContent
}

function parseTextToStructuredContent(text: string, fileName: string): ParsedContent {
  console.log('Raw text input to structured content:', text.substring(0, 200))
  console.log('Line breaks in raw text:', (text.match(/\n/g) || []).length)
  
  // Additional cleaning to remove any remaining HTML/CSS artifacts
  // Preserve structure and readability
  let cleanedText = text
    // Remove any HTML tags
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>.*?<\/head>/gis, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove CSS
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove JavaScript
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove any other entities
    // Remove CSS property patterns
    .replace(/([a-z-]+):\s*[^;]+;?/gi, '')
  
  // Normalize whitespace while preserving structure
  cleanedText = normalizeWhitespace(cleanedText)
  
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
  
  // Split lines but PRESERVE empty lines (they represent paragraph breaks)
  const lines = finalText.split('\n')
  console.log('Lines after splitting:', lines.length)
  console.log('Lines with empty lines preserved:', lines)
  console.log('First few lines:', lines.slice(0, 5))
  
  const sections: Array<{ title: string; level: number; content: string; order: number }> = []
  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = []
  
  let currentSection: { title: string; level: number; content: string; order: number } | null = null
  let sectionOrder = 1
  
  // Improved heading detection and list preservation
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Check for markdown-style headings (with #)
    if (trimmedLine.startsWith('#')) {
      if (currentSection) {
        sections.push(currentSection)
      }
      
      const level = (trimmedLine.match(/^#+/) || [''])[0].length
      const title = trimmedLine.replace(/^#+\s*/, '').trim()
      
      currentSection = {
        title,
        level: Math.min(level, 6), // Max level 6
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
    else if (currentSection) {
      // Add content - preserve empty lines for paragraph breaks
      if (trimmedLine.length === 0) {
        // Empty line = paragraph break (add double newline)
        currentSection.content += '\n\n'
      } else {
        // Check if this line is a list item
        const isListItem = /^\s*(\d+\.|•|-|\*)\s/.test(trimmedLine)
        
        if (isListItem || trimmedLine.length > 0) {
          currentSection.content += (currentSection.content ? '\n' : '') + line
        }
      }
    }
    else {
      // If no section exists, create a default section for content without headings
      if (!currentSection) {
        currentSection = {
          title: fileName.replace(/\.[^/.]+$/, ''), // Use filename as title
          level: 1,
          content: line,
          order: sectionOrder++
        }
      } else {
        // Preserve empty lines
        if (trimmedLine.length === 0) {
          currentSection.content += '\n\n'
        } else {
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
