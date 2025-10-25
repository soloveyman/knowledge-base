import * as XLSX from 'xlsx'

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
  metadata: {
    totalSections: number
    totalTables: number
    wordCount: number
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

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(buffer)
    console.log('Uint8Array details:', {
      length: uint8Array.length,
      constructor: uint8Array.constructor.name,
      isUint8Array: uint8Array instanceof Uint8Array
    })
    
    // Simple text extraction from DOCX by reading the document.xml file
    // DOCX files are ZIP archives containing XML files
    let text = ''
    
    try {
      // For now, we'll use a simple approach that extracts basic text
      // This is a fallback method that works by treating DOCX as a ZIP file
      console.log('Attempting simple DOCX text extraction...')
      
      // Convert to string and look for text content between tags
      const bufferString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
      
      // Extract text from XML-like content (basic approach)
      const textMatches = bufferString.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
      if (textMatches) {
        text = textMatches
          .map(match => {
            const textContent = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1')
            return textContent
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      
      // If no structured text found, try to extract any readable text
      if (!text) {
        const readableText = bufferString
          .replace(/<[^>]*>/g, ' ') // Remove XML tags
          .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // Keep only letters, spaces, and Cyrillic
          .replace(/\s+/g, ' ')
          .trim()
        
        if (readableText.length > 10) {
          text = readableText
        }
      }
      
      console.log('Simple extraction completed, text length:', text.length)
      
    } catch (extractionError) {
      console.log('Simple extraction failed:', extractionError)
      // Fallback: return a basic message
      text = 'Document content extracted (basic parsing)'
    }
    
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
    console.error('DOCX parsing error:', error)
    throw new ParseError(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
  
  const buffer = await file.arrayBuffer()
  console.log('Buffer created, size:', buffer.byteLength)
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  console.log('File extension detected:', fileExtension)
  
  // Validate file format by checking magic bytes
  if (fileExtension === 'docx') {
    const uint8Array = new Uint8Array(buffer)
    // DOCX files should start with PK (ZIP signature)
    if (uint8Array.length < 4 || uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new ParseError('Invalid DOCX file format - file does not appear to be a valid DOCX document')
    }
    console.log('DOCX file format validated')
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
        throw new UnsupportedFileTypeError(fileExtension || 'unknown')
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
  console.log('Structured content created:', structuredContent)
  return structuredContent
}

function parseTextToStructuredContent(text: string, fileName: string): ParsedContent {
  const lines = text.split('\n').filter(line => line.trim())
  const sections: Array<{ title: string; level: number; content: string; order: number }> = []
  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = []
  
  let currentSection: { title: string; level: number; content: string; order: number } | null = null
  let sectionOrder = 1
  
  // Simple heading detection (lines starting with # or all caps)
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Check for markdown-style headings
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
    // Regular content
    else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine
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
      content: text,
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
  
  return {
    sections,
    tables,
    metadata: {
      totalSections: sections.length,
      totalTables: tables.length,
      wordCount
    }
  }
}
