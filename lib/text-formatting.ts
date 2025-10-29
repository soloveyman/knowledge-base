/**
 * Utility functions for processing and formatting parsed document text
 */

export interface FormattedText {
  html: string
  plainText: string
}

export interface ContentSection {
  type: string
  content?: string
}

export interface StructuredContent {
  sections: ContentSection[]
}

/**
 * Process text with alignment markers and convert to HTML
 */
export function processTextWithAlignment(text: string): FormattedText {
  if (!text) {
    return { html: '', plainText: '' }
  }

  // Split text into lines to preserve paragraph structure
  const lines = text.split('\n')
  
  const processedLines = lines.map(line => {
    if (!line.trim()) {
      return '<br>'
    }

    let processedLine = line.trim()
    let alignmentClass = ''

    // Check for alignment markers
    if (processedLine.startsWith('[CENTER]') && processedLine.endsWith('[/CENTER]')) {
      processedLine = processedLine.slice(8, -9) // Remove markers
      alignmentClass = 'text-center'
    } else if (processedLine.startsWith('[RIGHT]') && processedLine.endsWith('[/RIGHT]')) {
      processedLine = processedLine.slice(7, -8) // Remove markers
      alignmentClass = 'text-right'
    } else if (processedLine.startsWith('[JUSTIFY]') && processedLine.endsWith('[/JUSTIFY]')) {
      processedLine = processedLine.slice(9, -10) // Remove markers
      alignmentClass = 'text-justify'
    }

    // Escape HTML characters
    processedLine = escapeHtml(processedLine)

    // Wrap in paragraph with alignment class
    if (alignmentClass) {
      return `<p class="${alignmentClass}">${processedLine}</p>`
    } else {
      return `<p class="text-left">${processedLine}</p>`
    }
  })

  return {
    html: processedLines.join('\n'),
    plainText: text.replace(/\[(CENTER|RIGHT|JUSTIFY)\].*?\[\/\1\]/g, (match, alignment) => {
      return match.replace(`[${alignment}]`, '').replace(`[/${alignment}]`, '')
    })
  }
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Process structured content from parsers
 */
export function processStructuredContent(content: StructuredContent): FormattedText {
  if (!content || !content.sections) {
    return { html: '', plainText: '' }
  }

  const processedSections = content.sections.map((section: ContentSection) => {
    if (section.type === 'text' && section.content) {
      const processed = processTextWithAlignment(section.content)
      return `<div class="mb-4">${processed.html}</div>`
    }
    return ''
  }).filter(Boolean)

  return {
    html: processedSections.join('\n'),
    plainText: content.sections.map((section: ContentSection) => section.content || '').join('\n')
  }
}

/**
 * Enhanced text processing with additional formatting
 */
export function processTextWithFormatting(text: string): FormattedText {
  if (!text) {
    return { html: '', plainText: '' }
  }

  // First process alignment
  const alignmentProcessed = processTextWithAlignment(text)
  
  // Then process other formatting (bold, italic, etc.)
  let html = alignmentProcessed.html
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // Convert *italic* to <em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Convert line breaks to <br> tags
  html = html.replace(/\n/g, '<br>')

  return {
    html,
    plainText: alignmentProcessed.plainText
  }
}

/**
 * Process text with enhanced formatting including tables and lists
 * This is a simpler version that just handles basic formatting
 * For full rendering with lists/headings, use renderFormattedText from content-renderer.tsx
 */
export function processTextWithEnhancedFormatting(text: string): FormattedText {
  if (!text) {
    return { html: '', plainText: '' }
  }

  // First pass: Process [BOLD] and [ITALIC] tags
  let html = text
    .replace(/\[BOLD\]([\s\S]*?)\[\/BOLD\]/g, '<strong class="font-bold">$1</strong>')
    .replace(/\[ITALIC\]([\s\S]*?)\[\/ITALIC\]/g, '<em class="italic">$1</em>')
  
  // Process alignment tags with block elements
  html = html
    .replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/g, '<div class="mb-4 text-center">$1</div>')
    .replace(/\[RIGHT\]([\s\S]*?)\[\/RIGHT\]/g, '<div class="mb-4 text-right">$1</div>')
    .replace(/\[JUSTIFY\]([\s\S]*?)\[\/JUSTIFY\]/g, '<div class="mb-4 text-justify">$1</div>')
  
  // Process markdown-style formatting
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Process line breaks - split by double newlines for paragraphs, single for breaks
  // Also handle single newlines as paragraph breaks when there are formatting markers
  const hasFormattingMarkers = html.includes('[BOLD]') || html.includes('[ITALIC]')
  
  let paragraphs: string[]
  if (html.match(/\n{2,}/) || (hasFormattingMarkers && html.includes('\n'))) {
    // Split by double+ newlines, or by single newlines if formatting is present
    paragraphs = html.split(/\n\n+/)
  } else {
    // Single newlines - split on them
    paragraphs = html.split('\n')
  }
  
  const processedParagraphs = paragraphs
    .map(paragraph => {
      const trimmed = paragraph.trim()
      if (!trimmed) return ''
      // Convert remaining \n to <br> within the paragraph
      const processedParagraph = trimmed.replace(/\n/g, '<br>')
      return `<p class="mb-4 leading-relaxed">${processedParagraph}</p>`
    })
    .filter(p => p)
  
  html = processedParagraphs.join('')

  return {
    html,
    plainText: text.replace(/\[(CENTER|RIGHT|JUSTIFY)\].*?\[\/\1\]/g, '')
  }
}
