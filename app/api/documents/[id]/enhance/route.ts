import { NextResponse } from 'next/server'
import { db, documents, documentImages } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { ParsedContent } from '@/lib/parsers'

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

    // Prepare content for Grok enhancement
    const sectionsText = parsedContent.sections
      ?.map((s, idx) => `${s.title || `Section ${idx + 1}`}\n${s.content}`)
      .join('\n\n') || ''

    const tablesText = parsedContent.tables
      ?.map(t => {
        const tableText = `Table: ${t.title || 'Untitled'}\nHeaders: ${t.headers.join(' | ')}\n${t.rows.map(r => r.join(' | ')).join('\n')}`
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
                content: `You are an expert document structure enhancer. Improve the structure and organization of parsed document content.

Your task:
1. Analyze the provided document sections and tables
2. Improve section titles (make them more descriptive and accurate)
3. Enhance content organization and readability
4. Fix formatting issues and improve structure
5. Correct spelling mistakes and grammar errors
6. Maintain the original hierarchy and order
7. CRITICAL: Preserve the original document's language - do NOT translate to another language. Keep all text in the same language as the original document.
8. CRITICAL: Do NOT touch, modify, refine, or process images in any way. Images will be preserved automatically from the original document. Do not include images in your response - they will be added back automatically.

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

Preserve all original sections and tables, but improve their titles and content quality. Fix spelling mistakes and grammar errors while maintaining the original meaning. Always maintain the original document's language - never translate the content to a different language. Do NOT include images in your JSON response - they will be preserved from the original document automatically.`
              },
              {
                role: 'user',
                content: `Enhance this parsed document content:\n\n${fullText}`
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

      // Preserve images from original - they're stored in document_images table
      // We'll fetch them separately and merge them back
      enhancedContent.images = []

      // Fetch existing images from database to get count
      const existingImages = await db
        .select()
        .from(documentImages)
        .where(eq(documentImages.documentId, documentId))

      // Update metadata
      enhancedContent.metadata = {
        ...enhancedContent.metadata,
        totalSections: enhancedContent.sections.length,
        totalTables: enhancedContent.tables.length,
        totalImages: existingImages.length,
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

    // Remove images from parsedContent (they're stored separately in document_images table)
    const enhancedContentWithoutImages = {
      ...enhancedContent,
      images: []
    }

    // Update the document with enhanced content
    const updated = await db
      .update(documents)
      .set({
        parsedContent: enhancedContentWithoutImages,
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId))
      .returning()

    // Images are preserved in document_images table (cascade delete is handled by DB)
    // Fetch images from database to include in response
    const savedImages = await db
      .select()
      .from(documentImages)
      .where(eq(documentImages.documentId, documentId))
    
    // Merge images back into enhancedContent for response
    if (savedImages.length > 0) {
      enhancedContent.images = savedImages
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(img => ({
          filename: img.filename,
          data: img.data,
          type: img.type,
          position: img.position ?? undefined
        }))
      enhancedContent.metadata.totalImages = savedImages.length
    }

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

