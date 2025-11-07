import { NextResponse } from 'next/server'
import { db, documents } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { ParsedContent } from '@/lib/parsers'

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for long-running Grok API calls

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id: documentId } = await params

    // Fetch the document
    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc.length || !doc[0]) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
    }

    const document = doc[0]
    const parsedContent = document.parsedContent as ParsedContent | null

    if (!parsedContent) {
      return NextResponse.json({ 
        success: false, 
        message: 'Document has no parsed content to enhance' 
      }, { status: 400 })
    }

    // Check if Grok API key is available
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Grok API key not configured',
        error: 'GROK_API_KEY not set'
      }, { status: 500 })
    }

    // Prepare content for Grok enhancement (skip images to save tokens)
    // Remove image references from content
    const cleanContent = (text: string): string => {
      // Remove markdown image syntax ![alt](src)
      let cleaned = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove HTML img tags
      cleaned = cleaned.replace(/<img[^>]*>/gi, '')
      // Remove base64 image data
      cleaned = cleaned.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Image removed]')
      return cleaned
    }

    const sectionsText = parsedContent.sections
      ?.map((s, idx) => {
        const cleanTitle = cleanContent(s.title || `Section ${idx + 1}`)
        const cleanContentText = cleanContent(s.content || '')
        return `${cleanTitle}\n${cleanContentText}`
      })
      .join('\n\n') || ''

    const tablesText = parsedContent.tables
      ?.map(t => {
        const cleanTitle = cleanContent(t.title || 'Untitled')
        const tableText = `Table: ${cleanTitle}\nHeaders: ${t.headers.join(' | ')}\n${t.rows.map(r => r.join(' | ')).join('\n')}`
        return tableText
      })
      .join('\n\n') || ''

    const fullText = [sectionsText, tablesText].filter(Boolean).join('\n\n---\n\n')

    // Call Grok API to enhance the parsed content
    const models = ['grok-4', 'grok-beta', 'grok-2']
    let grokResponse: Response | null = null
    let lastError: string | null = null

    for (const model of models) {
      try {
        const startTime = Date.now()
        console.log(`Attempting Grok API enhancement with model: ${model}`)

        grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are an expert document enhancer specializing in language preservation, grammar correction, readability improvement, and professional text formatting (GPT/Notion style).

CRITICAL REQUIREMENTS (MUST FOLLOW):
1. LANGUAGE PRESERVATION: DO NOT change the original document's language. Keep ALL text in the exact same language as the original. If the document is in Russian, keep it in Russian. If it's in English, keep it in English. NEVER translate content to another language.
2. SPELLING & GRAMMAR: Thoroughly check and correct ALL spelling mistakes and grammar errors while maintaining the original meaning and style.
3. READABILITY: Enhance text readability by:
   - Improving sentence structure and flow
   - Fixing awkward phrasing
   - Ensuring proper punctuation
   - Maintaining natural language patterns
   - Preserving the original writing style and tone
4. TEXT FORMATTING (GPT/Notion Style): Apply professional formatting similar to GPT or Notion:
   - Use proper markdown formatting (headers, lists, emphasis)
   - Structure content with clear hierarchy (H1, H2, H3, etc.)
   - Format lists properly (bulleted for items, numbered for sequences)
   - Use bold (**text**) for emphasis and important terms
   - Use italic (*text*) for subtle emphasis or citations
   - Use code blocks (\`code\`) for technical terms, commands, or inline code
   - Use blockquotes (> text) for important notes or highlights
   - Ensure proper spacing between sections and paragraphs
   - Format tables with clear headers and consistent alignment
   - Use consistent formatting patterns throughout the document

Your task:
1. Analyze the provided document sections and tables
2. Improve section titles (make them more descriptive and accurate) while keeping the same language
3. Enhance content organization and readability without changing language
4. Apply professional text formatting (GPT/Notion style) with proper markdown
5. Fix formatting issues and improve structure
6. Correct ALL spelling mistakes and grammar errors
7. Maintain the original hierarchy and order
8. IMPORTANT: Skip all images and image references. Do not use tokens for images. Focus only on text content. Images will be preserved separately.

Return ONLY a valid JSON object with this exact structure:
{
  "sections": [
    {
      "title": "Improved section title",
      "level": 1,
      "content": "Enhanced content with better formatting",
      "order": 0
    }
  ],
  "tables": [
    {
      "title": "Improved table title",
      "headers": ["Header1", "Header2"],
      "rows": [["Value1", "Value2"]]
    }
  ],
  "metadata": {
    "totalSections": 0,
    "totalTables": 0,
    "wordCount": 0,
    "totalImages": 0,
    "enhancedBy": "grok",
    "enhancementTimestamp": ${Date.now()}
  }
}

Preserve all original sections and tables, but improve their titles and content quality. 
- Fix ALL spelling mistakes and grammar errors while maintaining the original meaning
- Enhance readability by improving sentence structure, flow, and clarity
- Apply professional formatting (GPT/Notion style) with proper markdown, headers, lists, emphasis, and structure
- CRITICAL: Always maintain the original document's language - NEVER translate to a different language
- Keep the same writing style and tone as the original document
- Format content with clear visual hierarchy using markdown (headers, bold, italic, lists, code blocks, blockquotes)`
              },
              {
                role: 'user',
                content: `Enhance this parsed document content (images are excluded to save tokens):\n\n${fullText}`
              }
            ],
            temperature: 0.3,
            max_tokens: 4000
          })
        })

        const duration = Date.now() - startTime
        console.log(`Grok API enhancement request to ${model} took ${duration}ms, status: ${grokResponse.status}`)

        if (grokResponse.ok) {
          console.log(`Grok API enhancement success with model: ${model} (${duration}ms)`)
          break
        } else {
          const errorText = await grokResponse.text().catch(() => 'Unknown error')
          lastError = `${grokResponse.status}: ${errorText.substring(0, 300)}`
          console.error(`Grok API enhancement failed with model ${model}:`, lastError)
          grokResponse = null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        lastError = errorMessage
        console.error(`Grok API enhancement error with model ${model}:`, errorMessage)
        grokResponse = null
        continue
      }
    }

    if (!grokResponse || !grokResponse.ok) {
      return NextResponse.json({
        success: false,
        message: 'Failed to enhance document with Grok API',
        error: lastError || 'All models failed'
      }, { status: 500 })
    }

    const grokData = await grokResponse.json()
    const content = grokData.choices?.[0]?.message?.content

    if (!content) {
      console.error('Grok API response:', JSON.stringify(grokData, null, 2))
      return NextResponse.json({
        success: false,
        message: 'No content received from Grok API'
      }, { status: 500 })
    }

    // Parse the enhanced content
    let enhancedContent: ParsedContent
    try {
      enhancedContent = JSON.parse(content)
      
      // Validate structure
      if (!enhancedContent.sections || !Array.isArray(enhancedContent.sections)) {
        throw new Error('Invalid sections structure')
      }
      if (!enhancedContent.tables || !Array.isArray(enhancedContent.tables)) {
        throw new Error('Invalid tables structure')
      }
      if (!enhancedContent.metadata) {
        throw new Error('Missing metadata')
      }

      // Preserve images from original if they exist
      if (parsedContent.images && Array.isArray(parsedContent.images)) {
        enhancedContent.images = parsedContent.images
      } else {
        enhancedContent.images = []
      }

      // Update metadata
      enhancedContent.metadata = {
        ...enhancedContent.metadata,
        totalSections: enhancedContent.sections.length,
        totalTables: enhancedContent.tables.length,
        totalImages: enhancedContent.images.length,
        wordCount: enhancedContent.sections.reduce((count, s) => count + (s.content?.split(/\s+/).length || 0), 0),
        parserVersion: parsedContent.metadata?.parserVersion || '1.0',
        ...(enhancedContent.metadata && typeof enhancedContent.metadata === 'object' ? enhancedContent.metadata : {})
      } as ParsedContent['metadata'] & { enhancedBy?: string; enhancementTimestamp?: number }
      
      // Add enhancement metadata (using type assertion since these are additional fields)
      ;(enhancedContent.metadata as any).enhancedBy = 'grok'
      ;(enhancedContent.metadata as any).enhancementTimestamp = Date.now()
    } catch (parseError) {
      console.error('Failed to parse Grok enhancement response:', content.substring(0, 500))
      console.error('Parse error:', parseError)
      return NextResponse.json({
        success: false,
        message: 'Invalid JSON response from Grok API',
        error: parseError instanceof Error ? parseError.message : 'Parse error'
      }, { status: 500 })
    }

    // Update the document with enhanced content
    const updated = await db
      .update(documents)
      .set({
        parsedContent: enhancedContent,
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        document: updated[0],
        enhancedContent
      },
      message: 'Document enhanced successfully with Grok API'
    })
  } catch (error) {
    console.error('Document enhancement API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to enhance document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

