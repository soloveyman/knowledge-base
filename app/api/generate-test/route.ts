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
    
    // Map unsupported types to supported ones for Grok API
    // Grok API currently supports: mcq, mcq_multi, tf, complete
    // For other types, we'll generate mixed questions
    const grokSupportedTypes = ['mcq', 'mcq_multi', 'tf', 'complete'] as const
    const effectiveType = grokSupportedTypes.includes(params.type as any) 
      ? params.type 
      : 'mixed' // For cloze, match, order - generate mixed
    
    const grokParams = {
      ...params,
      type: effectiveType as 'mcq' | 'mcq_multi' | 'tf' | 'complete'
    }
    
    console.log('Generate test request:', { 
      params, 
      effectiveType,
      contextTextLength: context?.text?.length || 0,
      hasApiKey: !!process.env.GROK_API_KEY,
      requestedType: params?.type,
      requestedDifficulty: params?.difficulty,
      requestedLocale: params?.locale
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
          correct_answer: "1",
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
          correct_answer: "3",
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
            content: `You are an expert assessment generator.  

Your task is to create high-quality exam questions strictly based on the provided content.

You MUST follow all rules below.  

Output MUST be a valid JSON array and nothing else. No Markdown.

=====================================================

LANGUAGE RULE

=====================================================

Generate ALL text strictly in this language:

→ ${grokParams?.locale === 'ru' ? 'Russian (Русский)' : 'English'}

Do NOT mix languages.

=====================================================

QUESTION TYPE RULE

=====================================================

Generate questions ONLY of this type:

→ "${grokParams?.type || 'mcq'}"

Do NOT mix types unless type="mixed".

Valid types:

mcq, mcq_multi, tf, complete, cloze, match, order, mixed

=====================================================

DIFFICULTY RULE

=====================================================

Difficulty: ${grokParams?.difficulty || 'medium'}

- easy → factual recall  

- medium → comprehension, meaning, relationships, implications  

- hard → analysis, evaluation, comparison  

Medium & hard MUST NOT be trivial.  

Each question must rely on real reasoning based on the text.

=====================================================

UNIQUENESS RULE

=====================================================

ALL questions must be:

- unique in idea  

- unique in phrasing  

- testing DIFFERENT aspects of the content  

- not duplicates or paraphrases of each other  

=====================================================

CRITICAL ANSWER VALIDATION RULE

=====================================================

Correct answer MUST BE EXACT and CONSISTENT:

mcq → one 1-based index ("1"–"4")  

mcq_multi → comma-separated indices ("1,3,4"), ≥2 correct  

tf → "true" or "false" (English) / "верно" or "неверно" (Russian)  

complete → exact text answer  

cloze → comma-separated answers  

match → order of correct pairings as indices ("3,1,4,2")  

order → correct sequence indices ("2,3,1,4")  

DO NOT guess.  

Correct answer MUST match both the choices AND the explanation.  

Explanation MUST reference the content.

=====================================================

STRICT OUTPUT FORMAT

=====================================================

[

  {

    "id": "string",

    "type": "mcq|mcq_multi|tf|complete|cloze|match|order",

    "prompt": "string",

    "choices": ["string", "string", "string", "string"],  // Only for mcq, mcq_multi, match, order

    "correct_answer": "string",

    "explanation": "string"

  }

]

Only JSON. No comments. No extra text.

=====================================================

FEW-SHOT EXAMPLES FOR ALL QUESTION TYPES

(Examples DO NOT reflect content; structure only.)

=====================================================

--------------------------

EXAMPLE: MCQ (Single Choice)

--------------------------

{

  "id": "ex-mcq-1",

  "type": "mcq",

  "prompt": "What is the main purpose of the process described in the text?",

  "choices": ["To store data", "To improve accuracy", "To remove duplicates", "To compress files"],

  "correct_answer": "2",

  "explanation": "The text directly states that improving accuracy is the primary goal."

}

--------------------------

EXAMPLE: MCQ_MULTI (Multiple Correct)

--------------------------

{

  "id": "ex-mcqmulti-1",

  "type": "mcq_multi",

  "prompt": "Which of the following factors contribute to the effectiveness of the method?",

  "choices": ["Consistency", "Noise reduction", "Random errors", "Clear structure"],

  "correct_answer": "1,2,4",

  "explanation": "The text explains that consistency, reduced noise, and structured data all improve effectiveness."

}

--------------------------

EXAMPLE: TRUE/FALSE (English)

--------------------------

{

  "id": "ex-tf-1",

  "type": "tf",

  "prompt": "The process described in the text is mandatory in all scenarios.",

  "correct_answer": "false",

  "explanation": "The text clarifies that the process is optional and used only under certain conditions."

}

--------------------------

EXAMPLE: TRUE/FALSE (Russian)

--------------------------

{

  "id": "ex-tf-2",

  "type": "tf",

  "prompt": "Процесс, описанный в тексте, является обязательным во всех сценариях.",

  "correct_answer": "неверно",

  "explanation": "Текст уточняет, что процесс является необязательным и используется только при определенных условиях."

}

--------------------------

EXAMPLE: COMPLETE (Fill-in-the-blank)

--------------------------

{

  "id": "ex-complete-1",

  "type": "complete",

  "prompt": "The primary metric used to evaluate the system is ________.",

  "correct_answer": "accuracy",

  "explanation": "The text states that accuracy is the main evaluation metric."

}

--------------------------

EXAMPLE: CLOZE (Multiple Blanks)

--------------------------

{

  "id": "ex-cloze-1",

  "type": "cloze",

  "prompt": "The system relies on ________ and ________ to produce reliable results.",

  "correct_answer": "consistency,validation",

  "explanation": "Both consistency and validation are described as essential factors."

}

--------------------------

EXAMPLE: MATCH (Pair Lists)

--------------------------

{

  "id": "ex-match-1",

  "type": "match",

  "prompt": "Match each component to its purpose.",

  "choices": ["Parser", "Validator", "Renderer", "Scheduler"],

  "correct_answer": "2,3,1,4",

  "explanation": "The mapping is provided directly in the text: Parser→3, Validator→1, Renderer→2, Scheduler→4."

}

--------------------------

EXAMPLE: ORDER (Sequence)

--------------------------

{

  "id": "ex-order-1",

  "type": "order",

  "prompt": "Arrange the steps of the workflow in the correct order.",

  "choices": ["Analyze Data", "Collect Input", "Generate Output", "Validate Results"],

  "correct_answer": "2,1,4,3",

  "explanation": "The text specifies the workflow: input → analysis → validation → output."

}

=====================================================

READY TO GENERATE

=====================================================

Now generate ${grokParams?.count || 5} questions strictly following all rules above, using the content below.`
          },
          {
            role: 'user',
            content: `Generate questions based on this content (images excluded):\n\n${cleanedContextText || 'No content provided'}`
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
    
    // Add unique IDs to questions and validate/convert correct answers
    const questionsWithIds = generatedQuestions.map((q: GeneratedQuestionItem, index: number) => {
      let correctAnswer = q.correct_answer
      const originalAnswer = correctAnswer
      
      // Validate and convert correct answer based on question type
      if (correctAnswer && q.choices && q.choices.length > 0) {
        // Handle multiple choice questions (mcq, mcq_multi)
        if ((q.type === 'mcq' || q.type === 'mcq_multi') && q.choices) {
          // If correct answer is a letter (A, B, C, D), convert to 1-based index
          if (/^[A-Z]$/i.test(correctAnswer)) {
            const letterIndex = correctAnswer.toUpperCase().charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
            const oneBasedIndex = letterIndex + 1 // A=1, B=2, C=3, D=4
            if (oneBasedIndex >= 1 && oneBasedIndex <= q.choices.length) {
              correctAnswer = String(oneBasedIndex)
              console.log(`Question ${index}: Converted letter "${originalAnswer}" to 1-based index ${correctAnswer}`)
            } else {
              console.warn(`Question ${index}: Invalid letter "${originalAnswer}" (out of range), keeping original`)
            }
          }
          // If correct answer is a number string (index), validate and convert if needed
          else if (/^\d+$/.test(correctAnswer)) {
            const numericAnswer = parseInt(correctAnswer, 10)
            // If it's a 0-based index (0-3), convert to 1-based (1-4)
            if (numericAnswer >= 0 && numericAnswer <= 3 && q.choices.length > numericAnswer) {
              correctAnswer = String(numericAnswer + 1)
              console.log(`Question ${index}: Converted 0-based index ${numericAnswer} to 1-based index ${correctAnswer}`)
            }
            // If it's already 1-based but out of range, validate
            else if (numericAnswer < 1 || numericAnswer > q.choices.length) {
              console.warn(`Question ${index}: Invalid index ${numericAnswer} (should be 1-${q.choices.length}), keeping original but may cause issues`)
            }
            // Otherwise keep as-is (already 1-based)
          }
          // If it's text, try to find it in choices
          else if (correctAnswer && typeof correctAnswer === 'string' && correctAnswer.trim()) {
            const trimmedAnswer = correctAnswer.trim()
            const choiceIndex = q.choices.findIndex(
              choice => choice.trim().toLowerCase() === trimmedAnswer.toLowerCase()
            )
            if (choiceIndex >= 0) {
              const oneBasedIndex = choiceIndex + 1 // Convert 0-based to 1-based
              correctAnswer = String(oneBasedIndex)
              console.log(`Question ${index}: Converted text answer "${originalAnswer}" to 1-based index ${correctAnswer}`)
            } else {
              console.warn(`Question ${index}: Could not find correct answer "${originalAnswer}" in choices. Choices: ${q.choices.join(', ')}`)
              // Try to match partial text
              const partialMatch = q.choices.findIndex(
                choice => {
                  const trimmedChoice = choice.trim().toLowerCase()
                  const trimmedAnswerLower = trimmedAnswer.toLowerCase()
                  return trimmedChoice.includes(trimmedAnswerLower) || trimmedAnswerLower.includes(trimmedChoice)
                }
              )
              if (partialMatch >= 0) {
                const oneBasedIndex = partialMatch + 1
                correctAnswer = String(oneBasedIndex)
                console.log(`Question ${index}: Found partial match for "${originalAnswer}" -> index ${correctAnswer}`)
              } else {
                console.warn(`Question ${index}: No match found for "${originalAnswer}", keeping original (may cause validation issues)`)
              }
            }
          }
        }
        // Handle match and order types - validate comma-separated indices
        else if ((q.type === 'match' || q.type === 'order') && correctAnswer) {
          const parts = correctAnswer.split(/[,;\s]+/).filter(p => p.length > 0)
          const validParts: string[] = []
          for (const part of parts) {
            if (/^\d+$/.test(part)) {
              const index = parseInt(part, 10)
              // Convert 0-based to 1-based if needed
              const finalIndex = (index >= 0 && index <= 3) ? index + 1 : index
              if (finalIndex >= 1 && finalIndex <= q.choices.length) {
                validParts.push(String(finalIndex))
              }
            } else if (/^[A-Z]$/i.test(part)) {
              // Convert letter to index
              const letterIndex = part.toUpperCase().charCodeAt(0) - 65
              const oneBasedIndex = letterIndex + 1
              if (oneBasedIndex >= 1 && oneBasedIndex <= q.choices.length) {
                validParts.push(String(oneBasedIndex))
              }
            }
          }
          if (validParts.length > 0) {
            correctAnswer = validParts.join(',')
            console.log(`Question ${index}: Validated match/order answer "${originalAnswer}" -> "${correctAnswer}"`)
          }
        }
      }
      
      // For true/false questions, normalize the answer
      if (q.type === 'tf' || q.type === 'true_false') {
        const normalized = correctAnswer?.trim().toLowerCase()
        // English variants
        if (normalized === 'true' || normalized === '1') {
          correctAnswer = 'true'
        } else if (normalized === 'false' || normalized === '0') {
          correctAnswer = 'false'
        }
        // Russian variants - convert to English for consistency
        else if (normalized === 'верно' || normalized === 'да' || normalized === 'истина' || normalized === 'правда') {
          correctAnswer = 'true'
        } else if (normalized === 'неверно' || normalized === 'нет' || normalized === 'ложь' || normalized === 'неправда') {
          correctAnswer = 'false'
        }
        if (originalAnswer !== correctAnswer) {
          console.log(`Question ${index}: Normalized true/false answer "${originalAnswer}" -> "${correctAnswer}"`)
        }
      }
      
      const questionWithId = {
        ...q,
        id: q.id || `q_${Date.now()}_${index}`,
        correct_answer: correctAnswer
      }
      
      // Log correct answer for debugging
      console.log(`Question ${index} from Grok:`, {
        type: questionWithId.type,
        original_answer: originalAnswer,
        final_correct_answer: questionWithId.correct_answer,
        choices: questionWithId.choices,
        explanation: questionWithId.explanation?.substring(0, 50) + '...'
      })
      
      return questionWithId
    })

    return NextResponse.json({
      success: true,
      data: {
        questions: questionsWithIds,
        totalGenerated: questionsWithIds.length,
        requestedType: params.type, // Return original requested type
        effectiveType: effectiveType // Return effective type used for generation
      },
      provider: "grok"
    })

  } catch (error) {
    return handleApiError(error, 'Failed to generate test questions', 500)
  }
}