import { NextResponse } from 'next/server'
import type { TestParams, TestContext, GeneratedQuestion } from '@/types/test'

// Rough token estimation: ~4 characters per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Remove base64 image data from text to reduce token usage
function removeImageData(text: string): string {
  if (!text) return text
  
  // Remove data:image URLs (base64 encoded images)
  // Matches: data:image/[type];base64,[base64data]
  let cleaned = text.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '[Image removed]')
  
  // Remove any remaining long base64-like strings (likely embedded images)
  // Matches sequences of base64 characters that are longer than 100 characters
  cleaned = cleaned.replace(/[A-Za-z0-9+/=]{100,}/g, (match) => {
    // Check if it looks like base64 (has padding or is very long)
    if (match.length > 500 || /={1,2}$/.test(match)) {
      return '[Image data removed]'
    }
    return match
  })
  
  return cleaned
}

// Truncate content intelligently to fit within token limits
// Use conservative limit to work with both grok-4 (256k) and grok-2 (131k)
function truncateContentForGrok(context: TestContext | undefined, maxTokens: number = 120000): string {
  if (!context) return 'No content provided'
  
  // Reserve tokens for system message and response (roughly 2000 tokens)
  const availableTokens = maxTokens - 2000
  
  // Priority order: facts > steps > definitions > text
  // Remove image data from all text fields to reduce token usage
  const facts = removeImageData((context.facts || []).filter(f => f.trim()).join('\n'))
  const steps = removeImageData((context.steps || []).filter(s => s.trim()).join('\n'))
  const definitions = removeImageData((context.definitions || []).filter(d => d.trim()).join('\n'))
  const text = removeImageData(context.text || '')
  
  // Build content in priority order
  let content = ''
  let tokensUsed = 0
  
  // Add facts first (highest priority)
  if (facts && tokensUsed < availableTokens) {
    const factsTokens = estimateTokens(facts)
    if (tokensUsed + factsTokens <= availableTokens) {
      content += `Key Facts:\n${facts}\n\n`
      tokensUsed += factsTokens
    } else {
      const remaining = availableTokens - tokensUsed
      const truncated = facts.substring(0, remaining * 4)
      content += `Key Facts:\n${truncated}\n\n`
      tokensUsed = availableTokens
    }
  }
  
  // Add steps
  if (steps && tokensUsed < availableTokens) {
    const stepsTokens = estimateTokens(steps)
    if (tokensUsed + stepsTokens <= availableTokens) {
      content += `Procedural Steps:\n${steps}\n\n`
      tokensUsed += stepsTokens
    } else {
      const remaining = availableTokens - tokensUsed
      const truncated = steps.substring(0, remaining * 4)
      content += `Procedural Steps:\n${truncated}\n\n`
      tokensUsed = availableTokens
    }
  }
  
  // Add definitions
  if (definitions && tokensUsed < availableTokens) {
    const definitionsTokens = estimateTokens(definitions)
    if (tokensUsed + definitionsTokens <= availableTokens) {
      content += `Definitions:\n${definitions}\n\n`
      tokensUsed += definitionsTokens
    } else {
      const remaining = availableTokens - tokensUsed
      const truncated = definitions.substring(0, remaining * 4)
      content += `Definitions:\n${truncated}\n\n`
      tokensUsed = availableTokens
    }
  }
  
  // Add text content (lowest priority, but most important if others are empty)
  if (text && tokensUsed < availableTokens) {
    const remaining = availableTokens - tokensUsed
    const textTokens = estimateTokens(text)
    
    if (textTokens <= remaining) {
      // Full text fits
      content += `Document Content:\n${text}`
    } else {
      // Truncate text intelligently - try to preserve complete sentences
      const maxChars = remaining * 4
      let truncated = text.substring(0, maxChars)
      
      // Try to end at a sentence boundary
      const lastPeriod = truncated.lastIndexOf('.')
      const lastNewline = truncated.lastIndexOf('\n')
      const lastBoundary = Math.max(lastPeriod, lastNewline)
      
      if (lastBoundary > maxChars * 0.8) {
        // If we found a boundary in the last 20%, use it
        truncated = truncated.substring(0, lastBoundary + 1)
      }
      
      content += `Document Content (truncated from ${text.length} to ${truncated.length} characters):\n${truncated}`
    }
  }
  
  if (!content.trim()) {
    return 'No content provided'
  }
  
  return content
}

// Local test generation function when Grok is not available
function generateLocalQuestions(params: TestParams | undefined, context: TestContext | undefined): GeneratedQuestion[] {
  const count = params?.count || 5
  const type = params?.type || 'mcq'
  const difficulty = params?.difficulty || 'medium'
  const locale = params?.locale || 'en'
  
  const questions: GeneratedQuestion[] = []
  // Remove image data from context to avoid processing it
  const text = removeImageData(context?.text || '')
  const facts = (context?.facts || []).map(f => removeImageData(f))
  const steps = (context?.steps || []).map(s => removeImageData(s))
  const definitions = (context?.definitions || []).map(d => removeImageData(d))
  
  // Extract sentences from text
  const sentences = text
    .split(/[.!?]\s+/)
    .filter(s => s.trim().length > 20)
    .slice(0, 20)
  
  // Combine all content sources
  const contentItems = [
    ...facts.filter(f => f.trim()),
    ...steps.filter(s => s.trim()),
    ...definitions.filter(d => d.trim()),
    ...sentences
  ].filter(Boolean)
  
  if (contentItems.length === 0) {
    // Fallback: create basic questions from text chunks
    const chunks = text.split(/\n+/).filter(c => c.trim().length > 30).slice(0, count)
    
    if (chunks.length > 0) {
      return chunks.map((chunk, idx) => ({
        id: `local_q_${Date.now()}_${idx}`,
        type: 'mcq',
        prompt: locale === 'ru' 
          ? `Какова основная тема, обсуждаемая в этом содержимом?`
          : `What is the main topic discussed in this content?`,
        choices: [
          chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''),
          locale === 'ru' ? 'Общая информация' : 'General information',
          locale === 'ru' ? 'Технические детали' : 'Technical details',
          locale === 'ru' ? 'Процедурные шаги' : 'Procedural steps'
        ],
        correct_answer: '0',
        explanation: locale === 'ru'
          ? `На основе содержимого документа: ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`
          : `Based on the document content: ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`
      }))
    }
    
    // Final fallback: generate generic questions if no content available
    const genericQuestions: GeneratedQuestion[] = []
    for (let i = 0; i < count; i++) {
      genericQuestions.push({
        id: `local_q_${Date.now()}_${i}`,
        type: type === 'mcq' ? 'mcq' : type === 'tf' ? 'tf' : 'complete',
        prompt: locale === 'ru'
          ? `Вопрос ${i + 1}: Что вы знаете о содержании этого документа?`
          : `Question ${i + 1}: What do you know about the content of this document?`,
        choices: type === 'mcq' 
          ? (locale === 'ru' 
              ? ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D']
              : ['Option A', 'Option B', 'Option C', 'Option D'])
          : type === 'tf' 
            ? ['True', 'False']
            : [],
        correct_answer: type === 'mcq' ? '0' : type === 'tf' ? 'true' : 'answer',
        explanation: locale === 'ru'
          ? `Этот вопрос основан на содержимом выбранного документа.`
          : `This question is based on the content of the selected document.`
      })
    }
    return genericQuestions
  }
  
  // Generate questions based on type
  for (let i = 0; i < count && i < contentItems.length; i++) {
    const item = contentItems[i]
    const baseId = `local_q_${Date.now()}_${i}`
    
    if (type === 'mcq' || type === 'multiple_choice') {
      // Create MCQ from content item
      const words = item.split(/\s+/).filter(w => w.length > 3)
      const keyWord = words[Math.floor(Math.random() * words.length)] || 'topic'
      
      questions.push({
        id: baseId,
        type: 'mcq',
        prompt: locale === 'ru' 
          ? `Что является основным аспектом следующего утверждения: "${item.substring(0, 100)}${item.length > 100 ? '...' : ''}"?`
          : `What is the main aspect of the following statement: "${item.substring(0, 100)}${item.length > 100 ? '...' : ''}"?`,
        choices: [
          item.substring(0, 60) + (item.length > 60 ? '...' : ''),
          words[0] || 'Option A',
          words[1] || 'Option B',
          'None of the above'
        ],
        correct_answer: '0',
        explanation: locale === 'ru'
          ? `Это утверждение основано на содержании документа: ${item.substring(0, 150)}...`
          : `This statement is based on the document content: ${item.substring(0, 150)}...`
      })
    } else if (type === 'tf' || type === 'true_false') {
      // Create True/False question
      const isTrue = Math.random() > 0.5
      questions.push({
        id: baseId,
        type: 'tf',
        prompt: locale === 'ru'
          ? `Верно ли следующее утверждение: "${item.substring(0, 80)}${item.length > 80 ? '...' : ''}"?`
          : `Is the following statement true: "${item.substring(0, 80)}${item.length > 80 ? '...' : ''}"?`,
        choices: ['True', 'False'],
        correct_answer: isTrue ? 'true' : 'false',
        explanation: locale === 'ru'
          ? `Это утверждение ${isTrue ? 'верно' : 'неверно'} согласно содержанию документа.`
          : `This statement is ${isTrue ? 'true' : 'false'} according to the document content.`
      })
    } else if (type === 'complete' || type === 'fill_in_blank') {
      // Create fill-in-the-blank question
      const words = item.split(/\s+/).filter(w => w.length > 4)
      const blankWord = words[Math.floor(Math.random() * words.length)] || 'concept'
      const prompt = item.replace(blankWord, '______')
      
      questions.push({
        id: baseId,
        type: 'complete',
        prompt: locale === 'ru'
          ? `Заполните пропуск: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`
          : `Fill in the blank: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`,
        choices: [],
        correct_answer: blankWord,
        explanation: locale === 'ru'
          ? `Правильный ответ: "${blankWord}" - это ключевое понятие из документа.`
          : `The correct answer is "${blankWord}" - a key concept from the document.`
      })
    }
  }
  
  // If we need more questions, repeat with variations
  while (questions.length < count) {
    const item = contentItems[questions.length % contentItems.length]
    const baseId = `local_q_${Date.now()}_${questions.length}`
    
    questions.push({
      id: baseId,
      type: type === 'mcq' ? 'mcq' : type === 'tf' ? 'tf' : 'complete',
      prompt: locale === 'ru'
        ? `Вопрос о содержании: "${item.substring(0, 80)}${item.length > 80 ? '...' : ''}"?`
        : `Question about the content: "${item.substring(0, 80)}${item.length > 80 ? '...' : ''}"?`,
      choices: type === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : type === 'tf' ? ['True', 'False'] : [],
      correct_answer: type === 'mcq' ? '0' : type === 'tf' ? 'true' : item.split(/\s+/)[0] || 'answer',
      explanation: locale === 'ru'
        ? `Ответ основан на содержании документа.`
        : `Answer based on document content.`
    })
  }
  
  return questions.slice(0, count)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { params, context } = body
    const contextTextLength = context?.text?.length || 0
    const estimatedTokens = estimateTokens(context?.text || '')
    
    console.log('Generate test request:', { 
      params, 
      contextTextLength,
      estimatedTokens,
      hasApiKey: !!process.env.GROK_API_KEY
    })
    
    // Warn if content is very large
    if (estimatedTokens > 120000) {
      console.warn(`Large document detected: ${estimatedTokens} estimated tokens. Will truncate to ~120k tokens to fit Grok limits.`)
    }

    // Check if Grok API key is available
    const hasGrokApiKey = !!process.env.GROK_API_KEY
    
    if (!hasGrokApiKey) {
      console.log('Grok API key not available, using local generation')
      console.log('Context:', { 
        textLength: context?.text?.length || 0,
        factsCount: context?.facts?.length || 0,
        stepsCount: context?.steps?.length || 0,
        definitionsCount: context?.definitions?.length || 0
      })
      const localQuestions = generateLocalQuestions(params, context)
      console.log(`Generated ${localQuestions.length} local questions`)
      
      if (localQuestions.length === 0) {
        console.warn('Local generation returned 0 questions, creating fallback questions')
        // Ensure we always return at least some questions
        const count = params?.count || 5
        const locale = params?.locale || 'en'
        const type = params?.type || 'mcq'
        const fallbackQuestions: GeneratedQuestion[] = []
        for (let i = 0; i < count; i++) {
          fallbackQuestions.push({
            id: `fallback_q_${Date.now()}_${i}`,
            type: type === 'mcq' ? 'mcq' : type === 'tf' ? 'tf' : 'complete',
            prompt: locale === 'ru'
              ? `Вопрос ${i + 1}: Пожалуйста, отредактируйте этот вопрос на основе содержимого документа.`
              : `Question ${i + 1}: Please edit this question based on the document content.`,
            choices: type === 'mcq' 
              ? (locale === 'ru' 
                  ? ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D']
                  : ['Option A', 'Option B', 'Option C', 'Option D'])
              : type === 'tf' 
                ? ['True', 'False']
                : [],
            correct_answer: type === 'mcq' ? '0' : type === 'tf' ? 'true' : 'answer',
            explanation: locale === 'ru'
              ? `Этот вопрос был создан автоматически. Пожалуйста, отредактируйте его на основе содержимого документа.`
              : `This question was automatically generated. Please edit it based on the document content.`
          })
        }
        return NextResponse.json({
          success: true,
          data: {
            questions: fallbackQuestions,
            totalGenerated: fallbackQuestions.length
          },
          provider: "local",
          warning: "Generated fallback questions - please edit based on document content"
        })
      }
      
      return NextResponse.json({
        success: true,
        data: {
          questions: localQuestions,
          totalGenerated: localQuestions.length
        },
        provider: "local"
      })
    }

    // Generate questions using Grok API
    // Try different model names: grok-4 (latest, 256k tokens), grok-2 (older, 131k tokens)
    // Note: grok-beta was deprecated on 2025-09-15
    const models = ['grok-4', 'grok-2']
    let grokResponse: Response | null = null
    let lastError: string | null = null
    let lastStatus: number | null = null
    const errorsByModel: Record<string, string> = {}
    
    for (const model of models) {
      try {
        const startTime = Date.now()
        console.log(`Attempting Grok API call with model: ${model}`)
        
        // Create AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
        
        try {
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
            - Language: ${params?.locale || 'English'}
            
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
                  content: `Generate questions based on this content:\n\n${truncateContentForGrok(context, 120000)}`
                }
              ],
              temperature: 0.7,
              max_tokens: 2000
            }),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Request timeout - Grok API took too long to respond')
          }
          throw fetchError
        }
        
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
          
          // Check if it's a token limit error - if so, try with smaller content
          if (grokResponse.status === 400 && (
            errorText.includes('maximum prompt length') || 
            errorText.includes('maximum context length') ||
            errorText.includes('token limit')
          )) {
            console.warn(`Token limit error with ${model}, trying with smaller content`)
            // Try again with much smaller content (50k tokens)
            try {
              const smallerContent = truncateContentForGrok(context, 50000)
              const retryResponse = await fetch('https://api.x.ai/v1/chat/completions', {
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
            - Language: ${params?.locale || 'English'}
            
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
                      content: `Generate questions based on this content (truncated due to size limits):\n\n${smallerContent}`
                    }
                  ],
                  temperature: 0.7,
                  max_tokens: 2000
                }),
                signal: controller.signal
              })
              
              if (retryResponse.ok) {
                console.log(`Grok API retry success with ${model} using smaller content`)
                grokResponse = retryResponse
                break
              }
            } catch (retryError) {
              console.error(`Retry with smaller content also failed for ${model}:`, retryError)
            }
          }
          
          // Check if it's an API key error
          if (grokResponse.status === 400 && errorText.includes('Incorrect API key')) {
            errorMessage = `Invalid API key. Please update GROK_API_KEY in Vercel environment variables. ${errorText.substring(0, 200)}`
          }
          
          lastError = errorMessage
          errorsByModel[model] = errorMessage
          console.error(`Grok API failed with model ${model} (${duration}ms):`, errorMessage)
          
          // If we didn't successfully retry, set grokResponse to null to try next model
          if (!grokResponse?.ok) {
            grokResponse = null
          }
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
      
      // Fallback to local generation when Grok fails
      console.log('Grok API failed, falling back to local generation')
      const localQuestions = generateLocalQuestions(params, context)
      return NextResponse.json({
        success: true,
        data: {
          questions: localQuestions,
          totalGenerated: localQuestions.length
        },
        provider: "local",
        warning: "Grok API unavailable, using local generation",
        grokError: errorBody
      })
    }

    const grokData = await grokResponse.json()
    const content = grokData.choices?.[0]?.message?.content

    if (!content) {
      console.error('Grok API response:', JSON.stringify(grokData, null, 2))
      // Fallback to local generation
      console.log('Grok returned no content, falling back to local generation')
      const localQuestions = generateLocalQuestions(params, context)
      return NextResponse.json({
        success: true,
        data: {
          questions: localQuestions,
          totalGenerated: localQuestions.length
        },
        provider: "local",
        warning: "Grok API returned no content, using local generation"
      })
    }

    // Parse the JSON response from Grok
    let generatedQuestions
    try {
      generatedQuestions = JSON.parse(content)
      if (!Array.isArray(generatedQuestions)) {
        console.error('Grok API did not return an array:', generatedQuestions)
        // Fallback to local generation
        console.log('Grok returned invalid format, falling back to local generation')
        const localQuestions = generateLocalQuestions(params, context)
        return NextResponse.json({
          success: true,
          data: {
            questions: localQuestions,
            totalGenerated: localQuestions.length
          },
          provider: "local",
          warning: "Grok API returned invalid format, using local generation"
        })
      }
    } catch (parseError) {
      console.error('Failed to parse Grok response:', content.substring(0, 500))
      console.error('Parse error:', parseError)
      // Fallback to local generation
      console.log('Grok response parse error, falling back to local generation')
      const localQuestions = generateLocalQuestions(params, context)
      return NextResponse.json({
        success: true,
        data: {
          questions: localQuestions,
          totalGenerated: localQuestions.length
        },
        provider: "local",
        warning: "Grok API returned invalid JSON, using local generation"
      })
    }

    // Add unique IDs to questions
    const questionsWithIds = generatedQuestions.map((q: Partial<GeneratedQuestion>, index: number) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${index}`
    }))

    // Check if content was truncated
    const wasTruncated = estimatedTokens > 120000
    const truncatedContent = truncateContentForGrok(context, 120000)
    const truncatedTokens = estimateTokens(truncatedContent)

    return NextResponse.json({
      success: true,
      data: {
        questions: questionsWithIds,
        totalGenerated: questionsWithIds.length
      },
      provider: "grok",
      ...(wasTruncated && {
        warning: `Document was truncated from ~${estimatedTokens.toLocaleString()} to ~${truncatedTokens.toLocaleString()} tokens to fit Grok API limits. Questions are based on the most important content (facts, steps, definitions, and beginning of document).`
      })
    })

  } catch (error) {
    console.error('Test generation API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to generate test questions',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}