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
 */
export function processTextWithEnhancedFormatting(text: string): FormattedText {
  if (!text) {
    return { html: '', plainText: '' }
  }

  // First, clean any existing HTML tags from the input text
  let html = text
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&lt;/g, '<') // Decode HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs, but preserve line breaks
    .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
    .trim()
  
  console.log('Text formatting input after cleaning:', html.substring(0, 200))
  console.log('Line breaks in text:', (html.match(/\n/g) || []).length)
  
  // Process alignment markers first
  html = html.replace(/\[CENTER\](.*?)\[\/CENTER\]/gs, '<p class="text-center">$1</p>')
  html = html.replace(/\[RIGHT\](.*?)\[\/RIGHT\]/gs, '<p class="text-right">$1</p>')
  html = html.replace(/\[JUSTIFY\](.*?)\[\/JUSTIFY\]/gs, '<p class="text-justify">$1</p>')
  
  // Process [BOLD] tags
  html = html.replace(/\[BOLD\](.*?)\[\/BOLD\]/gs, '<strong class="font-bold">$1</strong>')
  
  // Process [ITALIC] tags
  html = html.replace(/\[ITALIC\](.*?)\[\/ITALIC\]/gs, '<em class="italic">$1</em>')
  
  // Process bold and italic (markdown-style)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  console.log('After alignment processing:', html.substring(0, 200))
  
  // Process line breaks - preserve paragraph structure
  html = html.replace(/\n\n/g, '</p><p>') // Double line breaks become paragraph breaks
  html = html.replace(/\n/g, '<br>') // Single line breaks become line breaks
  
  console.log('After line break processing:', html.substring(0, 200))
  
  // Wrap in paragraph tags if not already wrapped
  if (!html.startsWith('<p')) {
    html = '<p>' + html
  }
  if (!html.endsWith('</p>')) {
    html = html + '</p>'
  }
  
  // Final cleanup - remove any remaining HTML tags that shouldn't be there
  html = html.replace(/<p[^>]*class="text-center"[^>]*>/g, '<p class="text-center">')
  html = html.replace(/<p[^>]*class="text-right"[^>]*>/g, '<p class="text-right">')
  html = html.replace(/<p[^>]*class="text-justify"[^>]*>/g, '<p class="text-justify">')
  
  // Remove any stray closing tags that might be left over
  html = html.replace(/<\/p>\s*$/g, '') // Remove trailing </p>
  html = html.replace(/^<p>\s*/g, '') // Remove leading <p>
  
  console.log('After final cleanup:', html.substring(0, 200))
  
  // Escape HTML characters for security
  html = escapeHtml(html)
  
  // Re-apply formatting after escaping
  html = html.replace(/&lt;strong class="font-bold"&gt;(.*?)&lt;\/strong&gt;/g, '<strong class="font-bold">$1</strong>')
  html = html.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
  html = html.replace(/&lt;em class="italic"&gt;(.*?)&lt;\/em&gt;/g, '<em class="italic">$1</em>')
  html = html.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, '<em>$1</em>')
  html = html.replace(/&lt;br&gt;/g, '<br>')
  html = html.replace(/&lt;p class="text-center"&gt;(.*?)&lt;\/p&gt;/g, '<p class="text-center">$1</p>')
  html = html.replace(/&lt;p class="text-right"&gt;(.*?)&lt;\/p&gt;/g, '<p class="text-right">$1</p>')
  html = html.replace(/&lt;p class="text-justify"&gt;(.*?)&lt;\/p&gt;/g, '<p class="text-justify">$1</p>')
  
  console.log('Final HTML output:', html.substring(0, 200))

  return {
    html,
    plainText: text.replace(/\[(CENTER|RIGHT|JUSTIFY)\].*?\[\/\1\]/g, (match, alignment) => {
      return match.replace(`[${alignment}]`, '').replace(`[/${alignment}]`, '')
    })
  }
}
