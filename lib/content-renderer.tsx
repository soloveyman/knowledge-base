export function renderFormattedText(content: string): string {
  if (!content) return ''
  
  let rendered = content
  
  // FIRST CLEANUP: Remove all "1." type artifacts immediately
  // This catches them before any other processing  
  rendered = rendered.replace(/;\s*1\./g, '')  // "; 1." anywhere (artifact from parsing)
  rendered = rendered.replace(/\.\s*1\./g, '.')  // ". 1." -> "." (artifact at end of sentence)  
  rendered = rendered.replace(/\s+1\.\s*$/gm, '')  // " 1." at end of lines (whitespace + 1.)
  // Note: This should NOT remove "1." at START of lines (legitimate numbered lists)
  
  // Second pass: handle incomplete or malformed tag pairs
  // Remove any standalone closing tags without opening tags
  rendered = rendered.replace(/\[\/(?:BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]/g, '')
  
  // Remove any empty tag pairs like [CENTER][/CENTER]
  rendered = rendered.replace(/\[(?:CENTER|RIGHT|JUSTIFY)\]\[\/\1\]/g, '')
  
  // Remove any standalone opening tags at the end (common with malformed tags)
  rendered = rendered.replace(/\[(?:CENTER|RIGHT|JUSTIFY)\](\s|\n)*$/gm, '')
  rendered = rendered.replace(/\[BOLD\](\s|\n)*$/gm, '')
  rendered = rendered.replace(/\[ITALIC\](\s|\n)*$/gm, '')
  
  // Now convert custom formatting tags to HTML
  // Handle complete paired tags first
  rendered = rendered.replace(/\[BOLD\](.*?)\[\/BOLD\]/gs, '<strong class="font-bold">$1</strong>')
  rendered = rendered.replace(/\[ITALIC\](.*?)\[\/ITALIC\]/gs, '<em class="italic">$1</em>')
  rendered = rendered.replace(/\[CENTER\](.*?)\[\/CENTER\]/gs, '<div class="mb-5 text-center">$1</div>')
  rendered = rendered.replace(/\[RIGHT\](.*?)\[\/RIGHT\]/gs, '<div class="mb-5 text-right">$1</div>')
  rendered = rendered.replace(/\[JUSTIFY\](.*?)\[\/JUSTIFY\]/gs, '<div class="mb-5 text-justify">$1</div>')
  
  // Then handle individual opening/closing tags
  rendered = rendered.replace(/\[BOLD\]/g, '<strong class="font-bold">')
  rendered = rendered.replace(/\[ITALIC\]/g, '<em class="italic">')
  rendered = rendered.replace(/\[CENTER\]/g, '<div class="mb-5 text-center">')
  rendered = rendered.replace(/\[RIGHT\]/g, '<div class="mb-5 text-right">')
  rendered = rendered.replace(/\[JUSTIFY\]/g, '<div class="mb-5 text-justify">')
  
  // Convert markdown-style headings with enhanced spacing and responsive sizing
  rendered = rendered.replace(/^# (.+)$/gm, '</p><h1 class="text-2xl sm:text-3xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4 text-foreground">$1</h1><p class="mb-5 sm:mb-6 text-foreground">')
  rendered = rendered.replace(/^## (.+)$/gm, '</p><h2 class="text-xl sm:text-2xl font-bold mt-5 sm:mt-7 mb-2 sm:mb-3 text-foreground">$1</h2><p class="mb-4 sm:mb-5 text-foreground">')
  rendered = rendered.replace(/^### (.+)$/gm, '</p><h3 class="text-lg sm:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 text-foreground">$1</h3><p class="mb-4 sm:mb-5 text-foreground">')
  rendered = rendered.replace(/^#### (.+)$/gm, '</p><h4 class="text-base sm:text-lg font-semibold mt-4 sm:mt-5 mb-2 text-foreground">$1</h4><p class="mb-3 sm:mb-4 text-foreground">')
  rendered = rendered.replace(/^##### (.+)$/gm, '</p><h5 class="text-sm sm:text-base font-semibold mt-3 sm:mt-4 mb-2 text-foreground">$1</h5><p class="mb-3 sm:mb-4 text-foreground">')
  rendered = rendered.replace(/^###### (.+)$/gm, '</p><h6 class="text-xs sm:text-sm font-semibold mt-3 sm:mt-4 mb-2 text-foreground">$1</h6><p class="mb-3 sm:mb-4 text-foreground">')
  
  // Split into lines for processing
  const lines = rendered.split('\n')
  const processedLines: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'
  let inParagraph = false
  let currentParagraph: string[] = []
  let emptyLineCount = 0
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      processedLines.push(`<p class="mb-4 leading-relaxed text-foreground">${currentParagraph.join(' ')}</p>`)
      currentParagraph = []
      inParagraph = false
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Track consecutive empty lines for paragraph breaks
    if (!trimmedLine) {
      emptyLineCount++
      if (emptyLineCount >= 2 && inParagraph) {
        flushParagraph()
        processedLines.push('<p class="mb-6 sm:mb-8"></p>') // Add extra spacing for paragraph breaks
      }
      continue
    }
    emptyLineCount = 0
    
    // Check for various list patterns (improved detection)
    // Only match ordered lists that START with a number (not ending with "; 1")
    const orderedMatch = trimmedLine.match(/^\s*(\d+)\.\s+(.+)$/);
    
    // Check for bullet lists with various bullet characters
    // Match: • (bullet), - (hyphen/dash), — (em dash), – (en dash), * (asterisk)
    const bulletMatch = trimmedLine.match(/^\s*([•\-–—\*·])\s+(.+)$/);
    
    // Check if line is already wrapped in a heading or div from previous processing
    const isHeading = /^<(h[1-6]|div)/.test(trimmedLine)
    const isBlockElement = /<\/?(p|div|h[1-6])/.test(trimmedLine)
    
    if (isHeading || isBlockElement) {
      flushParagraph()
      processedLines.push(line)
      inParagraph = false
    } else if (orderedMatch) {
      flushParagraph()
      if (!inList || listType !== 'ol') {
        if (inList) {
          processedLines.push(`</${listType}>`)
        }
        processedLines.push('<ol class="list-decimal ml-4 sm:ml-6 mb-5 mt-2 text-foreground space-y-2">')
        inList = true
        listType = 'ol'
      }
      const listContent = orderedMatch[2];
      processedLines.push(`  <li class="mb-2 leading-relaxed">${listContent}</li>`)
      inParagraph = false
    } else if (bulletMatch && bulletMatch.length >= 3 && bulletMatch[2]) {
      // Found a bullet list item
      flushParagraph()
      if (!inList || listType !== 'ul') {
        if (inList) {
          processedLines.push(`</${listType}>`)
        }
        processedLines.push('<ul class="list-disc ml-4 sm:ml-6 mb-5 mt-2 text-foreground space-y-2">')
        inList = true
        listType = 'ul'
      }
      const listContent = bulletMatch[2].trim();
      if (listContent) {
        processedLines.push(`  <li class="mb-2 leading-relaxed">${listContent}</li>`)
      }
      inParagraph = false
    } else {
      // Regular paragraph content
      if (inList) {
        processedLines.push(`</${listType}>`)
        inList = false
      }
      
      // Check if line contains inline HTML (from previous processing)
      if (/<(strong|em|div)/.test(line)) {
        flushParagraph()
        processedLines.push(line)
      } else {
        currentParagraph.push(line)
        inParagraph = true
      }
    }
  }
  
  // Flush any remaining content
  flushParagraph()
  
  if (inList) {
    processedLines.push(`</${listType}>`)
  }
  
  // Join and clean up
  rendered = processedLines.join('\n')
  
  // Clean up duplicate paragraph tags and empty paragraphs
  rendered = rendered
    .replace(/<p class="mb-4 text-foreground"><\/p>/g, '')
    .replace(/<p class="mb-4 text-foreground"><p class="mb-4 text-foreground">/g, '<p class="mb-4 text-foreground">')
    .replace(/<\/p><\/p>/g, '</p>')
    .replace(/(<[^>]*>)\s*<p class="mb-4 text-foreground">/g, '$1')
    .replace(/<\/p>\s*(<\/[^>]*>)/g, '$1')
  
  // Final cleanup: remove any remaining raw format tags that weren't converted
  rendered = rendered.replace(/\[(?:BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]/g, '')
  rendered = rendered.replace(/\[\/(?:BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]/g, '')
  
  // AGGRESSIVE SECOND PASS: Remove any remaining "1" artifacts in HTML
  rendered = rendered.replace(/;\s*1\./g, '') // ";" followed by "1." anywhere
  rendered = rendered.replace(/&nbsp;\s*1\./g, '&nbsp;') // "&nbsp; 1."
  rendered = rendered.replace(/>\s*1\.\s*</g, '><') // "1." between tags
  rendered = rendered.replace(/<\/(li|p|div)>\s*1\.\s*</g, '</$1><') // "1." after closing tags
  rendered = rendered.replace(/>(\s)*1\.\s*</g, '><') // "1." with whitespace between tags
  
  // Clean up any multiple spaces that might have been created
  rendered = rendered.replace(/\s{2,}/g, ' ')
  
  // Remove empty paragraphs that might have been created
  rendered = rendered.replace(/<p class="mb-4.*?text-foreground">\s*<\/p>/g, '')
  rendered = rendered.replace(/<p class="mb-[456].*?text-foreground">\s*<\/p>/g, '')
  rendered = rendered.replace(/<p class="[^"]*">\s*1\.\s*<\/p>/g, '') // Paragraphs containing only "1."
  rendered = rendered.replace(/<p class="[^"]*">\s*;\s*1\.\s*<\/p>/g, '') // Paragraphs containing only "; 1."
  
  return rendered
}


