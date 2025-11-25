import { NextResponse } from 'next/server'
import { generateTestSchema } from '@/lib/schemas/generate-test'
import { validateRequest, handleApiError, successResponse } from '@/lib/api-helpers'

// Route segment config
export const maxDuration = 60 // 60 seconds for Grok API calls
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Validate request body
    const validation = await validateRequest(request, generateTestSchema)
    if (!validation.success) {
      return validation.response
    }

    const { params, context } = validation.data
    console.log('Generate test request:', { 
      params, 
      contextTextLength: context?.text?.length || 0,
      hasApiKey: !!process.env.GROK_API_KEY
    })

    // Check if Grok API key is available
    if (!process.env.GROK_API_KEY) {
      // Fallback to mock questions if no API key
      const mockQuestions = [
        {
          id: `q_${Date.now()}_1`,
          type: "mcq",
          prompt: "What is the main topic of this document?",
          choices: ["Menu items", "Pricing", "Restaurant hours", "Contact information"],
          correct_answer: "0",
          explanation: "The document contains menu items and pricing information."
        },
        {
          id: `q_${Date.now()}_2`,
          type: "tf",
          prompt: "This document contains pricing information.",
          correct_answer: "true",
          explanation: "The document includes prices for various menu items."
        },
        {
          id: `q_${Date.now()}_3`,
          type: "mcq",
          prompt: "What type of cuisine is featured in this menu?",
          choices: ["Italian", "Russian", "Mixed", "Fast food"],
          correct_answer: "2",
          explanation: "The menu contains a mix of different cuisines and styles."
        }
      ]

      return NextResponse.json({
        success: true,
        data: {
          questions: mockQuestions,
          totalGenerated: mockQuestions.length
        },
        provider: "mock",
        message: "Using mock questions - GROK_API_KEY not configured"
      })
    }

    // Generate questions using Grok API
    // Clean content to remove images and save tokens
    const cleanContent = (text: string): string => {
      if (!text) return ''
      // Remove markdown image syntax ![alt](src)
      let cleaned = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove HTML img tags
      cleaned = cleaned.replace(/<img[^>]*>/gi, '')
      // Remove base64 image data
      cleaned = cleaned.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Image removed]')
      return cleaned
    }

    const cleanedContextText = cleanContent(context?.text || '')
    
    // Try different model names: grok-4 (latest), grok-beta (beta), grok-2 (older)
    const models = ['grok-4', 'grok-beta', 'grok-2']
    let grokResponse: Response | null = null
    let lastError: string | null = null
    let lastStatus: number | null = null
    const errorsByModel: Record<string, string> = {}
    
    for (const model of models) {
      try {
        const startTime = Date.now()
        console.log(`Attempting Grok API call with model: ${model}`)
        
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
            content: `You are an expert test generator. Generate ${params?.count || 5} high-quality questions based on the provided content. 
            
            Requirements:
            - Questions should test understanding of the content
            - Include multiple choice, true/false, and fill-in-the-blank questions
            - Provide clear explanations for answers
            - Difficulty level: ${params?.difficulty || 'medium'}
            - CRITICAL LANGUAGE REQUIREMENT: Generate ALL questions in ${params?.locale === 'ru' ? 'Russian (Русский)' : 'English'}. The document language is ${params?.locale === 'ru' ? 'Russian' : 'English'}, so ALL questions, answers, choices, and explanations MUST be in ${params?.locale === 'ru' ? 'Russian' : 'English'}. DO NOT translate or mix languages. Preserve the original document's language.
            - IMPORTANT: Skip all images and image references. Do not use tokens for images. Focus only on text content.
            
            Return ONLY a valid JSON array with this exact format:
            [
              {
                "id": "unique_id",
                "type": "mcq|tf|complete",
                "prompt": "Question text",
                "choices": ["option1", "option2", "option3", "option4"],
                "correct_answer": "0|1|2|3|true|false|answer_text",
                "explanation": "Why this answer is correct"
              }
            ]`
          },
          {
            role: 'user',
            content: `Generate questions based on this content (images are excluded to save tokens):\n\n${cleanedContextText || 'No content provided'}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })
        
        const duration = Date.now() - startTime
        lastStatus = grokResponse.status
        console.log(`Grok API request to ${model} took ${duration}ms, status: ${grokResponse.status}`)
        
        if (grokResponse.ok) {
          // Success with this model, break out of loop
          console.log(`Grok API success with model: ${model} (${duration}ms)`)
          break
        } else {
          // Try next model, but save error for logging
          const errorText = await grokResponse.text().catch(() => 'Unknown error')
          let errorMessage = `${grokResponse.status}: ${errorText.substring(0, 300)}`
          
          // Check if it's an API key error
          if (grokResponse.status === 400 && errorText.includes('Incorrect API key')) {
            errorMessage = `Invalid API key. Please update GROK_API_KEY in Vercel environment variables. ${errorText.substring(0, 200)}`
          }
          
          lastError = errorMessage
          errorsByModel[model] = errorMessage
          console.error(`Grok API failed with model ${model} (${duration}ms):`, errorMessage)
          grokResponse = null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        lastError = errorMessage
        errorsByModel[model] = errorMessage
        console.error(`Grok API error with model ${model}:`, errorMessage)
        if (err instanceof Error && err.stack) {
          console.error('Stack trace:', err.stack)
        }
        grokResponse = null
        continue
      }
    }

    if (!grokResponse || !grokResponse.ok) {
      const errorBody = lastError || 'All models failed'
      console.error(`Grok API error: All models failed. Last error: ${errorBody}`)
      console.error(`All errors by model:`, JSON.stringify(errorsByModel, null, 2))
      
      // Check if it's an API key issue
      const isApiKeyError = lastStatus === 400 && errorBody.includes('Incorrect API key')
      
      // Return detailed error information instead of silently falling back
      return NextResponse.json({
        success: false,
        message: isApiKeyError 
          ? 'Grok API key is invalid. Please update GROK_API_KEY in Vercel environment variables.'
          : 'Grok API failed - unable to generate questions',
        provider: "grok",
        error: errorBody,
        debug: {
          hasApiKey: !!process.env.GROK_API_KEY,
          apiKeyLength: process.env.GROK_API_KEY?.length || 0,
          apiKeyPrefix: process.env.GROK_API_KEY?.substring(0, 10) || 'N/A',
          lastStatus,
          errorsByModel,
          modelsAttempted: models,
          isApiKeyError
        }
      }, { status: 500 })
    }

    const grokData = (await grokResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = grokData.choices?.[0]?.message?.content

    if (!content) {
      console.error('Grok API response:', JSON.stringify(grokData, null, 2))
      throw new Error('No content received from Grok API')
    }

    // Parse the JSON response from Grok
    let generatedQuestions
    try {
      generatedQuestions = JSON.parse(content)
      if (!Array.isArray(generatedQuestions)) {
        console.error('Grok API did not return an array:', generatedQuestions)
        throw new Error('Grok API did not return an array')
      }
    } catch (parseError) {
      console.error('Failed to parse Grok response:', content.substring(0, 500))
      console.error('Parse error:', parseError)
      throw new Error('Invalid JSON response from Grok API')
    }

    interface GeneratedQuestionItem {
      id?: string
      prompt?: string
      type?: string
      choices?: string[]
      correct_answer?: string
      explanation?: string
    }
    
    // Add unique IDs to questions
    const questionsWithIds = generatedQuestions.map((q: GeneratedQuestionItem, index: number) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${index}`
    }))

    return NextResponse.json({
      success: true,
      data: {
        questions: questionsWithIds,
        totalGenerated: questionsWithIds.length
      },
      provider: "grok"
    })

  } catch (error) {
    return handleApiError(error, 'Failed to generate test questions', 500)
  }
}