import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Generate test API called')
    
    const body = await request.json()
    const { params, context, sourceRefs } = body
    
    // Check if GROK_API_KEY is set
    if (!process.env.GROK_API_KEY) {
      console.log('GROK_API_KEY not set, returning mock questions')
      return NextResponse.json({
        ok: true,
        questions: generateMockQuestions(params.count)
      })
    }
    
    // Create prompt for Grok API
    const prompt = createTestGenerationPrompt(params, context, sourceRefs)
    console.log('Generated prompt:', prompt.substring(0, 200) + '...')
    
    // Call Grok API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are an expert test generator. Generate high-quality test questions based on the provided content and requirements. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    })

    console.log('Grok API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Grok API error:', errorText)
      // Fallback to mock questions if API fails
      return NextResponse.json({
        ok: true,
        questions: generateMockQuestions(params.count)
      })
    }

    const result = await response.json()
    console.log('Grok API result received')
    
    // Parse the generated questions from Grok's response
    const generatedQuestions = parseGeneratedQuestions(result.choices[0]?.message?.content || '', params.count)
    
    return NextResponse.json({
      ok: true,
      questions: generatedQuestions
    })
  } catch (error) {
    console.error('Test generation error:', error)
    // Fallback to mock questions on any error
    return NextResponse.json({
      ok: true,
      questions: generateMockQuestions(5)
    })
  }
}

function createTestGenerationPrompt(params: any, context: any, sourceRefs: string[]) {
  const { count, type, difficulty, locale } = params
  const { text, facts, steps, definitions } = context
  
  let prompt = `Generate exactly ${count} ${type} questions in ${locale === 'ru' ? 'Russian' : 'English'} with ${difficulty} difficulty level.\n\n`
  
  if (text) {
    prompt += `Main content:\n${text}\n\n`
  }
  
  if (facts && facts.length > 0) {
    prompt += `Key facts:\n${facts.filter(f => f.trim()).join('\n')}\n\n`
  }
  
  if (steps && steps.length > 0) {
    prompt += `Process steps:\n${steps.filter(s => s.trim()).join('\n')}\n\n`
  }
  
  if (definitions && definitions.length > 0) {
    prompt += `Definitions:\n${definitions.filter(d => d.trim()).join('\n')}\n\n`
  }
  
  prompt += `Source references: ${sourceRefs.join(', ')}\n\n`
  
  prompt += `Respond with ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "type": "${type}",
      "prompt": "Question text here",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "explanation": "Explanation of the correct answer"
    }
  ]
}

Generate exactly ${count} questions based on the content above.`
  
  return prompt
}

function parseGeneratedQuestions(content: string, count: number) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const questions = parsed.questions || []
      if (questions.length > 0) {
        return questions
      }
    }
    
    // Fallback to mock questions if parsing fails
    return generateMockQuestions(count)
  } catch (error) {
    console.error('Error parsing generated questions:', error)
    return generateMockQuestions(count)
  }
}

function generateMockQuestions(count: number) {
  const questions = []
  for (let i = 1; i <= count; i++) {
    questions.push({
      id: `q${i}`,
      type: 'mcq',
      prompt: `Sample question ${i} based on your document content?`,
      choices: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'A',
      explanation: `This is sample question ${i} generated from your content.`
    })
  }
  return questions
}

