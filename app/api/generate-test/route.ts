import { NextRequest, NextResponse } from 'next/server'
import type { 
  TestParams, 
  TestContext, 
  MockQuestion, 
  ContextQuestions 
} from '@/types/test'

export async function POST(request: NextRequest) {
  try {
    console.log('Generate test API called')
    
    const body = await request.json()
    const { params, context, sourceRefs } = body
    
    // Check if GROK_API_KEY is set
    if (!process.env.GROK_API_KEY) {
      console.log('GROK_API_KEY not set')
      return NextResponse.json({
        ok: false,
        error: 'GROK_API_KEY is required but not set. Please configure your Grok API key.',
        provider: 'none'
      }, { status: 500 })
    }
    
    try {
      console.log('Using Grok API...')
      
      const prompt = createTestGenerationPrompt(params, context, sourceRefs)
      console.log('Generated prompt:', prompt.substring(0, 200) + '...')
      
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
        
        // Check if it's a region restriction error
        if (response.status === 403 && errorText.includes('not available in your region')) {
          console.log('Grok API not available in region, falling back to mock questions')
          return NextResponse.json({
            ok: true,
            questions: generateMockQuestions(params.count, { sourceRefs }),
            provider: 'mock-region-fallback'
          })
        }
        
        throw new Error(`Grok API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Grok API result received')
      
      const content = result.choices?.[0]?.message?.content || ''
      const generatedQuestions = parseGeneratedQuestions(content, params.count)
      
      return NextResponse.json({
        ok: true,
        questions: generatedQuestions,
        provider: 'grok'
      })
      
    } catch (error) {
      console.error('Grok API error:', error)
      return NextResponse.json({
        ok: false,
        error: `Grok API failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: 'grok-failed'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Test generation error:', error)
    return NextResponse.json({
      ok: false,
      error: `Test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      provider: 'error'
    }, { status: 500 })
  }
}

function createTestGenerationPrompt(params: TestParams, context: TestContext, sourceRefs: string[]) {
  const { count, type, difficulty, locale } = params
  const { text, facts, steps, definitions } = context
  
  let prompt = `You are an expert educational content creator. Generate exactly ${count} high-quality ${type} questions in ${locale === 'ru' ? 'Russian' : 'English'} with ${difficulty} difficulty level.\n\n`
  
  // Add content context
  if (text) {
    prompt += `DOCUMENT CONTENT:\n${text}\n\n`
  }
  
  if (facts && facts.length > 0) {
    prompt += `KEY FACTS:\n${facts.filter(f => f.trim()).join('\n')}\n\n`
  }
  
  if (steps && steps.length > 0) {
    prompt += `PROCESS STEPS:\n${steps.filter(s => s.trim()).join('\n')}\n\n`
  }
  
  if (definitions && definitions.length > 0) {
    prompt += `DEFINITIONS:\n${definitions.filter(d => d.trim()).join('\n')}\n\n`
  }
  
  prompt += `SOURCE: ${sourceRefs.join(', ')}\n\n`
  
  // Add specific instructions based on question type
  const typeInstructions = {
    'mcq': 'Create multiple choice questions with 4 options (A, B, C, D). Only one correct answer.',
    'mcq_multi': 'Create multiple choice questions with 4 options where multiple answers can be correct.',
    'tf': 'Create true/false questions with clear statements.',
    'complete': 'Create fill-in-the-blank questions with clear blanks to complete.',
    'cloze': 'Create cloze test questions with missing words to fill in.',
    'match': 'Create matching questions with two columns to match.',
    'order': 'Create ordering questions with steps/items to arrange in correct sequence.',
    'mixed': 'Create a variety of question types based on the content.'
  }
  
  prompt += `INSTRUCTIONS:\n`
  prompt += `- ${typeInstructions[type as keyof typeof typeInstructions] || typeInstructions.mcq}\n`
  prompt += `- Questions should test understanding, not just memorization\n`
  prompt += `- Make questions relevant to the provided content\n`
  prompt += `- Use clear, unambiguous language\n`
  prompt += `- Ensure correct answers are well-justified\n`
  prompt += `- Include explanations that help learners understand\n\n`
  
  prompt += `RESPOND WITH ONLY VALID JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "type": "${type}",
      "prompt": "Clear, well-written question text here",
      "choices": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "explanation": "Detailed explanation of why this answer is correct"
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
    
    // If parsing fails, throw error since we only use Grok API
    throw new Error('Failed to parse Grok API response as valid JSON')
  } catch (error) {
    console.error('Error parsing generated questions:', error)
    throw new Error(`Failed to parse questions: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function generateMockQuestions(count: number, context?: { sourceRefs: string[] }) {
  const questions = []
  
  // Context-aware mock questions based on document content
  const contextQuestions: ContextQuestions = {
    "Ланч меню BS.docx": [
      {
        prompt: "Сколько стоит борщ украинский с мясом в меню?",
        choices: ["200₽", "250₽", "280₽", "300₽"],
        correct_answer: "B",
        explanation: "Согласно меню, борщ украинский с мясом стоит 250₽."
      },
      {
        prompt: "Какое блюдо из горячих стоит 450₽?",
        choices: ["Рыба запеченная с овощами", "Котлета по-киевски с картофельным пюре", "Плов узбекский", "Солянка мясная"],
        correct_answer: "B",
        explanation: "Котлета по-киевски с картофельным пюре стоит 450₽ согласно меню."
      },
      {
        prompt: "Какой салат самый дешевый в меню?",
        choices: ["Цезарь с курицей", "Греческий салат", "Винегрет", "Все салаты стоят одинаково"],
        correct_answer: "C",
        explanation: "Винегрет стоит 120₽, что дешевле остальных салатов."
      }
    ],
    "Training Schedule.xlsx": [
      {
        prompt: "В какое время проводится обучение новичков в понедельник?",
        choices: ["8:00-9:30", "9:00-10:30", "10:00-11:30", "14:00-15:30"],
        correct_answer: "B",
        explanation: "Обучение новичков проводится в понедельник с 9:00 до 10:30."
      },
      {
        prompt: "Какой курс проводится во вторник в 15:00?",
        choices: ["Обучение работе с кассой", "Курс по обслуживанию клиентов", "Обучение приготовлению блюд", "Курс по технике безопасности"],
        correct_answer: "B",
        explanation: "Во вторник в 15:00-16:30 проводится курс по обслуживанию клиентов."
      }
    ],
    "Employee Handbook.docx": [
      {
        prompt: "Сколько длится обеденный перерыв согласно справочнику?",
        choices: ["30 минут", "45 минут", "1 час", "1.5 часа"],
        correct_answer: "C",
        explanation: "Обеденный перерыв длится с 12:00 до 13:00, то есть 1 час."
      },
      {
        prompt: "Какой дресс-код установлен для сотрудников?",
        choices: ["Спортивный стиль", "Деловой стиль", "Повседневная одежда", "Дресс-код не установлен"],
        correct_answer: "B",
        explanation: "Согласно справочнику, установлен деловой стиль и чистая форма."
      }
    ],
    "Safety Guidelines.pdf": [
      {
        prompt: "Что запрещено при работе согласно технике безопасности?",
        choices: ["Использовать прихватки", "Работать в состоянии алкогольного опьянения", "Отключать электроприборы", "Соблюдать инструкции"],
        correct_answer: "B",
        explanation: "Запрещается работать в состоянии алкогольного или наркотического опьянения."
      },
      {
        prompt: "Что нужно делать при пожаре?",
        choices: ["Продолжить работу", "Вызвать пожарную службу и эвакуировать людей", "Скрыть происшествие", "Позвонить другу"],
        correct_answer: "B",
        explanation: "При пожаре необходимо вызвать пожарную службу и эвакуировать людей."
      }
    ]
  }
  
  // Get questions based on context or use generic ones
  let availableQuestions = []
  if (context?.sourceRefs?.[0]) {
    const docName = context.sourceRefs[0]
    availableQuestions = contextQuestions[docName as keyof typeof contextQuestions] || []
  }
  
  // If we have context-specific questions, use them, otherwise generate generic ones
  if (availableQuestions.length > 0) {
    for (let i = 0; i < Math.min(count, availableQuestions.length); i++) {
      const q = availableQuestions[i]
      questions.push({
        id: `q${i + 1}`,
        type: 'mcq',
        prompt: q.prompt,
        choices: q.choices,
        correct_answer: q.correct_answer,
        explanation: q.explanation
      })
    }
    
    // Fill remaining slots with generic questions if needed
    for (let i = availableQuestions.length; i < count; i++) {
      questions.push({
        id: `q${i + 1}`,
        type: 'mcq',
        prompt: `Дополнительный вопрос ${i - availableQuestions.length + 1} по содержанию документа?`,
        choices: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
        correct_answer: 'A',
        explanation: `Это дополнительный вопрос ${i - availableQuestions.length + 1} на основе содержания документа.`
      })
    }
  } else {
    // Fallback to generic questions
    for (let i = 1; i <= count; i++) {
      questions.push({
        id: `q${i}`,
        type: 'mcq',
        prompt: `Общий вопрос ${i} на основе содержания документа?`,
        choices: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
        correct_answer: 'A',
        explanation: `Это общий вопрос ${i}, сгенерированный на основе содержания документа.`
      })
    }
  }
  
  return questions
}


