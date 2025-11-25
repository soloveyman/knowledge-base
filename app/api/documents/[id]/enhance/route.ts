import { NextResponse } from 'next/server'
import { db, documents, usage, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import type { ParsedContent } from '@/lib/parsers'

/**
 * Get owner ID for usage counting - if user is owner, return their ID,
 * if user is manager/employee, find owner with same businessId
 */
async function getOwnerIdForUsage(userId: string, userRole: string, businessId: string | null): Promise<string | null> {
  // If user is owner, use their ID
  if (userRole === 'owner') {
    return userId
  }
  
  // If user is manager/employee, find owner with same businessId
  if (businessId) {
    const owner = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, 'owner'),
          eq(users.businessId, businessId)
        )
      )
      .limit(1)
    
    if (owner.length > 0) {
      return owner[0].id
    }
  }
  
  return null
}

// Route segment config for performance
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for long-running Grok API calls

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let documentId: string | undefined
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const paramsResolved = await params
    documentId = paramsResolved.id

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
    // Remove image references from content - comprehensive cleanup
    const cleanContent = (text: string): string => {
      if (!text || typeof text !== 'string') return ''
      
      let cleaned = text
      
      // Remove markdown image syntax ![alt](src) - handle both short and long URLs
      // Match: ![alt](data:image/...very long base64...) or ![alt](https://...)
      cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image]')
      
      // Remove HTML img tags (self-closing and with closing tag)
      cleaned = cleaned.replace(/<img[^>]*\/?>/gi, '[Image]')
      cleaned = cleaned.replace(/<img[^>]*>[\s\S]*?<\/img>/gi, '[Image]')
      
      // Remove base64 image data URLs (can be very long)
      // Match data:image/type;base64, followed by base64 string (can be multiline)
      cleaned = cleaned.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/g, '[Image]')
      
      // Remove any remaining long base64-like strings (likely images)
      // Match strings that look like base64 and are longer than 100 chars
      cleaned = cleaned.replace(/[A-Za-z0-9+/=]{100,}/g, (match) => {
        // If it looks like base64 (mostly alphanumeric with +/=), replace it
        if (/^[A-Za-z0-9+/=\s]+$/.test(match) && match.length > 100) {
          return '[Image data]'
        }
        return match
      })
      
      // Remove image placeholders that might have been added
      cleaned = cleaned.replace(/\[IMG_\d+\]/g, '[Image]')
      cleaned = cleaned.replace(/__IMAGE_PLACEHOLDER_\d+__/g, '[Image]')
      
      // Clean up multiple [Image] markers
      cleaned = cleaned.replace(/\[Image\](?:\s*\[Image\])+/g, '[Image]')
      
      return cleaned.trim()
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
        // Clean headers and rows too - they might contain image references
        const cleanHeaders = t.headers.map(h => cleanContent(String(h))).join(' | ')
        const cleanRows = t.rows.map(r => r.map(cell => cleanContent(String(cell))).join(' | ')).join('\n')
        const tableText = `Table: ${cleanTitle}\nHeaders: ${cleanHeaders}\n${cleanRows}`
        return tableText
      })
      .join('\n\n') || ''

    let fullText = [sectionsText, tablesText].filter(Boolean).join('\n\n---\n\n')
    
    // Final cleanup pass - remove any remaining image data that might have slipped through
    // This is especially important for very long base64 strings
    fullText = cleanContent(fullText)
    
    console.log(`Content prepared for Grok: ${fullText.length} chars (images removed)`)

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    // Grok models have different limits:
    // - grok-4: 256000 tokens
    // - grok-2: 131072 tokens
    // - grok-3: similar to grok-4
    const estimatedTokens = Math.ceil(fullText.length / 4)
    const maxTokensForGrok4 = 256000
    const maxTokensForGrok2 = 131072
    const safetyMargin = 0.8 // Use 80% of limit to be safe
    
    console.log(`Document content size: ${fullText.length} chars, estimated tokens: ${estimatedTokens}`)
    
    // Truncate content if it's too large
    let contentToSend = fullText
    let wasTruncated = false
    if (estimatedTokens > maxTokensForGrok4 * safetyMargin) {
      const maxChars = Math.floor(maxTokensForGrok4 * safetyMargin * 4)
      console.warn(`Content too large (${estimatedTokens} tokens), truncating to ${maxChars} chars`)
      contentToSend = fullText.substring(0, maxChars) + '\n\n[... Content truncated due to size limits. Only the first part of the document will be enhanced ...]'
      console.log(`Truncated content size: ${contentToSend.length} chars`)
      wasTruncated = true
    }
    
    // Call Grok API to enhance the parsed content
    // Updated models: grok-beta is deprecated, use grok-3 instead
    const models = ['grok-4', 'grok-3', 'grok-2']
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

CRITICAL: Return ONLY a valid JSON object. Do NOT include any markdown code blocks, explanations, or additional text. Return ONLY the raw JSON object.

The JSON must have this exact structure:
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
    "enhancementTimestamp": 0
  }
}

IMPORTANT: 
- Return ONLY the JSON object, nothing else
- Do NOT wrap it in markdown code blocks (no \`\`\`json)
- Do NOT add any explanations or text before or after the JSON
- Start your response with { and end with }

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
                content: `Enhance this parsed document content (images are excluded to save tokens):\n\n${contentToSend}`
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
          let errorText = 'Unknown error'
          let errorDetails: any = null
          try {
            errorText = await grokResponse.text()
            try {
              errorDetails = JSON.parse(errorText)
              errorText = errorDetails.error?.message || errorDetails.message || errorText
            } catch {
              // Use raw text if JSON parsing fails
            }
          } catch {
            // Use default if text parsing fails
          }
          
          // Check if it's a token limit error - skip this model
          const isTokenLimitError = errorDetails?.error?.includes('maximum prompt length') || 
                                   errorDetails?.error?.includes('tokens') ||
                                   errorText.includes('maximum prompt length') ||
                                   errorText.includes('tokens')
          
          if (isTokenLimitError) {
            console.warn(`Model ${model} token limit exceeded, trying next model...`)
            lastError = `Token limit exceeded for ${model}: ${errorText.substring(0, 200)}`
          } else {
            lastError = `${grokResponse.status}: ${errorText.substring(0, 300)}`
          }
          
          console.error(`Grok API enhancement failed with model ${model} (${duration}ms):`, {
            status: grokResponse.status,
            statusText: grokResponse.statusText,
            error: errorText.substring(0, 500),
            isTokenLimitError,
            documentId
          })
          grokResponse = null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        const errorStack = err instanceof Error ? err.stack : undefined
        lastError = errorMessage
        console.error(`Grok API enhancement error with model ${model}:`, {
          message: errorMessage,
          stack: errorStack,
          documentId
        })
        grokResponse = null
        continue
      }
    }

    if (!grokResponse || !grokResponse.ok) {
      console.error('Grok API enhancement failed:', {
        status: grokResponse?.status,
        statusText: grokResponse?.statusText,
        lastError,
        documentId,
        estimatedTokens,
        contentLength: fullText.length
      })
      
      // Check if all failures were due to token limits
      const isTokenLimitError = lastError?.includes('Token limit exceeded') || 
                                lastError?.includes('maximum prompt length') ||
                                lastError?.includes('tokens')
      
      // Try to get more details from the error response
      let errorDetails = lastError || 'All models failed'
      if (grokResponse) {
        try {
          const errorText = await grokResponse.text()
          const errorJson = JSON.parse(errorText).catch(() => null)
          if (errorJson) {
            errorDetails = errorJson.error?.message || errorJson.message || errorText.substring(0, 300)
          } else {
            errorDetails = errorText.substring(0, 300)
          }
        } catch {
          // Use lastError if we can't parse
        }
      }
      
      // Provide user-friendly error message
      let userMessage = 'Failed to enhance document with Grok API'
      if (isTokenLimitError) {
        userMessage = `Document is too large to enhance (${estimatedTokens} tokens). Please split the document into smaller sections or use a document with less content.`
      }
      
      return NextResponse.json({
        success: false,
        message: userMessage,
        error: errorDetails,
        status: grokResponse?.status,
        estimatedTokens,
        maxTokens: maxTokensForGrok4
      }, { status: 500 })
    }

    let grokData: any
    try {
      grokData = await grokResponse.json()
    } catch (jsonError) {
      console.error('Failed to parse Grok API response as JSON:', jsonError)
      const responseText = await grokResponse.text().catch(() => 'Unable to read response')
      console.error('Grok API response text (first 1000 chars):', responseText.substring(0, 1000))
      return NextResponse.json({
        success: false,
        message: 'Invalid response format from Grok API',
        error: 'JSON parse error',
        responsePreview: responseText.substring(0, 500)
      }, { status: 500 })
    }

    const content = grokData.choices?.[0]?.message?.content

    if (!content) {
      console.error('Grok API response missing content:', {
        response: JSON.stringify(grokData, null, 2),
        choices: grokData.choices,
        documentId
      })
      return NextResponse.json({
        success: false,
        message: 'No content received from Grok API',
        error: 'Empty response',
        response: grokData
      }, { status: 500 })
    }

    // Parse the enhanced content
    let enhancedContent: ParsedContent
    try {
      // Extract JSON from content - Grok might wrap it in markdown code blocks or add extra text
      let jsonContent = content.trim()
      
      // Remove markdown code blocks if present
      const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim()
      }
      
      // Try to find JSON object in the content (handle cases where there's text before/after)
      // Find the first { and then find the matching closing }
      const firstBrace = jsonContent.indexOf('{')
      if (firstBrace !== -1) {
        let braceCount = 0
        let endBrace = firstBrace
        for (let i = firstBrace; i < jsonContent.length; i++) {
          if (jsonContent[i] === '{') braceCount++
          if (jsonContent[i] === '}') braceCount--
          if (braceCount === 0) {
            endBrace = i
            break
          }
        }
        if (braceCount === 0) {
          jsonContent = jsonContent.substring(firstBrace, endBrace + 1)
        }
      }
      
      // Log the extracted content for debugging (first 500 chars)
      console.log('Extracted JSON content (first 500 chars):', jsonContent.substring(0, 500))
      
      enhancedContent = JSON.parse(jsonContent)
      
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
      console.error('Failed to parse Grok enhancement response')
      console.error('Full content length:', content.length)
      console.error('Content (first 1000 chars):', content.substring(0, 1000))
      console.error('Content (last 500 chars):', content.substring(Math.max(0, content.length - 500)))
      console.error('Parse error:', parseError)
      console.error('Parse error details:', parseError instanceof Error ? {
        message: parseError.message,
        stack: parseError.stack
      } : parseError)
      return NextResponse.json({
        success: false,
        message: 'Invalid JSON response from Grok API',
        error: parseError instanceof Error ? parseError.message : 'Parse error',
        contentPreview: content.substring(0, 500)
      }, { status: 500 })
    }

    // Update the document with enhanced content
    let updated
    try {
      updated = await db
        .update(documents)
        .set({
          parsedContent: enhancedContent,
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId))
        .returning()
      
      if (!updated || updated.length === 0) {
        console.error('Failed to update document after enhancement:', documentId)
        return NextResponse.json({
          success: false,
          message: 'Failed to save enhanced content to database',
          error: 'Database update failed'
        }, { status: 500 })
      }
    } catch (dbError) {
      console.error('Database error updating document:', dbError)
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      return NextResponse.json({
        success: false,
        message: 'Failed to save enhanced content to database',
        error: dbErrorMessage
      }, { status: 500 })
    }

    // Check usage limit before allowing enhancement (for owners and managers - count in owner's usage)
    if (session.user.role === 'owner' || session.user.role === 'manager') {
      const ownerId = await getOwnerIdForUsage(session.user.id, session.user.role, session.user.businessId)
      
      if (ownerId) {
        const { checkUsageLimit } = await import('@/lib/subscription/usage-check')
        const limitCheck = await checkUsageLimit(ownerId, 'enhancements')
        
        if (!limitCheck.allowed) {
          return NextResponse.json({
            success: false,
            message: limitCheck.message || 'Enhancement limit reached. Please upgrade your plan to continue.',
            error: 'USAGE_LIMIT_EXCEEDED',
            current: limitCheck.current,
            max: limitCheck.max
          }, { status: 403 })
        }

        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        
        // Check if usage record exists for current month
        const existingUsage = await db
          .select()
          .from(usage)
          .where(
            and(
              eq(usage.userId, ownerId),
              eq(usage.month, currentMonth)
            )
          )
          .limit(1)

        if (existingUsage.length > 0) {
          // Update existing usage record
          await db
            .update(usage)
            .set({
              enhancementsCount: (existingUsage[0].enhancementsCount || 0) + 1,
              updatedAt: new Date()
            })
            .where(eq(usage.id, existingUsage[0].id))
          
          console.log(`[Usage Update] Document enhancement by ${session.user.role} (${session.user.id}) counted in owner's (${ownerId}) usage. New enhancementsCount: ${(existingUsage[0].enhancementsCount || 0) + 1}`)
        } else {
          // Create new usage record
          await db.insert(usage).values({
            userId: ownerId,
            month: currentMonth,
            importsCount: 0,
            generationsCount: 0,
            enhancementsCount: 1
          })
          
          console.log(`[Usage Update] Document enhancement by ${session.user.role} (${session.user.id}) counted in owner's (${ownerId}) usage. Created new usage record with enhancementsCount: 1`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        document: updated[0],
        enhancedContent
      },
      message: wasTruncated 
        ? 'Document enhanced successfully (content was truncated due to size limits - only the first part was enhanced)'
        : 'Document enhanced successfully with Grok API',
      warning: wasTruncated ? 'Content was truncated due to size limits' : undefined
    })
  } catch (error) {
    return handleApiError(error, 'Failed to enhance document', 500)
  }
}

