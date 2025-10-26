export function renderFormattedText(content: string): string {
  if (!content) return ''
  
  let rendered = content
  
  // Convert [BOLD] tags to <strong> (multiline and single line)
  rendered = rendered.replace(/\[BOLD\]/gs, '<strong class="font-bold">')
  rendered = rendered.replace(/\[\/BOLD\]/gs, '</strong>')
  
  // Convert [ITALIC] tags to <em> (multiline and single line)
  rendered = rendered.replace(/\[ITALIC\]/gs, '<em class="italic">')
  rendered = rendered.replace(/\[\/ITALIC\]/gs, '</em>')
  
  // Convert [CENTER] tags
  rendered = rendered.replace(/\[CENTER\]/gs, '<div class="text-center">')
  rendered = rendered.replace(/\[\/CENTER\]/gs, '</div>')
  
  // Convert [RIGHT] tags
  rendered = rendered.replace(/\[RIGHT\]/gs, '<div class="text-right">')
  rendered = rendered.replace(/\[\/RIGHT\]/gs, '</div>')
  
  // Convert [JUSTIFY] tags
  rendered = rendered.replace(/\[JUSTIFY\]/gs, '<div class="text-justify">')
  rendered = rendered.replace(/\[\/JUSTIFY\]/gs, '</div>')
  
  // Convert markdown-style headings to HTML (lines starting with #)
  rendered = rendered.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-4 mt-6 text-foreground">$1</h1>')
  rendered = rendered.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mb-3 mt-5 text-foreground">$1</h2>')
  rendered = rendered.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mb-2 mt-4 text-foreground">$1</h3>')
  rendered = rendered.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold mb-2 mt-3 text-foreground">$1</h4>')
  rendered = rendered.replace(/^##### (.+)$/gm, '<h5 class="text-base font-semibold mb-1 mt-2 text-foreground">$1</h5>')
  rendered = rendered.replace(/^###### (.+)$/gm, '<h6 class="text-sm font-semibold mb-1 mt-2 text-foreground">$1</h6>')
  
  // Convert line breaks to paragraphs  
  const lines = rendered.split('\n')
  const processedLines: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'
  let paragraphContent: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Check if this line is a list item
    const orderedMatch = trimmedLine.match(/^(\d+)\. (.+)$/)
    const bulletMatch = trimmedLine.match(/^[•\-\*] (.+)$/)
    
    if (orderedMatch) {
      // Flush any pending paragraph
      if (paragraphContent.length > 0) {
        processedLines.push(`<p class="mb-3 text-foreground">${paragraphContent.join(' ')}</p>`)
        paragraphContent = []
      }
      if (!inList) {
        processedLines.push('<ol class="list-decimal ml-6 mb-4 text-foreground">')
        inList = true
        listType = 'ol'
      }
      processedLines.push(`  <li class="mb-1">${orderedMatch[2]}</li>`)
    } else if (bulletMatch) {
      // Flush any pending paragraph
      if (paragraphContent.length > 0) {
        processedLines.push(`<p class="mb-3 text-foreground">${paragraphContent.join(' ')}</p>`)
        paragraphContent = []
      }
      if (!inList) {
        processedLines.push('<ul class="list-disc ml-6 mb-4 text-foreground">')
        inList = true
        listType = 'ul'
      }
      processedLines.push(`  <li class="mb-1">${bulletMatch[1]}</li>`)
    } else {
      if (inList) {
        processedLines.push(`</${listType}>`)
        inList = false
      }
      if (trimmedLine) {
        paragraphContent.push(line)
      } else if (paragraphContent.length > 0) {
        processedLines.push(`<p class="mb-3 text-foreground">${paragraphContent.join('<br />')}</p>`)
        paragraphContent = []
      }
    }
  }
  
  // Flush any remaining paragraph or list
  if (paragraphContent.length > 0) {
    processedLines.push(`<p class="mb-3 text-foreground">${paragraphContent.join('<br />')}</p>`)
  }
  if (inList) {
    processedLines.push(`</${listType}>`)
  }
  
  rendered = processedLines.join('\n')
  
  return rendered
}


