'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

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
  const hasContent = content && content.trim().length > 0 && 
    !content.includes('Document content will be displayed here...') &&
    !content.includes('Document contains tables below.')
  
  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none ${className}`}>
      <div className="document-content space-y-6">
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
  // Преобразуем форматирование в markdown
  const markdown = convertToMarkdown(content)
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{
        h1: ({ children }) => {
          // Главный заголовок - самый крупный и выразительный
          return (
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mt-12 mb-8 text-foreground border-b-2 border-border/60 pb-4 leading-tight tracking-tight">
              {children}
            </h1>
          )
        },
        h2: ({ children }) => {
          // Подзаголовок первого уровня - крупный и четкий
          return (
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mt-10 mb-6 text-foreground border-b border-border/40 pb-3 leading-tight tracking-tight">
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
        p: ({ children }) => (
          <p className="mb-5 text-base sm:text-lg leading-relaxed text-foreground">
            {children}
          </p>
        ),
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
        ol: ({ children }) => (
          <ol className="mb-6 ml-6 list-decimal space-y-3 text-base sm:text-lg text-foreground">
            {children}
          </ol>
        ),
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
          <div className="overflow-x-auto my-6 rounded-lg border border-border shadow-sm -mx-4 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
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
        img: ({ src, alt }) => (
          <div className="my-6">
            <img 
              src={src} 
              alt={alt}
              className="rounded-lg border border-border max-w-full h-auto"
              loading="lazy"
            />
          </div>
        ),
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
      <div className="overflow-x-auto rounded-lg border border-border shadow-sm -mx-4 sm:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded">
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
  
  // Преобразуем [BOLD] и [ITALIC] теги
  md = md.replace(/\[BOLD\]([\s\S]*?)\[\/BOLD\]/g, '**$1**')
  md = md.replace(/\[ITALIC\]([\s\S]*?)\[\/ITALIC\]/g, '*$1*')
  
  // Преобразуем alignment теги в div с align атрибутом
  md = md.replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/g, '<div align="center">$1</div>')
  md = md.replace(/\[RIGHT\]([\s\S]*?)\[\/RIGHT\]/g, '<div align="right">$1</div>')
  md = md.replace(/\[JUSTIFY\]([\s\S]*?)\[\/JUSTIFY\]/g, '<div align="justify">$1</div>')
  
  // Убираем артефакты
  md = md.replace(/;\s*\d+\./g, '')
  md = md.replace(/\.\s*\d+\./g, '.')
  md = md.replace(/\s+\d+\.\s*$/gm, '')
  
  // Добавляем эмодзи к заголовкам markdown (если их еще нет)
  md = md.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
    // Проверяем, есть ли уже эмодзи в начале
    if (!/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text.trim())) {
      const emoji = getEmojiForContext(text, 'heading')
      return `${hashes} ${emoji ? emoji + ' ' : ''}${text}`
    }
    return match
  })
  
  // Добавляем эмодзи к спискам и убираем оригинальные буллеты
  md = md.replace(/^(\s*[-•*·–—]|\s*\d+\.)\s+(.+)$/gm, (match, marker, text) => {
    const trimmedText = text.trim()
    const indent = match.match(/^(\s*)/)?.[1] || ''
    
    // Проверяем, есть ли уже эмодзи в начале текста
    const hasEmoji = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✓]/u.test(trimmedText)
    
    if (!hasEmoji) {
      const emoji = getEmojiForContext(trimmedText, 'list')
      if (emoji) {
        // Если нашли эмодзи, заменяем оригинальный буллет на стандартный маркер с эмодзи
        return `${indent}- ${emoji} ${trimmedText}`
      }
      // Если эмодзи нет, нормализуем маркер но оставляем стандартный формат
      // Определяем тип маркера
      const isNumbered = /^\d+\./.test(marker.trim())
      if (isNumbered) {
        // Нумерованный список - оставляем как есть (будут нормализованы позже)
        return match
      }
      // Маркированный список - нормализуем на стандартный
      return `${indent}- ${trimmedText}`
    }
    // Если эмодзи уже есть, убираем оригинальный буллет и используем стандартный маркер
    return `${indent}- ${trimmedText}`
  })
  
  // Нормализуем нумерованные списки - просто преобразуем все в стандартный формат
  // Не пытаемся проверять эмодзи в lookahead, так как это может вызвать проблемы
  md = md.replace(/^(\s*)\d+\.\s+/gm, '$11. ')
  
  return md
}

