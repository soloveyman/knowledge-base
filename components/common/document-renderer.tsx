'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import Image from 'next/image'
import { getImageSizeCategory, getOptimizedImageProps, isLikelyQRCode, isLikelyIcon } from '@/lib/image-utils'

interface DocumentRendererProps {
  content: string
  tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
  className?: string
}

export function DocumentRenderer({ content, tables, className = '' }: DocumentRendererProps) {
  // Если есть таблицы но нет контента, не показываем пустой контент
  // Check if content has actual text (not just whitespace or placeholder text)
  // Note: We check for actual text AFTER extracting text from formatting tags, because
  // content might only have text inside [BOLD] or [ITALIC] tags
  // Check if content has actual content (text or images)
  const hasImages = /!\[.*?\]\(.*?\)/.test(content)
  const hasActualContent = content && 
    content.trim().length > 0 && 
    !content.includes('Document content will be displayed here...') &&
    !content.includes('Document contains tables below.') &&
    // Check if content has actual text characters (not just whitespace) OR images
    (hasImages || (() => {
      // First extract text from inside formatting tags, then remove tags
      let textCheck = content
        .replace(/\[BOLD\]([\s\S]*?)\[\/BOLD\]/g, '$1') // Extract text from [BOLD]...[/BOLD]
        .replace(/\[ITALIC\]([\s\S]*?)\[\/ITALIC\]/g, '$1') // Extract text from [ITALIC]...[/ITALIC]
        .replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/g, '$1') // Extract text from [CENTER]...[/CENTER]
        .replace(/\[RIGHT\]([\s\S]*?)\[\/RIGHT\]/g, '$1') // Extract text from [RIGHT]...[/RIGHT]
        .replace(/\[JUSTIFY\]([\s\S]*?)\[\/JUSTIFY\]/g, '$1') // Extract text from [JUSTIFY]...[/JUSTIFY]
        .replace(/!\[.*?\]\(.*?\)/g, '') // Remove image markdown for text check
        .replace(/#+\s+/g, '') // Remove markdown heading markers but keep text
        .replace(/\s+/g, '') // Remove all whitespace
      return textCheck.length > 0
    })())
  
  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none ${className}`}>
      <div className="document-content space-y-6">
        {hasActualContent && <DocumentContent content={content} />}
        {tables && tables.length > 0 && (
          <div className={hasActualContent ? "mt-10 space-y-10" : "space-y-10"}>
            {tables.map((table, idx) => (
              <TableRenderer key={idx} table={table} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to extract clean display text from alt or src
function getImageDisplayText(alt: string, src: string): string {
  // If alt text exists and is reasonable, use it
  if (alt && alt.trim().length > 0 && alt.length < 200) {
    // Extract filename from alt if it looks like a path
    const filenameMatch = alt.match(/([^/\\]+\.(png|jpg|jpeg|gif|webp|svg))$/i)
    if (filenameMatch) {
      return filenameMatch[1]
    }
    return alt.trim()
  }
  
  // Try to extract filename from src path
  if (src && !src.startsWith('data:')) {
    const pathMatch = src.match(/([^/\\]+\.(png|jpg|jpeg|gif|webp|svg))$/i)
    if (pathMatch) {
      return pathMatch[1]
    }
    // If it's a relative path, extract the last part
    if (src.includes('/') || src.includes('\\')) {
      const parts = src.split(/[/\\]/)
      const lastPart = parts[parts.length - 1]
      if (lastPart && lastPart.length < 100) {
        return lastPart
      }
    }
  }
  
  // For data URLs or unknown sources, return generic text
  return 'Image'
}

// Helper function to filter out undefined, null, and strange text
function filterStrangeText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  // Remove common strange text patterns
  const strangePatterns = [
    /undefined/gi,
    /null/gi,
    /\[object\s+Object\]/gi,
    /\[object\s+Array\]/gi,
    /NaN/gi,
    /Infinity/gi,
    /true/gi, // Only if standalone (not part of words)
    /false/gi, // Only if standalone
  ]
  
  let filtered = text
  
  // Remove standalone "undefined", "null", etc. (not part of words)
  filtered = filtered.replace(/\bundefined\b/gi, '')
  filtered = filtered.replace(/\bnull\b/gi, '')
  filtered = filtered.replace(/\bNaN\b/gi, '')
  filtered = filtered.replace(/\bInfinity\b/gi, '')
  filtered = filtered.replace(/\[object\s+Object\]/gi, '')
  filtered = filtered.replace(/\[object\s+Array\]/gi, '')
  
  // Remove empty formatting tags that might contain undefined
  filtered = filtered.replace(/\[BOLD\]\s*undefined\s*\[\/BOLD\]/gi, '')
  filtered = filtered.replace(/\[ITALIC\]\s*undefined\s*\[\/ITALIC\]/gi, '')
  filtered = filtered.replace(/\[CENTER\]\s*undefined\s*\[\/CENTER\]/gi, '')
  filtered = filtered.replace(/\[RIGHT\]\s*undefined\s*\[\/RIGHT\]/gi, '')
  filtered = filtered.replace(/\[JUSTIFY\]\s*undefined\s*\[\/JUSTIFY\]/gi, '')
  
  // Remove headings that only contain undefined/null
  filtered = filtered.replace(/^#{1,6}\s+(undefined|null)\s*$/gim, '')
  
  // Clean up multiple consecutive newlines that might result from removals
  filtered = filtered.replace(/\n{4,}/g, '\n\n\n')
  
  return filtered
}

function DocumentContent({ content }: { content: string }) {
  // Filter out undefined and strange text before processing
  const cleanedContent = filterStrangeText(content)
  
  // Преобразуем форматирование в markdown
  const markdown = convertToMarkdown(cleanedContent)
  
  // Convert markdown images to HTML img tags (ReactMarkdown with rehypeRaw can handle HTML)
  // This avoids parsing issues with very long data URLs
  // Handle both data URLs and external URLs (S3/CDN)
  let processedMarkdown = markdown
  const imageMatches: Array<{ match: string; alt: string; src: string }> = []
  
  // More robust pattern for data URLs - handle very long base64 strings
  // First, extract data URLs with multiline support
  const dataUrlPattern = /!\[([^\]]*)\]\((data:[^;]+;base64,[A-Za-z0-9+/=\s\n]+)\)/g
  let dataUrlMatch
  const processedPositions = new Set<number>()
  
  while ((dataUrlMatch = dataUrlPattern.exec(markdown)) !== null) {
    const fullMatch = dataUrlMatch[0]
    // Validate that match ends with closing parenthesis
    if (fullMatch.endsWith(')')) {
      const alt = dataUrlMatch[1] || ''
      // Extract src - find the data: URL part
      const srcMatch = fullMatch.match(/data:[^)]+/)
      const src = srcMatch ? srcMatch[0] : ''
      
      if (src && src.length > 0) {
        imageMatches.push({
          match: fullMatch,
          alt: alt,
          src: src
        })
        processedPositions.add(dataUrlMatch.index)
      }
    }
  }
  
  // Then, extract regular URLs (non-data URLs) - must come after data URL matching
  const regularImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  let regularMatch
  while ((regularMatch = regularImagePattern.exec(markdown)) !== null) {
    // Skip if already processed as data URL
    if (!processedPositions.has(regularMatch.index)) {
      const src = regularMatch[2] || ''
      const alt = regularMatch[1] || ''
      
      // Skip if it's a data URL (should have been caught above)
      if (!src.startsWith('data:')) {
        imageMatches.push({
          match: regularMatch[0],
          alt: alt,
          src: src
        })
      }
    }
  }
  
  // Replace markdown images with HTML img tags (in reverse order to preserve positions)
  for (let i = imageMatches.length - 1; i >= 0; i--) {
    const { match, alt, src } = imageMatches[i]
    // Escape alt text for HTML (but not src - URLs must remain unescaped)
    const escapedAlt = alt.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    // Escape src for HTML if it's an external URL (data URLs don't need escaping)
    const escapedSrc = src.startsWith('data:') ? src : src.replace(/"/g, '&quot;')
    // Use HTML img tag instead of markdown syntax
    // Note: data URLs must remain unescaped, but external URLs should be escaped
    const htmlImg = `<img src="${escapedSrc}" alt="${escapedAlt}" class="rounded-lg border border-border w-full h-auto max-w-4xl my-6 mx-auto block" style="max-width: 100%; height: auto;" loading="lazy" />`
    processedMarkdown = processedMarkdown.replace(match, htmlImg)
  }
  
  // Custom rehype plugin to preserve image src attributes (especially data URLs)
  const preserveImageSrc = () => {
    return (tree: any) => {
      const visit = (node: any) => {
        if (node.type === 'element' && node.tagName === 'img' && node.properties?.src) {
          // Store the src in a data attribute as backup
          const src = node.properties.src
          if (typeof src === 'string' && src.startsWith('data:')) {
            // Ensure src is preserved
            node.properties['data-original-src'] = src
          }
        }
        if (node.children) {
          node.children.forEach(visit)
        }
      }
      visit(tree)
    }
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        preserveImageSrc,
        [
          rehypeSanitize,
          {
            tagNames: ['img', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'hr'],
            attributes: {
              img: ['src', 'alt', 'width', 'height', 'className', 'data-original-src', 'class', 'style', 'loading'],
              div: ['align', 'className'],
              a: ['href', 'target', 'rel', 'className'],
            },
            protocols: {
              src: ['http', 'https', 'data'],
            },
          },
        ],
      ]}
      components={{
        h1: ({ children }) => {
          // Filter out undefined/null children
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          
          if (filteredChildren.length === 0) return null
          
          // Главный заголовок - самый крупный и выразительный
          return (
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mt-12 mb-8 text-foreground border-b-2 border-border pb-4 leading-tight tracking-tight">
              {filteredChildren}
            </h1>
          )
        },
        h2: ({ children }) => {
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          if (filteredChildren.length === 0) return null
          return (
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mt-10 mb-6 text-foreground border-b border-border pb-3 leading-tight tracking-tight">
              {filteredChildren}
            </h2>
          )
        },
        h3: ({ children }) => {
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          if (filteredChildren.length === 0) return null
          return (
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 mb-5 text-foreground leading-tight tracking-tight">
              {filteredChildren}
            </h3>
          )
        },
        h4: ({ children }) => {
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          if (filteredChildren.length === 0) return null
          return (
            <h4 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mt-7 mb-4 text-foreground leading-tight tracking-normal">
              {filteredChildren}
            </h4>
          )
        },
        h5: ({ children }) => {
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          if (filteredChildren.length === 0) return null
          return (
            <h5 className="text-xl sm:text-2xl lg:text-3xl font-semibold mt-6 mb-3 text-foreground/90 leading-tight tracking-normal">
              {filteredChildren}
            </h5>
          )
        },
        h6: ({ children }) => {
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          if (filteredChildren.length === 0) return null
          return (
            <h6 className="text-lg sm:text-xl lg:text-2xl font-semibold mt-5 mb-3 text-foreground/80 leading-tight tracking-normal">
              {filteredChildren}
            </h6>
          )
        },
        p: ({ children }) => {
          // Filter out undefined/null children
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          
          // Don't render paragraph if all children were filtered out
          if (filteredChildren.length === 0) return null
          
          return (
            <p className="mb-5 text-base sm:text-lg leading-relaxed text-foreground">
              {filteredChildren}
            </p>
          )
        },
        ul: ({ children }) => {
          // Проверяем наличие эмодзи в элементах списка через строковое представление
          const childrenStr = String(children)
          const hasEmojis = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✓✅🔴🍽️🍸👨‍🍳🏢🧼🚪📦🚚🔧📝💭]/u.test(childrenStr)
          
          return (
            <ul className={`mb-6 space-y-3 text-base sm:text-lg text-foreground ${hasEmojis ? 'list-none ml-0 pl-0' : 'list-disc ml-4 sm:ml-6'}`}>
              {children}
            </ul>
          )
        },
        ol: ({ children }) => (
          <ol className="mb-6 ml-4 sm:ml-6 list-decimal space-y-3 text-base sm:text-lg text-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => {
          // Filter out undefined/null children
          const filteredChildren = React.Children.toArray(children).filter(child => {
            if (child === null || child === undefined) return false
            if (typeof child === 'string') {
              const trimmed = child.trim().toLowerCase()
              return trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== 'nan' && 
                     trimmed !== 'infinity' && !trimmed.includes('[object')
            }
            return true
          })
          
          if (filteredChildren.length === 0) return null
          
          // Проверяем, начинается ли элемент с эмодзи
          const childrenStr = String(filteredChildren)
          const emojiMatch = childrenStr.trim().match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✓✅🔴🍽️🍸👨‍🍳🏢🧼🚪📦🚚🔧📝💭])\s*(.+)$/u)
          
          // Для элементов с эмодзи: используем flex для правильного выравнивания на мобильных
          if (emojiMatch) {
            const [, emoji, text] = emojiMatch
            return (
              <li className="flex items-start gap-2 leading-relaxed mb-1 pl-0 ml-0">
                <span className="flex-shrink-0 mt-0.5 text-base">{emoji}</span>
                <span className="flex-1 min-w-0 break-words">{text}</span>
              </li>
            )
          }
          
          // Обычные элементы списка
          return (
            <li className="leading-relaxed mb-1 pl-0 break-words">{filteredChildren}</li>
          )
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-border pl-4 italic my-4 text-muted-foreground">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isInline = !className
          return isInline ? (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
              {children}
            </code>
          ) : (
            <code className={className}>{children}</code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 border border-border">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-6 rounded-lg border border-border -mx-4 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
            <table className="min-w-full divide-y divide-border bg-background text-xs border-collapse [&_th]:text-left [&_td]:text-left [&_th]:align-top [&_td]:align-top">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 sm:px-4 py-2 text-left font-medium uppercase tracking-wider border-b border-x-0 border-border bg-muted/50 text-xs text-foreground whitespace-normal">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs text-foreground border-x-0 align-top whitespace-normal">
            {children}
          </td>
        ),
        img: ({ src, alt, width, height, className, node, ...props }) => {
          // HTML img tags from rehypeRaw may have src in node.properties
          let actualSrc = src
          if (!actualSrc && node?.properties) {
            const nodeProps = node.properties as Record<string, unknown>
            // Try to get src - it might be in different formats
            actualSrc = nodeProps.src as string | undefined
            if (!actualSrc) {
              actualSrc = nodeProps.SRC as string | undefined
            }
            // Sometimes properties are arrays (from rehypeSanitize)
            if (!actualSrc && Array.isArray(nodeProps.src)) {
              actualSrc = nodeProps.src[0] as string | undefined
            }
            // Try backup data attribute
            if (!actualSrc) {
              actualSrc = nodeProps['data-original-src'] as string | undefined
            }
          }
          
          if (!actualSrc) {
            return null
          }
          
          // Convert src to string if it's a Blob
          let srcString = typeof actualSrc === 'string' ? actualSrc : ''
          if (!srcString) {
            return null
          }
          
          // Validate and filter out invalid image sources
          // 1. Empty data URLs (data:image/png;base64,)
          if (srcString.startsWith('data:') && (srcString.endsWith(',') || srcString.split(',').length === 1 || srcString.split(',')[1]?.trim().length === 0)) {
            // Show alt text instead of broken image - compact version
            const displayText = getImageDisplayText(alt || '', srcString)
            const shortText = displayText.length > 50 ? displayText.substring(0, 47) + '...' : displayText
            return (
              <div className="my-2 px-2 py-1 inline-block border border-dashed border-border rounded text-xs text-muted-foreground bg-muted/30">
                {shortText || 'Изображение недоступно'}
              </div>
            )
          }
          
          // 2. Relative paths that aren't valid (like word/media/image1.png)
          if (!srcString.startsWith('data:') && !srcString.startsWith('http://') && !srcString.startsWith('https://') && !srcString.startsWith('/')) {
            // Check if it looks like a file path (contains slashes but not a valid URL)
            if (srcString.includes('/') || srcString.includes('\\')) {
              // Show alt text instead of broken image - compact version
              const displayText = getImageDisplayText(alt || '', srcString)
              const shortText = displayText.length > 50 ? displayText.substring(0, 47) + '...' : displayText
              return (
                <div className="my-2 px-2 py-1 inline-block border border-dashed border-border rounded text-xs text-muted-foreground bg-muted/30">
                  {shortText || 'Изображение недоступно'}
                </div>
              )
            }
          }
          
          // Fix base64 images that are missing the data: prefix
          if (srcString.startsWith('base64,')) {
            srcString = `data:image/png;${srcString}`
          } else if (!srcString.includes('data:') && !srcString.startsWith('http') && srcString.length > 100 && /^[A-Za-z0-9+/=]+$/.test(srcString.substring(0, 50))) {
            // If it looks like base64 without prefix, add it
            srcString = `data:image/png;base64,${srcString}`
          }
          
          // Check if it's a data URL or external URL
          const isDataUrl = srcString.startsWith('data:')
          const isExternal = srcString.startsWith('http://') || srcString.startsWith('https://')
          
          // Final validation: if it's not a data URL or external URL, show alt text
          if (!isDataUrl && !isExternal) {
            const displayText = getImageDisplayText(alt || '', srcString)
            const shortText = displayText.length > 50 ? displayText.substring(0, 47) + '...' : displayText
            return (
              <div className="my-2 px-2 py-1 inline-block border border-dashed border-border rounded text-xs text-muted-foreground bg-muted/30">
                {shortText || 'Изображение недоступно'}
              </div>
            )
          }
          
          // Determine image dimensions
          let imgWidth = typeof width === 'number' ? width : typeof width === 'string' ? parseInt(width) : undefined
          let imgHeight = typeof height === 'number' ? height : typeof height === 'string' ? parseInt(height) : undefined
          
          // If no dimensions provided, try to detect from image or use aspect ratio placeholder
          // For data URLs, we'll load the image to get dimensions
          // For external URLs, we'll use a placeholder aspect ratio
          if (!imgWidth || isNaN(imgWidth) || imgWidth <= 0) {
            // Use a reasonable default that won't cause layout shift
            // We'll let the browser determine the actual size based on max-width constraints
            imgWidth = undefined
          }
          if (!imgHeight || isNaN(imgHeight) || imgHeight <= 0) {
            imgHeight = undefined
          }
          
          // Determine if image is small based on dimensions (if available)
          const hasDimensions = imgWidth !== undefined && imgHeight !== undefined && imgWidth > 0 && imgHeight > 0
          const isSmallImage = hasDimensions && (imgWidth! <= 256 || imgHeight! <= 256)
          const isQRCode = hasDimensions && isLikelyQRCode(imgWidth!, imgHeight!)
          const isIcon = hasDimensions && isLikelyIcon(imgWidth!, imgHeight!)
          
          // Special handling for small images (icons, QR codes, thumbnails)
          const containerClass = isSmallImage || isQRCode || isIcon
            ? "my-3 relative inline-flex justify-center"
            : "my-6 relative w-full flex justify-center"
          
          const imageClass = className || (isSmallImage || isQRCode || isIcon
            ? "rounded border border-border max-w-full h-auto"
            : "rounded-lg border border-border max-w-full h-auto")
          
          // Always use regular img tag for data URLs (Next.js Image doesn't support them)
          // For external URLs (S3/CDN), we can use either regular img or Next.js Image
          // Using regular img for now to avoid Next.js Image domain configuration issues
          if (isDataUrl || isExternal) {
            return (
              <div className={containerClass}>
                <div className={isSmallImage || isQRCode || isIcon ? "relative" : "relative w-full mx-auto"} style={!isSmallImage && !isQRCode && !isIcon ? { maxWidth: '1200px', maxHeight: '500px' } : undefined}>
                  <ImageWithPlaceholder
                    src={srcString}
                    alt={alt || ''}
                    width={imgWidth}
                    height={imgHeight}
                    className={imageClass}
                    loading={isSmallImage || isQRCode ? "eager" : "lazy"}
                    maxWidth={1200}
                    maxHeight={500}
                  />
                </div>
              </div>
            )
          }
          
          // Fallback for unknown URL types (shouldn't happen, but just in case)
          // For external URLs, use Next.js Image component (if domain is configured)
          // Use default dimensions if not provided
          const fallbackWidth = imgWidth || 1200
          const fallbackHeight = imgHeight || 800
          const category = getImageSizeCategory(fallbackWidth, fallbackHeight)
          const optimizedProps = getOptimizedImageProps(category, {
            width: fallbackWidth,
            height: fallbackHeight,
            src: srcString,
            alt: alt || '',
            isDataUrl: false,
            isExternal: true,
            priority: false,
          })
          
          return (
            <div className={containerClass}>
              <div className={isSmallImage || isQRCode || isIcon ? "relative" : "relative w-full mx-auto"} style={!isSmallImage && !isQRCode && !isIcon ? { maxWidth: '1200px', maxHeight: '500px' } : undefined}>
                <Image
                  {...optimizedProps}
                  className={imageClass}
                  {...(isSmallImage && {
                    quality: 95,
                    loading: 'eager' as const,
                  })}
                  {...(isQRCode && {
                    quality: 100,
                    loading: 'eager' as const,
                    priority: true,
                  })}
                />
              </div>
            </div>
          )
        },
        a: ({ href, children }) => (
          <a 
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        ),
        hr: () => (
          <hr className="my-8 border-t border-border" />
        ),
      }}
    >
      {processedMarkdown}
    </ReactMarkdown>
  )
}

function TableRenderer({ table }: { 
  table: { title: string; headers: string[]; rows: string[][] }
}) {
  // Вспомогательная функция для проверки, пустая ли ячейка
  const isCellEmpty = (cell: string | null | undefined): boolean => {
    if (cell === null || cell === undefined) return true
    if (typeof cell !== 'string') return true
    
    // Check for strange text patterns
    const cellLower = cell.toLowerCase().trim()
    if (cellLower === 'undefined' || cellLower === 'null' || cellLower === 'nan' || 
        cellLower === 'infinity' || cellLower.includes('[object') || cellLower === 'true' || cellLower === 'false') {
      return true
    }
    
    // Удаляем все виды пробелов и невидимых символов
    const normalized = cell
      .replace(/\u00A0/g, ' ') // неразрывный пробел
      .replace(/&nbsp;/g, ' ') // HTML entity
      .replace(/\u200B/g, '') // zero-width space
      .replace(/\uFEFF/g, '') // zero-width no-break space
      .replace(/\s+/g, ' ') // заменяем все пробельные символы на обычный пробел
      .trim()
    return normalized.length === 0
  }
  
  // Helper function to clean cell content
  const cleanCellContent = (cell: string | null | undefined): string => {
    if (cell === null || cell === undefined) return ''
    if (typeof cell !== 'string') return String(cell)
    
    // Filter out strange text
    let cleaned = cell
    cleaned = cleaned.replace(/\bundefined\b/gi, '')
    cleaned = cleaned.replace(/\bnull\b/gi, '')
    cleaned = cleaned.replace(/\bNaN\b/gi, '')
    cleaned = cleaned.replace(/\bInfinity\b/gi, '')
    cleaned = cleaned.replace(/\[object\s+Object\]/gi, '')
    cleaned = cleaned.replace(/\[object\s+Array\]/gi, '')
    
    return cleaned.trim()
  }

  // Вспомогательная функция для проверки, пустой ли заголовок
  const isHeaderEmpty = (header: string | null | undefined): boolean => {
    return isCellEmpty(header)
  }

  // Функция для проверки, является ли колонка пустой
  // Колонка считается пустой, если все ячейки данных в ней пустые
  // Заголовок не учитывается - колонка удаляется даже если заголовок заполнен, но все ячейки пустые
  const isColumnEmpty = (columnIndex: number): boolean => {
    // Если нет строк данных, проверяем только заголовок
    if (table.rows.length === 0) {
      const header = table.headers?.[columnIndex]
      return isHeaderEmpty(header)
    }
    
    // Проверяем ВСЕ строки данных в этой колонке
    // Колонка считается пустой, если ВСЕ ячейки данных пустые (игнорируем заголовок)
    let hasAnyNonEmptyCell = false
    
    for (const row of table.rows) {
      // Если строка короче, чем индекс колонки - ячейка пустая
      if (columnIndex >= row.length) continue
      
      const cell = row[columnIndex]
      // Если ячейка не пустая - колонка не пустая
      if (!isCellEmpty(cell)) {
        hasAnyNonEmptyCell = true
        break
      }
    }
    
    // Колонка пустая, если не найдено ни одной непустой ячейки данных
    return !hasAnyNonEmptyCell
  }

  // Функция для проверки, является ли строка пустой
  const isRowEmpty = (row: string[]): boolean => {
    return row.every(cell => isCellEmpty(cell))
  }

  // Определяем максимальное количество колонок
  const maxColumns = Math.max(
    table.headers?.length || 0,
    ...(table.rows.map(row => row.length) || [0])
  )

  // Находим индексы непустых колонок
  const nonEmptyColumnIndices = Array.from({ length: maxColumns }, (_, i) => i)
    .filter(columnIndex => !isColumnEmpty(columnIndex))

  // Фильтруем строки - удаляем пустые
  const filteredRows = table.rows.filter(row => !isRowEmpty(row))

  // Фильтруем заголовки - оставляем только для непустых колонок
  const filteredHeaders = table.headers 
    ? nonEmptyColumnIndices.map(colIdx => cleanCellContent(table.headers[colIdx]))
    : []

  // Фильтруем строки - оставляем только ячейки из непустых колонок
  const filteredRowsData = filteredRows.map(row =>
    nonEmptyColumnIndices.map(colIdx => {
      const cell = row[colIdx]
      return cleanCellContent(cell)
    })
  )

  // Проверяем, есть ли хотя бы один непустой заголовок после фильтрации
  const hasHeaders = filteredHeaders.length > 0 && filteredHeaders.some(h => !isHeaderEmpty(h))
  const tableEmoji = getEmojiForContext(table.title || 'таблица', 'heading') || '📊'
  
  return (
    <div className="space-y-4">
      {table.title && (
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground flex items-center gap-2 mb-4 leading-tight">
          <span className="text-2xl sm:text-3xl">{tableEmoji}</span>
          <span>{table.title}</span>
        </h3>
      )}
      {!table.title && (
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground flex items-center gap-2 mb-4 leading-tight">
          <span className="text-2xl sm:text-3xl">{tableEmoji}</span>
          <span>Таблица</span>
        </h3>
      )}
      <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
        <table className="w-full divide-y divide-border bg-background border-collapse [&_th]:text-left [&_td]:text-left [&_th]:align-top [&_td]:align-top">
          {hasHeaders && (
            <thead className="bg-muted/50">
              <tr>
                {filteredHeaders.map((header, idx) => {
                  const isEmpty = isHeaderEmpty(header)
                  return (
                    <th
                      key={idx}
                      className={`px-2 sm:px-4 py-2 text-left font-medium uppercase tracking-wider border-b border-x-0 border-border bg-muted/50 text-xs whitespace-normal ${
                        isEmpty 
                          ? 'text-transparent' 
                          : 'text-foreground'
                      }`}
                    >
                      {header || '\u00A0'}
                    </th>
                  )
                })}
              </tr>
            </thead>
          )}
          <tbody className="bg-background divide-y divide-border">
            {filteredRowsData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-muted/30 transition-colors"
              >
                {row.map((cell, cellIdx) => {
                  const isEmpty = isCellEmpty(cell)
                  return (
                    <td
                      key={cellIdx}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs text-foreground border-x-0 align-top whitespace-normal"
                    >
                      {isEmpty ? '\u00A0' : cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Определяет эмодзи на основе контекста текста
function getEmojiForContext(text: string, context?: 'heading' | 'list' | 'paragraph'): string {
  if (!text) return ''
  
  // Убираем лишние символы для анализа (буллеты, номера, пробелы)
  const cleanText = text.trim().replace(/^[•\-–—\*·\d+\.\s]+/, '').trim()
  if (!cleanText) return ''
  
  const lowerText = cleanText.toLowerCase()
  
  // Заголовки - определяем тип секции с более точными правилами
  if (context === 'heading') {
    // Структура и организация (более специфичные паттерны)
    if (/\b(структура|structure|организация|organization)\b/i.test(cleanText)) return '🏗️'
    if (/\b(план|plan|график|schedule|расписание)\b/i.test(cleanText)) return '📅'
    
    // Задачи и задания
    if (/\b(задача|задание|task|assignment|todo|делать|действие)\b/i.test(cleanText)) return '📋'
    
    // Инструкции и руководства
    if (/\b(инструкция|instruction|руководство|guide|manual|how to|как)\b/i.test(cleanText)) return '📖'
    
    // Важные заметки и предупреждения
    if (/\b(важно|important|внимание|attention|warning|предупреждение|alert)\b/i.test(cleanText)) return '⚠️'
    
    // Цели и задачи
    if (/\b(цель|goal|цели|objectives|target|миссия|mission)\b/i.test(cleanText)) return '🎯'
    
    // Результаты и итоги
    if (/\b(результат|result|outcome|итог|conclusion|вывод)\b/i.test(cleanText)) return '✅'
    
    // Введение и начало
    if (/\b(введение|introduction|вводная|intro|начало|start)\b/i.test(cleanText)) return '📌'
    
    // Заключение и финал
    if (/\b(заключение|conclusion|вывод|summary|резюме|итог|final)\b/i.test(cleanText)) return '📝'
    
    // Списки и перечни
    if (/\b(список|list|перечень|catalog|каталог)\b/i.test(cleanText)) return '📄'
    
    // Таблицы и данные
    if (/\b(таблица|table|data|данные|график)\b/i.test(cleanText)) return '📊'
    
    // Вопросы и FAQ
    if (/\b(вопрос|question|questions|faq|ответ|answer)\b/i.test(cleanText)) return '❓'
    
    // Информация
    if (/\b(информация|information|info|сведения|data)\b/i.test(cleanText)) return 'ℹ️'
    
    // Советы и рекомендации
    if (/\b(совет|tip|hint|подсказка|рекомендация|recommendation|suggestion)\b/i.test(cleanText)) return '💡'
    
    // Примеры
    if (/\b(пример|example|примеры|examples|образец|sample)\b/i.test(cleanText)) return '💬'
    
    // Персонал и команда
    if (/\b(сотрудник|employee|staff|персонал|команда|team|работник|personnel)\b/i.test(cleanText)) return '👥'
    
    // Контроль и проверка
    if (/\b(контроль|control|отметка|check|проверка|verification|audit)\b/i.test(cleanText)) return '✓'
    
    // Документы и файлы
    if (/\b(документ|document|файл|file|record)\b/i.test(cleanText)) return '📄'
    
    // Ресторанные зоны (специфичные для данного проекта)
    if (/\b(зал|hall|ресторан|restaurant)\b/i.test(cleanText)) return '🍽️'
    if (/\b(бар|bar)\b/i.test(cleanText)) return '🍸'
    if (/\b(кухня|kitchen)\b/i.test(cleanText)) return '👨‍🍳'
    if (/\b(офис|office)\b/i.test(cleanText)) return '🏢'
    if (/\b(мойка|dishwashing|посудомойка)\b/i.test(cleanText)) return '🧼'
    if (/\b(бэк|back|back-of-house|тыл)\b/i.test(cleanText)) return '🚪'
    if (/\b(склад|warehouse|storage)\b/i.test(cleanText)) return '📦'
    if (/\b(доставка|delivery)\b/i.test(cleanText)) return '🚚'
    if (/\b(техник|technician|техники)\b/i.test(cleanText)) return '🔧'
    
    // Общие заголовки
    return '📑'
  }
  
  // Списки - определяем тип пункта с более точными правилами
  if (context === 'list') {
    // Задачи и действия (более специфичные)
    if (/\b(сделать|выполнить|do|complete|готово|done|выполнено|выполнить|сделано)\b/i.test(lowerText)) return '✅'
    
    // Важные и обязательные пункты
    if (/\b(важно|important|обязательно|required|критично|critical)\b/i.test(lowerText)) return '🔴'
    
    // Ресторанные зоны
    if (/\b(зал|hall)\b/i.test(lowerText)) return '🍽️'
    if (/\b(бар|bar)\b/i.test(lowerText)) return '🍸'
    if (/\b(кухня|kitchen)\b/i.test(lowerText)) return '👨‍🍳'
    if (/\b(офис|office)\b/i.test(lowerText)) return '🏢'
    if (/\b(мойка|dishwashing|посудомойка)\b/i.test(lowerText)) return '🧼'
    if (/\b(бэк|back|back-of-house|тыл)\b/i.test(lowerText)) return '🚪'
    if (/\b(склад|warehouse|storage)\b/i.test(lowerText)) return '📦'
    if (/\b(доставка|delivery)\b/i.test(lowerText)) return '🚚'
    if (/\b(техник|technician|техники)\b/i.test(lowerText)) return '🔧'
    
    // Описательные пункты (не задачи)
    if (/\b(описание|description|характеристика|feature)\b/i.test(lowerText)) return '📝'
    if (/\b(лицо|face|сердце|heart|мозг|brain|основа|backbone)\b/i.test(lowerText)) return '💭'
    
    // Не добавляем эмодзи для обычных пунктов (будет использован стандартный буллет)
    return ''
  }
  
  // Параграфы - определяем начало важных фраз
  if (context === 'paragraph') {
    const first100 = lowerText.substring(0, 100)
    if (/\b(важно|important|внимание|attention)\b/i.test(first100)) return '⚠️'
    if (/\b(совет|tip|рекомендация|hint)\b/i.test(first100)) return '💡'
    if (/\b(пример|example|for example)\b/i.test(first100)) return '💬'
  }
  
  return ''
}

// Преобразует ваш формат в markdown с добавлением эмодзи
function convertToMarkdown(content: string): string {
  if (!content) return ''
  
  let md = content
  
  // Remove undefined/null text before processing
  md = md.replace(/\bundefined\b/gi, '')
  md = md.replace(/\bnull\b/gi, '')
  md = md.replace(/\bNaN\b/gi, '')
  md = md.replace(/\bInfinity\b/gi, '')
  md = md.replace(/\[object\s+Object\]/gi, '')
  md = md.replace(/\[object\s+Array\]/gi, '')
  
  // Preserve images before processing - extract and restore them
  // Use a more robust approach that handles very long data URLs
  const imagePlaceholders: string[] = []
  
  // Extract all images (both data URLs and regular URLs) in one pass
  // Match: ![alt](src) - handle both data: URLs and regular URLs
  // For data URLs, match everything until the closing parenthesis (non-greedy to avoid issues)
  // Use a more robust pattern that handles very long base64 strings
  const images: Array<{ match: string; placeholder: string }> = []
  
  // First, try to match data URLs (they can be very long, so we need a more permissive pattern)
  // Match: ![alt](data:image/type;base64,verylongstring)
  // Use multiline mode and more robust pattern to handle very long base64 strings
  // Pattern explanation: 
  // - !\[([^\]]*)\] - matches ![alt] where alt can be empty
  // - \( - opening parenthesis
  // - (data:[^)]+) - matches data:... but this might fail on very long strings
  // Better approach: match until we find the closing parenthesis, handling newlines
  const dataUrlPattern = /!\[([^\]]*)\]\((data:[^;]+;base64,[A-Za-z0-9+/=\s]+)\)/g
  let match
  let lastIndex = 0
  while ((match = dataUrlPattern.exec(md)) !== null) {
    // Validate that we have a complete match (ends with closing paren)
    const fullMatch = match[0]
    if (fullMatch.endsWith(')')) {
      const placeholder = `__IMAGE_PLACEHOLDER_${imagePlaceholders.length}__`
      imagePlaceholders.push(fullMatch)
      images.push({ match: fullMatch, placeholder })
    } else {
      // Incomplete match, try to find the actual end
      const startPos = match.index
      const altText = match[1] || ''
      const dataUrlStart = md.indexOf('data:', startPos)
      if (dataUrlStart !== -1) {
        // Find the closing parenthesis after data URL
        let parenPos = dataUrlStart
        let parenCount = 0
        while (parenPos < md.length) {
          if (md[parenPos] === '(') parenCount++
          if (md[parenPos] === ')') {
            parenCount--
            if (parenCount === 0) {
              const fullMatch = md.substring(startPos, parenPos + 1)
              const placeholder = `__IMAGE_PLACEHOLDER_${imagePlaceholders.length}__`
              imagePlaceholders.push(fullMatch)
              images.push({ match: fullMatch, placeholder })
              break
            }
          }
          parenPos++
        }
      }
    }
    // Prevent infinite loop
    if (match.index === lastIndex) break
    lastIndex = match.index
  }
  
  // Also handle regular URLs (non-data URLs) - must come after data URL matching
  // Match: ![alt](http://... or https://... or relative paths)
  // This includes S3/CDN URLs from DigitalOcean Spaces
  const regularImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  let regularMatch
  while ((regularMatch = regularImagePattern.exec(md)) !== null) {
    const fullMatch = regularMatch[0]
    // Skip if already processed as data URL
    if (!fullMatch.includes('data:')) {
      const placeholder = `__IMAGE_PLACEHOLDER_${imagePlaceholders.length}__`
      imagePlaceholders.push(fullMatch)
      images.push({ match: fullMatch, placeholder })
      const src = regularMatch[2]
    }
  }
  
  // Also handle base64 strings without data: prefix (fallback)
  // Match: ![alt](base64string) where base64string looks like base64
  const base64Pattern = /!\[([^\]]*)\]\(([A-Za-z0-9+/=]{100,})\)/g
  let base64Match
  while ((base64Match = base64Pattern.exec(md)) !== null) {
    const fullMatch = base64Match[0]
    // Skip if already processed
    if (!images.some(img => img.match === fullMatch)) {
      const placeholder = `__IMAGE_PLACEHOLDER_${imagePlaceholders.length}__`
      // Convert to proper data URL format
      const fixedMatch = fullMatch.replace(/\(([A-Za-z0-9+/=]+)\)$/, '(data:image/png;base64,$1)')
      imagePlaceholders.push(fixedMatch)
      images.push({ match: fullMatch, placeholder })
    }
  }
  
  // Replace images in reverse order to preserve positions
  for (let i = images.length - 1; i >= 0; i--) {
    md = md.replace(images[i].match, images[i].placeholder)
  }
  
  
  // Remove empty formatting tags first (e.g., [BOLD][/BOLD] or [BOLD] [/BOLD])
  md = md.replace(/\[BOLD\]\s*\[\/BOLD\]/gi, '')
  md = md.replace(/\[ITALIC\]\s*\[\/ITALIC\]/gi, '')
  md = md.replace(/\[CENTER\]\s*\[\/CENTER\]/gi, '')
  md = md.replace(/\[RIGHT\]\s*\[\/RIGHT\]/gi, '')
  md = md.replace(/\[JUSTIFY\]\s*\[\/JUSTIFY\]/gi, '')
  
  // Clean up headings that only contain empty formatting tags (e.g., "## [BOLD]" becomes "##")
  md = md.replace(/^(#{1,6})\s+\[(BOLD|ITALIC|CENTER|RIGHT|JUSTIFY)\]\s*$/gim, '$1')
  
  // Преобразуем [BOLD] и [ITALIC] теги
  md = md.replace(/\[BOLD\]([\s\S]*?)\[\/BOLD\]/g, '**$1**')
  md = md.replace(/\[ITALIC\]([\s\S]*?)\[\/ITALIC\]/g, '*$1*')
  
  // Преобразуем alignment теги в div с align атрибутом
  md = md.replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/g, '<div align="center">$1</div>')
  md = md.replace(/\[RIGHT\]([\s\S]*?)\[\/RIGHT\]/g, '<div align="right">$1</div>')
  md = md.replace(/\[JUSTIFY\]([\s\S]*?)\[\/JUSTIFY\]/g, '<div align="justify">$1</div>')
  
  // Remove empty headings (e.g., "##" with no text)
  md = md.replace(/^(#{1,6})\s*$/gm, '')
  
  // Убираем артефакты
  md = md.replace(/;\s*\d+\./g, '')
  md = md.replace(/\.\s*\d+\./g, '.')
  md = md.replace(/\s+\d+\.\s*$/gm, '')
  
  // Don't add emojis to headings - just normalize them
  // Remove any existing emojis and bold formatting from headings (headers are already bold)
  md = md.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
    // Remove emojis from the start
    const emojiPattern = /\p{Emoji}/u
    let cleanedText = text.trim()
    
    // Remove emoji at the start if present
    if (emojiPattern.test(cleanedText.charAt(0))) {
      cleanedText = cleanedText.replace(/^\p{Emoji}\s*/u, '')
    }
    
    // Remove bold markdown (**text**) from headers since headers are already bold
    cleanedText = cleanedText.replace(/\*\*(.+?)\*\*/g, '$1')
    // Remove italic markdown (*text*) from headers
    cleanedText = cleanedText.replace(/\*(.+?)\*/g, '$1')
    // Remove any remaining single asterisks at the end
    cleanedText = cleanedText.replace(/\*+$/, '')
    // Remove any remaining single asterisks at the start
    cleanedText = cleanedText.replace(/^\*+/, '')
    
    return `${hashes} ${cleanedText.trim()}`
  })
  
  // Обрабатываем списки: разделяем нумерованные и маркированные
  // Сначала обрабатываем маркированные списки (не трогаем нумерованные)
  md = md.replace(/^(\s*)([-•*·–—])\s+(.+)$/gm, (match, indent, marker, text) => {
    const trimmedText = text.trim()
    
    // Проверяем, есть ли уже эмодзи в начале текста
    const hasEmoji = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✓]/u.test(trimmedText)
    
    if (!hasEmoji) {
      const emoji = getEmojiForContext(trimmedText, 'list')
      if (emoji) {
        // Если нашли эмодзи, заменяем оригинальный буллет на стандартный маркер с эмодзи
        return `${indent}- ${emoji} ${trimmedText}`
      }
    }
    // Маркированный список - нормализуем на стандартный
    return `${indent}- ${trimmedText}`
  })
  
  // Нормализуем нумерованные списки - сохраняем оригинальную нумерацию
  // Не заменяем числа, только нормализуем формат (убираем лишние пробелы)
  md = md.replace(/^(\s*)(\d+)\.\s+/gm, '$1$2. ')
  
  // Restore images
  imagePlaceholders.forEach((image, index) => {
    md = md.replace(`__IMAGE_PLACEHOLDER_${index}__`, image)
  })
  
  return md
}

// Component for images with loading placeholder
function ImageWithPlaceholder({ 
  src, 
  alt, 
  width, 
  height, 
  className, 
  loading,
  maxWidth,
  maxHeight
}: { 
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  loading?: 'lazy' | 'eager'
  maxWidth?: number
  maxHeight?: number
}) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasError, setHasError] = React.useState(false)
  const [aspectRatio, setAspectRatio] = React.useState<number | null>(null)
  const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null)

  // Try to get aspect ratio from image dimensions
  React.useEffect(() => {
    if (width && height) {
      setAspectRatio(width / height)
      setIsLoading(false)
    } else {
      // Try to load image to get dimensions (only for data URLs or if we need dimensions)
      const img = document.createElement('img')
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
        setAspectRatio(img.width / img.height)
        setIsLoading(false)
      }
      img.onerror = () => {
        setHasError(true)
        setIsLoading(false)
      }
      img.src = src
    }
  }, [src, width, height])

  // Show alt text if image failed to load - compact version
  if (hasError) {
    const displayText = getImageDisplayText(alt || '', src)
    const shortText = displayText.length > 50 ? displayText.substring(0, 47) + '...' : displayText
    return (
      <div className="my-2 px-2 py-1 inline-block border border-dashed border-border rounded text-xs text-muted-foreground bg-muted/30">
        {shortText || 'Изображение недоступно'}
      </div>
    )
  }

  // Use detected dimensions if available, otherwise use provided dimensions
  const finalWidth = imageDimensions?.width || width
  const finalHeight = imageDimensions?.height || height

  return (
    <div className="relative" style={aspectRatio ? { aspectRatio } : undefined}>
      {isLoading && (
        <div 
          className="absolute inset-0 bg-muted animate-pulse rounded-lg"
          style={{ 
            aspectRatio: aspectRatio || 16/9,
            minHeight: '200px'
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={finalWidth}
        height={finalHeight}
        className={className}
        loading={loading}
        style={{ 
          maxWidth: maxWidth ? `${maxWidth}px` : '100%', 
          maxHeight: maxHeight ? `${maxHeight}px` : 'none',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain' as const,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 200ms ease-in-out'
        }}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
        onLoad={() => {
          setIsLoading(false)
        }}
      />
    </div>
  )
}

