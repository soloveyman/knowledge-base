import * as XLSX from 'xlsx'
import * as pdfParse from 'pdf-parse'
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

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(buffer)
    console.log('Parsing DOCX with improved parser...')
    
    let text = ''
    const images: Array<{filename: string, data: string, type: string}> = []
    
    // Add timeout to prevent hanging
    const parseWithTimeout = async () => {
      try {
        // Try JSZip first, but fallback to regex if it fails
        console.log('Attempting JSZip extraction...')
        const zip = await JSZip.loadAsync(uint8Array)
        
        // Extract document.xml and styles.xml from the DOCX package
        const documentXml = await zip.file('word/document.xml')?.async('text')
        const stylesXml = await zip.file('word/styles.xml')?.async('text')
        const mediaFolder = zip.folder('word/media')
        if (mediaFolder) {
          console.log('Extracting images from word/media...')
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
                console.log(`Extracted image: ${filename}`)
              }
            } catch (error) {
              console.warn(`Failed to extract image ${filename}:`, error)
            }
          }
        }
        
        if (documentXml) {
          console.log('Found document.xml, extracting text with formatting...')
          
          // Helper to get paragraph style
          const getParagraphStyle = (paragraph: string): string | null => {
            const styleMatch = paragraph.match(/<w:pStyle w:val="([^"]*)"[^>]*>/)
            return styleMatch ? styleMatch[1] : null
          }
          
          // Check if paragraph is a list item
          const isListItem = (paragraph: string): { isList: boolean; isOrdered: boolean; level?: number } => {
            const numPrMatch = paragraph.match(/<w:numPr[^>]*>.*?<\/w:numPr>/gs)
            if (numPrMatch) {
              const ilvlMatch = paragraph.match(/<w:ilvl w:val="(\d+)"/)
              const level = ilvlMatch ? parseInt(ilvlMatch[1]) : 0
              return { isList: true, isOrdered: true, level }
            }
            const bulletMatch = paragraph.match(/<w:rPr>.*?<w:rFonts[^>]*w:ascii="Symbol"[^>]*>.*?<\/w:rPr>/)
            return bulletMatch ? { isList: true, isOrdered: false, level: 0 } : { isList: false, isOrdered: false }
          }
          
          // Parse paragraphs to maintain structure and alignment
          const paragraphs = documentXml.match(/<w:p[^>]*>.*?<\/w:p>/gs) || []
          
          const parsedParagraphs = paragraphs.map(paragraph => {
            // Extract text runs within this paragraph
            const textRuns = paragraph.match(/<w:r[^>]*>.*?<\/w:r>/gs) || []
            
            let paragraphText = ''
            let isBold = false
            let isItalic = false
            
            let previousRunFormatting = { bold: false, italic: false }
            
            textRuns.forEach(run => {
              // Check for formatting in this run
              const runIsBold = run.includes('<w:b/>') || run.includes('<w:b ')
              const runIsItalic = run.includes('<w:i/>') || run.includes('<w:i ')
              
              // Extract text from each run
              const textMatches = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
              if (textMatches) {
                textMatches.forEach(match => {
                  let textContent = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1')
                  
                  // Close previous formatting if it differs
                  if (previousRunFormatting.bold && !runIsBold) {
                    paragraphText += '[/BOLD]'
                  }
                  if (previousRunFormatting.italic && !runIsItalic) {
                    paragraphText += '[/ITALIC]'
                  }
                  
                  // Open formatting if it's starting
                  if (!previousRunFormatting.bold && runIsBold) {
                    paragraphText += '[BOLD]'
                  }
                  if (!previousRunFormatting.italic && runIsItalic) {
                    paragraphText += '[ITALIC]'
                  }
                  
                  paragraphText += textContent
                  
                  // Update previous formatting
                  previousRunFormatting = { bold: runIsBold, italic: runIsItalic }
                })
              }
              
              // Track if any run has formatting
              if (runIsBold) isBold = true
              if (runIsItalic) isItalic = true
            })
            
            // Close any remaining formatting at the end of the paragraph
            if (previousRunFormatting.bold) {
              paragraphText += '[/BOLD]'
            }
            if (previousRunFormatting.italic) {
              paragraphText += '[/ITALIC]'
            }
            
            // Get paragraph style to detect headings
            const style = getParagraphStyle(paragraph)
            let headingLevel = 0
            
            if (style) {
              if (style.includes('Heading1') || style.includes('Title')) {
                headingLevel = 1
              } else if (style.includes('Heading2')) {
                headingLevel = 2
              } else if (style.includes('Heading3')) {
                headingLevel = 3
              } else if (style.includes('Heading4')) {
                headingLevel = 4
              } else if (style.includes('Heading5')) {
                headingLevel = 5
              } else if (style.includes('Heading6')) {
                headingLevel = 6
              }
            }
            
            // Check for list items
            const listInfo = isListItem(paragraph)
            
            // Check for paragraph alignment
            const alignmentMatch = paragraph.match(/<w:jc w:val="([^"]*)"/)
            const alignment = alignmentMatch ? alignmentMatch[1] : 'left'
            
            // Build the formatted paragraph
            let formattedText = paragraphText.trim()
            
            // Add list markers
            if (listInfo.isList) {
              const indent = '  '.repeat(listInfo.level || 0)
              if (listInfo.isOrdered) {
                formattedText = `${indent}1. ${formattedText}`
              } else {
                formattedText = `${indent}• ${formattedText}`
              }
            }
            
            // Add heading markers
            if (headingLevel > 0) {
              formattedText = `${'#'.repeat(headingLevel)} ${formattedText}`
            }
            
            // Add alignment markers only if there's actual content
            if (formattedText && formattedText.trim().length > 0) {
              if (alignment === 'center') {
                formattedText = `[CENTER]${formattedText}[/CENTER]`
              } else if (alignment === 'right') {
                formattedText = `[RIGHT]${formattedText}[/RIGHT]`
              } else if (alignment === 'justify') {
                formattedText = `[JUSTIFY]${formattedText}[/JUSTIFY]`
              }
            }
            
            return formattedText
          }).filter(p => p.length > 0)
          
          console.log('Parsed paragraphs count:', parsedParagraphs.length)
          console.log('First few paragraphs:', parsedParagraphs.slice(0, 3))
          
          text = parsedParagraphs.join('\n')
          
          // Clean up empty tag pairs immediately
          text = text.replace(/\[CENTER\]\s*\[\/CENTER\]/g, '')
          text = text.replace(/\[RIGHT\]\s*\[\/RIGHT\]/g, '')
          text = text.replace(/\[JUSTIFY\]\s*\[\/JUSTIFY\]/g, '')
          
          // Clean up any HTML/CSS/XML artifacts that might have been embedded
          console.log('Raw extracted text before cleaning:', text.substring(0, 200))
          
          text = text
            // Remove any HTML tags
            .replace(/<html[^>]*>/gi, '')
            .replace(/<\/html>/gi, '')
            .replace(/<head[^>]*>.*?<\/head>/gis, '')
            .replace(/<body[^>]*>/gi, '')
            .replace(/<\/body>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove CSS
            .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove JavaScript
            .replace(/<[^>]*>/g, '') // Remove any remaining XML/HTML tags
            .replace(/<p[^>]*>/g, '') // Remove <p> tags
            .replace(/<\/p>/g, '\n') // Replace </p> with newlines
            // Decode HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ') // Remove non-breaking spaces
            .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove any other entities
            // Remove CSS property patterns (e.g., margin:10px; color:#fff;)
            .replace(/([a-z-]+):\s*[^;]+;?/gi, '')
            // Normalize spaces and tabs, but preserve line breaks
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
            .trim()
          
          console.log('Text after cleaning:', text.substring(0, 200))
          
          // If no structured text found, try to extract any readable text
          if (!text || text.length < 10) {
            console.log('No structured text found, trying fallback extraction...')
            const readableText = documentXml
              .replace(/<[^>]*>/g, ' ') // Remove XML tags
              .replace(/[^\w\s\u0400-\u04FF\u00C0-\u017F\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF]/g, ' ') // Keep letters, spaces, Cyrillic, Latin extended, punctuation, and symbols
              .replace(/\s+/g, ' ')
              .trim()
            
            if (readableText.length > 10) {
              text = readableText
            }
          }
          
          // Force line breaks based on common patterns if text is still continuous
          if (text && text.length > 50 && !text.includes('\n')) {
            console.log('Text appears continuous, forcing line breaks...')
            // Look for patterns that suggest line breaks should be added
            text = text
              .replace(/(\d+г\s+\d+р)\s+/g, '$1\n') // After weight/price patterns
              .replace(/([а-яё])\s+([А-ЯЁ])/g, '$1\n$2') // Before capital letters after lowercase
              .replace(/(\d+р)\s+([А-ЯЁ])/g, '$1\n$2') // After price before capital letters
              .replace(/([а-яё])\s+([А-ЯЁ][а-яё]*\s+[а-яё])/g, '$1\n$2') // Before menu categories
              .trim()
            console.log('After forcing line breaks:', text.substring(0, 200))
          }
        } else {
          console.log('No document.xml found in DOCX')
        }
        
        console.log('DOCX parsing completed, text length:', text.length)
        
      } catch (extractionError) {
        console.log('JSZip extraction failed, using regex fallback:', extractionError)
        // Fallback: regex-based text extraction with formatting
        const bufferString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
        
        // Parse paragraphs to maintain structure
        const paragraphs = bufferString.match(/<w:p[^>]*>.*?<\/w:p>/gs) || []
        
        const parsedParagraphs = paragraphs.map(paragraph => {
          // Extract text runs within this paragraph
          const textRuns = paragraph.match(/<w:r[^>]*>.*?<\/w:r>/gs) || []
          
          let paragraphText = ''
          textRuns.forEach(run => {
            // Extract text from each run
            const textMatches = run.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
            if (textMatches) {
              textMatches.forEach(match => {
                const textContent = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1')
                paragraphText += textContent
              })
            }
          })
          
          // Check for paragraph alignment
          const alignmentMatch = paragraph.match(/<w:jc w:val="([^"]*)"/)
          const alignment = alignmentMatch ? alignmentMatch[1] : 'left'
          
          // Trim the text first
          paragraphText = paragraphText.trim()
          
          // Add alignment markers only if there's actual content
          if (paragraphText && paragraphText.length > 0) {
            if (alignment === 'center') {
              paragraphText = `[CENTER]${paragraphText}[/CENTER]`
            } else if (alignment === 'right') {
              paragraphText = `[RIGHT]${paragraphText}[/RIGHT]`
            } else if (alignment === 'justify') {
              paragraphText = `[JUSTIFY]${paragraphText}[/JUSTIFY]`
            }
          }
          
          return paragraphText
        }).filter(p => p.length > 0)
        
        text = parsedParagraphs.join('\n')
        
        // Clean up empty tag pairs immediately
        text = text.replace(/\[CENTER\]\s*\[\/CENTER\]/g, '')
        text = text.replace(/\[RIGHT\]\s*\[\/RIGHT\]/g, '')
        text = text.replace(/\[JUSTIFY\]\s*\[\/JUSTIFY\]/g, '')
        
        // Clean up any HTML-like tags that might have been embedded
        console.log('Raw fallback text before cleaning:', text.substring(0, 200))
        
        text = text
          // Remove any HTML tags
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>.*?<\/head>/gis, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove CSS
          .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove JavaScript
          .replace(/<[^>]*>/g, '') // Remove any remaining XML/HTML tags
          .replace(/<p[^>]*>/g, '') // Remove <p> tags
          .replace(/<\/p>/g, '\n') // Replace </p> with newlines
          // Decode HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove any other entities
          // Remove CSS property patterns (e.g., margin:10px; color:#fff;)
          .replace(/([a-z-]+):\s*[^;]+;?/gi, '')
          // Normalize spaces and tabs, but preserve line breaks
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
          .trim()
        
        console.log('Fallback text after cleaning:', text.substring(0, 200))
        
        // If no structured text found, try to extract any readable text
        if (!text || text.length < 10) {
          const readableText = bufferString
            .replace(/<[^>]*>/g, ' ')
            .replace(/[^\w\s\u0400-\u04FF\u00C0-\u017F\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          
          if (readableText.length > 10) {
            text = readableText
          } else {
            text = 'Document content extracted (basic parsing)'
          }
        }
        
        // Force line breaks based on common patterns if text is still continuous
        if (text && text.length > 50 && !text.includes('\n')) {
          console.log('Fallback: Text appears continuous, forcing line breaks...')
          // Look for patterns that suggest line breaks should be added
          text = text
            .replace(/(\d+г\s+\d+р)\s+/g, '$1\n') // After weight/price patterns
            .replace(/([а-яё])\s+([А-ЯЁ])/g, '$1\n$2') // Before capital letters after lowercase
            .replace(/(\d+р)\s+([А-ЯЁ])/g, '$1\n$2') // After price before capital letters
            .replace(/([а-яё])\s+([А-ЯЁ][а-яё]*\s+[а-яё])/g, '$1\n$2') // Before menu categories
            .trim()
          console.log('Fallback: After forcing line breaks:', text.substring(0, 200))
        }
        
        console.log('Fallback DOCX parsing completed, text length:', text.length)
      }
      
      return text
    }
    
    // Execute parsing with timeout
    text = await Promise.race([
      parseWithTimeout(),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('DOCX parsing timeout after 10 seconds')), 10000)
      )
    ])
    
    if (options.normalizeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim()
    }

    const metadata: ParseMetadata | undefined = options.includeMetadata ? {
      parsedAt: new Date(),
      parserVersion: '3.0.0'
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
          normalizeWhitespace: true 
        })
        console.log('DOCX parsing completed, text length:', parseResult.text.length)
        break
      case 'xlsx':
        console.log('Parsing XLSX file...')
        parseResult = await parseXlsx(buffer, { 
          includeMetadata: true, 
          normalizeWhitespace: true 
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
    parserVersion: '3.0.0', // Increment this when making parsing improvements
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
  
  const lines = finalText.split('\n').filter(line => line.trim())
  console.log('Lines after splitting:', lines.length)
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
      // Check if this line is a list item
      const isListItem = /^\s*(\d+\.|•|-|\*)\s/.test(trimmedLine)
      
      // If it's a list item or regular content, add it
      if (isListItem || trimmedLine.length > 0) {
        currentSection.content += (currentSection.content ? '\n' : '') + line
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
        currentSection.content += (currentSection.content ? '\n' : '') + line
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
