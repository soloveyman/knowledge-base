'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import Image from 'next/image'

interface DocumentRendererProps {
  content: string
  tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
  className?: string
}

// React-friendly image component for document images
function DocumentImage({ src, alt }: { src: string | Blob | undefined; alt?: string | null }) {
  // Process src synchronously to avoid hydration mismatches
  const processSrc = (source: string | Blob | undefined): { imageSrc: string; hasError: boolean; isBlob: boolean } => {
    if (!source) {
      return { imageSrc: '', hasError: true, isBlob: false }
    }

    // Handle Blob - needs async processing
    if (source instanceof Blob) {
      return { imageSrc: '', hasError: false, isBlob: true }
    }

    let srcString = typeof source === 'string' ? source : ''
    if (!srcString || srcString.trim() === '') {
      return { imageSrc: '', hasError: true, isBlob: false }
    }

    // Fix malformed base64 URLs (e.g., "base64,..." should be "data:image/png;base64,...")
    if (srcString.startsWith('base64,')) {
      const base64Data = srcString.substring(7) // Remove "base64," prefix
      // PNG signature: iVBORw0KGgo
      // JPEG signature: /9j/4AAQ
      // GIF signature: R0lGODlh
      let mimeType = 'image/png' // Default to PNG
      if (base64Data.startsWith('iVBORw0KGgo')) {
        mimeType = 'image/png'
      } else if (base64Data.startsWith('/9j/4AAQ') || base64Data.startsWith('/9j/')) {
        mimeType = 'image/jpeg'
      } else if (base64Data.startsWith('R0lGODlh')) {
        mimeType = 'image/gif'
      }
      srcString = `data:${mimeType};base64,${base64Data}`
    }

    return { imageSrc: srcString, hasError: false, isBlob: false }
  }

  const processed = processSrc(src)
  const [imageSrc, setImageSrc] = useState<string>(processed.imageSrc)
  const [isLoading, setIsLoading] = useState(processed.isBlob)
  const [hasError, setHasError] = useState(processed.hasError)

  // Only use useEffect for Blob conversion (async operation)
  React.useEffect(() => {
    if (!src || !(src instanceof Blob)) return

    // Convert Blob to data URL
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setImageSrc(result)
        setIsLoading(false)
      } else {
        setHasError(true)
        setIsLoading(false)
      }
    }
    reader.onerror = () => {
      setHasError(true)
      setIsLoading(false)
    }
    reader.readAsDataURL(src)
  }, [src])

  // Check if it's a data URL
  const isDataUrl = imageSrc.startsWith('data:')
  
  // Check if it's a valid external URL
  const isExternal = imageSrc.startsWith('http://') || imageSrc.startsWith('https://')
  
  // Check if it's a valid relative path (starts with /)
  const isRelativePath = imageSrc.startsWith('/')

  // Validate URL format for Next.js Image
  let isValidForNextImage = false
  if (isExternal || isRelativePath) {
    try {
      if (isExternal) {
        new URL(imageSrc)
        isValidForNextImage = true
      } else if (isRelativePath) {
        isValidForNextImage = true
      }
    } catch {
      isValidForNextImage = false
    }
  }

  if (hasError || !imageSrc) {
    return (
      <span className="my-6 -mx-2 sm:mx-0 block">
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
          <p>Image failed to load</p>
        </div>
      </span>
    )
  }

  // For data URLs, use regular img tag with React state management
  if (isDataUrl || !isValidForNextImage) {
    return (
      <span className="my-6 -mx-2 sm:mx-0 block">
        {isLoading && (
          <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
            <p>Loading image...</p>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt || ''}
          className={`rounded-lg border border-border max-w-full h-auto transition-opacity w-full ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ width: 'auto', height: 'auto' }}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true)
            setIsLoading(false)
          }}
        />
      </span>
    )
  }

  // For valid external URLs or relative paths, use Next.js Image
  return (
    <span className="my-6 -mx-2 sm:mx-0 block">
      {isLoading && (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground">
          <p>Loading image...</p>
        </div>
      )}
      <Image
        src={imageSrc}
        alt={alt || ''}
        width={800}
        height={600}
        className={`rounded-lg border border-border max-w-full h-auto transition-opacity w-full ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ width: 'auto', height: 'auto' }}
        unoptimized={isExternal}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
      />
    </span>
  )
}

export function DocumentRenderer({ content, tables, className = '' }: DocumentRendererProps) {
  // Если есть таблицы но нет контента, не показываем пустой контент
  const hasContent = content && content.trim().length > 0 && 
    !content.includes('Document content will be displayed here...') &&
    !content.includes('Document contains tables below.')
  
  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none ${className}`}>
      <div className="document-content space-y-6 px-0">
        {hasContent && <DocumentContent content={content} />}
        {tables && tables.length > 0 && (
          <div className={hasContent ? "mt-10 space-y-10" : "space-y-10"}>
            {tables.map((table, idx) => (
              <TableRenderer key={idx} table={table} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentContent({ content }: { content: string }) {
  // Content is already markdown from Mammoth - just clean up any remaining [BOLD]/[ITALIC] tags
  // These might still exist from old parsing, so convert them to markdown
  let markdown = content
    .replace(/\[BOLD\]([\s\S]*?)\[\/BOLD\]/g, '**$1**')
    .replace(/\[ITALIC\]([\s\S]*?)\[\/ITALIC\]/g, '*$1*')
  
  // Debug: log numbered lists in markdown
  const numberedListMatches = markdown.match(/^\s*\d+\.\s+.+$/gm)
  if (numberedListMatches && numberedListMatches.length > 0) {
    console.log('DocumentContent: Found numbered list items in markdown:', numberedListMatches.length)
    console.log('DocumentContent: First few numbered list items:', numberedListMatches.slice(0, 3))
  }
  
  // Ensure numbered lists are properly grouped (no blank lines between consecutive items)
  markdown = markdown.replace(/(^\s*\d+\.\s+.+)\n\n+(^\s*\d+\.\s+.+)/gm, '$1\n$2')
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{
        h1: ({ children }) => {
          // Главный заголовок - самый крупный и выразительный
          return (
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mt-12 mb-8 text-foreground border-b-2 border-border pb-4 leading-tight tracking-tight">
              {children}
            </h1>
          )
        },
        h2: ({ children }) => {
          // Подзаголовок первого уровня - крупный и четкий
          return (
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mt-10 mb-6 text-foreground border-b border-border pb-3 leading-tight tracking-tight">
              {children}
            </h2>
          )
        },
        h3: ({ children }) => {
          // Подзаголовок второго уровня - средний размер с акцентом
          return (
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 mb-5 text-foreground leading-tight tracking-tight">
              {children}
            </h3>
          )
        },
        h4: ({ children }) => {
          // Подзаголовок третьего уровня - заметный, но не перегруженный
          return (
            <h4 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mt-7 mb-4 text-foreground leading-tight tracking-normal">
              {children}
            </h4>
          )
        },
        h5: ({ children }) => {
          // Подзаголовок четвертого уровня - четкий акцент
          return (
            <h5 className="text-xl sm:text-2xl lg:text-3xl font-semibold mt-6 mb-3 text-foreground/90 leading-tight tracking-normal">
              {children}
            </h5>
          )
        },
        h6: ({ children }) => {
          // Подзаголовок пятого уровня - аккуратный выделенный текст
          return (
            <h6 className="text-lg sm:text-xl lg:text-2xl font-semibold mt-5 mb-3 text-foreground/80 leading-tight tracking-normal">
              {children}
            </h6>
          )
        },
        p: ({ children }) => {
          // Check if paragraph only contains an image - if so, don't wrap in <p> tag
          // This prevents hydration errors where <div> or <span> (image wrapper) is inside <p>
          const childrenArray = React.Children.toArray(children)
          
          // Check if any child is an image (could be wrapped in a span/div by our img component)
          const hasImage = childrenArray.some(child => {
            if (React.isValidElement(child)) {
              // Check if it's an img element
              if (child.type === 'img') return true
              // Check if it's a span or div containing an img
              if (child.type === 'span' || child.type === 'div') {
                const props = child.props as { children?: React.ReactNode; className?: string }
                // Check if it's our image wrapper (has block class and negative margins)
                if (props.className?.includes('block') && props.className?.includes('-mx-2')) {
                  return true
                }
                // Also check if it contains an img element
                if (props.children) {
                  const wrapperChildren = React.Children.toArray(props.children)
                  return wrapperChildren.some(c => 
                    React.isValidElement(c) && (c.type === 'img' || c.type === Image)
                  )
                }
              }
              // Check if it's the DocumentImage component directly
              if (typeof child.type === 'function' && child.type.name === 'DocumentImage') {
                return true
              }
            }
            return false
          })
          
          // If paragraph only contains an image (or image wrapper), don't wrap in <p>
          if (hasImage && childrenArray.length === 1) {
            return <>{children}</>
          }
          
          return (
            <p className="mb-5 text-base sm:text-lg leading-relaxed text-foreground">
              {children}
            </p>
          )
        },
        ul: ({ children }) => {
          // Проверяем наличие эмодзи в элементах списка через строковое представление
          const childrenStr = String(children)
          const hasEmojis = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✓✅🔴🍽️🍸👨‍🍳🏢🧼🚪📦🚚🔧📝💭]/u.test(childrenStr)
          
          return (
            <ul className={`mb-6 space-y-3 text-base sm:text-lg text-foreground ${hasEmojis ? 'list-none ml-0' : 'list-disc ml-6'}`}>
              {children}
            </ul>
          )
        },
        ol: ({ children }) => {
          console.log('DocumentContent: Rendering ordered list with', React.Children.count(children), 'items')
          return (
            <ol className="mb-6 ml-6 list-decimal space-y-3 text-base sm:text-lg text-foreground">
              {children}
            </ol>
          )
        },
        li: ({ children }) => {
          // Эмодзи уже добавлены в markdown, просто отображаем
          return (
            <li className="leading-relaxed mb-1">{children}</li>
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
          <div className="overflow-x-auto my-6 rounded-lg border border-border -mx-2 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
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
        img: ({ src, alt }) => {
          if (!src) return null
          return <DocumentImage src={src} alt={alt} />
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
      {markdown}
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
    ? nonEmptyColumnIndices.map(colIdx => table.headers[colIdx] || '')
    : []

  // Фильтруем строки - оставляем только ячейки из непустых колонок
  const filteredRowsData = filteredRows.map(row =>
    nonEmptyColumnIndices.map(colIdx => {
      const cell = row[colIdx]
      return cell !== undefined && cell !== null ? String(cell) : ''
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
      <div className="overflow-x-auto rounded-lg border border-border -mx-2 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
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

