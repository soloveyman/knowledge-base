/**
 * Utility functions for processing and formatting parsed document text
 */

export interface FormattedText {
  html: string
  plainText: string
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
export function processStructuredContent(content: any): FormattedText {
  if (!content || !content.sections) {
    return { html: '', plainText: '' }
  }

  const processedSections = content.sections.map((section: any) => {
    if (section.type === 'text' && section.content) {
      const processed = processTextWithAlignment(section.content)
      return `<div class="mb-4">${processed.html}</div>`
    }
    return ''
  }).filter(Boolean)

  return {
    html: processedSections.join('\n'),
    plainText: content.sections.map((section: any) => section.content || '').join('\n')
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

  // Process [BOLD] and [ITALIC] tags
  let html = text
    .replace(/\[BOLD\](.*?)\[\/BOLD\]/gs, '<strong class="font-bold">$1</strong>')
    .replace(/\[ITALIC\](.*?)\[\/ITALIC\]/gs, '<em class="italic">$1</em>')
  
  // Process alignment tags with block elements
  html = html
    .replace(/\[CENTER\](.*?)\[\/CENTER\]/gs, '<div class="mb-4 text-center">$1</div>')
    .replace(/\[RIGHT\](.*?)\[\/RIGHT\]/gs, '<div class="mb-4 text-right">$1</div>')
    .replace(/\[JUSTIFY\](.*?)\[\/JUSTIFY\]/gs, '<div class="mb-4 text-justify">$1</div>')
  
  // Process markdown-style formatting
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Process line breaks
  html = html
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br>')
  
  // Wrap in paragraph tags if not already wrapped
  if (!html.trim().startsWith('<')) {
    html = '<p class="mb-4">' + html
  }
  if (!html.trim().endsWith('>')) {
    html = html + '</p>'
  }

  return {
    html,
    plainText: text.replace(/\[(CENTER|RIGHT|JUSTIFY)\].*?\[\/\1\]/g, '')
  }
}
