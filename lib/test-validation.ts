import { db, tests, questions } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'

/**
 * Server-side validation of test answers
 * This function validates user answers against the correct answers stored in the database
 * and calculates the score server-side to prevent client-side manipulation
 */
export async function validateTestAnswers(
  testId: string,
  userAnswers: Record<string, unknown>
): Promise<{ 
  score: number
  correctAnswers: number
  totalQuestions: number
  passingScore: number
}> {
  // Load test from database
  const testResult = await db
    .select({
      id: tests.id,
      questionIds: tests.questionIds,
      passingScore: tests.passingScore,
    })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1)

  if (testResult.length === 0) {
    throw new Error(`Test ${testId} not found`)
  }

  const test = testResult[0]
  const passingScore = test.passingScore ?? 70

  // Load questions from database
  if (!test.questionIds || !Array.isArray(test.questionIds) || test.questionIds.length === 0) {
    return {
      score: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      passingScore,
    }
  }

  // Filter valid UUIDs
  const validQuestionIds = test.questionIds.filter((qId: string) => 
    typeof qId === 'string' && 
    qId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  )

  if (validQuestionIds.length === 0) {
    return {
      score: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      passingScore,
    }
  }

  // Load all questions
  const questionsArray = []
  for (const questionId of validQuestionIds) {
    const questionResult = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1)
    
    if (questionResult.length > 0) {
      questionsArray.push(questionResult[0])
    }
  }

  // Validate answers
  let correctAnswers = 0
  let totalQuestionsWithAnswers = 0

  // Helper function to normalize true/false values (English and Russian)
  const normalizeTrueFalse = (val: string): string | null => {
    const normalized = val.trim().toLowerCase()
    // English variants
    if (normalized === 'true' || normalized === '1') return 'true'
    if (normalized === 'false' || normalized === '0') return 'false'
    // Russian variants
    if (normalized === 'верно' || normalized === 'да' || normalized === 'истина' || normalized === 'правда') return 'true'
    if (normalized === 'неверно' || normalized === 'нет' || normalized === 'ложь' || normalized === 'неправда') return 'false'
    return null
  }

  // Helper function to normalize text
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
  }

  for (const question of questionsArray) {
    const userAnswer = userAnswers[question.id]

    // Skip if question has no correct answer defined
    if (!question.correctAnswer) {
      continue
    }

    totalQuestionsWithAnswers++

    // If user didn't answer, it's incorrect
    if (!userAnswer) {
      continue
    }

    let isCorrect = false
    const questionType = question.type || 'multiple_choice'

    // Handle text/complete/cloze questions
    if (questionType === 'complete' || questionType === 'text' || questionType === 'cloze') {
      const userAnswerStr = Array.isArray(userAnswer) 
        ? userAnswer.join(' ').trim() 
        : (userAnswer || '').toString().trim()
      const normalizedUserAnswer = normalizeText(userAnswerStr)
      const normalizedCorrectAnswer = normalizeText(question.correctAnswer || '')

      if (normalizedUserAnswer === normalizedCorrectAnswer) {
        isCorrect = true
        correctAnswers++
      }
    }
    // Handle multiple choice with multiple answers
    else if (questionType === 'mcq_multi') {
      const correctAnswerStr = question.correctAnswer.trim()
      const correctAnswerParts = correctAnswerStr.split(/[,;\s]+/).filter(p => p.length > 0)

      // Convert correct answers to letters (A, B, C, D)
      const correctAnswerLetters: string[] = []
      const questionOptions = (question.options as string[]) || []

      for (const part of correctAnswerParts) {
        let letter: string | null = null

        // If it's already a letter (A, B, C, D)
        if (/^[A-Z]$/i.test(part)) {
          letter = part.toUpperCase()
        }
        // If it's a numeric index (1, 2, 3, 4) - 1-based
        else if (/^\d+$/.test(part)) {
          const index = parseInt(part, 10)
          if (questionOptions.length > 0 && index >= 1 && index <= questionOptions.length) {
            const zeroBasedIndex = index - 1
            letter = String.fromCharCode(65 + zeroBasedIndex)
          }
        }
        // If it matches one of the choice texts
        else if (questionOptions.length > 0) {
          const choiceIndex = questionOptions.findIndex(
            choice => choice.trim().toLowerCase() === part.trim().toLowerCase()
          )
          if (choiceIndex >= 0) {
            letter = String.fromCharCode(65 + choiceIndex)
          }
        }

        if (letter) {
          correctAnswerLetters.push(letter)
        }
      }

      // Get user answers
      const userAnswersArray = Array.isArray(userAnswer)
        ? userAnswer.map(a => a.toString().toUpperCase())
        : (userAnswer ? [userAnswer.toString().toUpperCase()] : [])

      // Check if all correct answers are selected and no incorrect ones
      const correctAnswersSet = new Set(correctAnswerLetters)
      const userAnswersSet = new Set(userAnswersArray)

      const allCorrectSelected = correctAnswerLetters.every(letter => userAnswersSet.has(letter))
      const noIncorrectSelected = userAnswersArray.every(letter => correctAnswersSet.has(letter))
      const sameCount = correctAnswerLetters.length === userAnswersArray.length

      if (allCorrectSelected && noIncorrectSelected && sameCount) {
        isCorrect = true
        correctAnswers++
      }
    }
    // Handle matching questions (similar to mcq_multi but order matters)
    else if (questionType === 'match') {
      const correctAnswerStr = question.correctAnswer.trim()
      const correctAnswerParts = correctAnswerStr.split(/[,;\s]+/).filter(p => p.length > 0)

      // Convert correct answers to letters
      const correctAnswerLetters: string[] = []
      const questionOptions = (question.options as string[]) || []

      for (const part of correctAnswerParts) {
        let letter: string | null = null

        if (/^[A-Z]$/i.test(part)) {
          letter = part.toUpperCase()
        } else if (/^\d+$/.test(part)) {
          const index = parseInt(part, 10)
          if (questionOptions.length > 0 && index >= 1 && index <= questionOptions.length) {
            const zeroBasedIndex = index - 1
            letter = String.fromCharCode(65 + zeroBasedIndex)
          }
        } else if (questionOptions.length > 0) {
          const choiceIndex = questionOptions.findIndex(
            choice => choice.trim().toLowerCase() === part.trim().toLowerCase()
          )
          if (choiceIndex >= 0) {
            letter = String.fromCharCode(65 + choiceIndex)
          }
        }

        if (letter) {
          correctAnswerLetters.push(letter)
        }
      }

      // Get user answers
      const userAnswers = Array.isArray(userAnswer)
        ? userAnswer.map(a => a.toString().toUpperCase())
        : (userAnswer ? [userAnswer.toString().toUpperCase()] : [])

      // For matching, order matters - check if sequences match
      const correctSequence = correctAnswerLetters.join(',')
      const userSequence = userAnswers.join(',')

      if (correctSequence === userSequence && correctAnswerLetters.length === userAnswers.length) {
        isCorrect = true
        correctAnswers++
      }
    }
    // Handle ordering questions (order matters)
    else if (questionType === 'order') {
      const correctAnswerStr = question.correctAnswer.trim()
      const correctAnswerParts = correctAnswerStr.split(/[,;\s]+/).filter(p => p.length > 0)

      // Convert correct answers to letters
      const correctAnswerLetters: string[] = []
      const questionOptions = (question.options as string[]) || []

      for (const part of correctAnswerParts) {
        let letter: string | null = null

        if (/^[A-Z]$/i.test(part)) {
          letter = part.toUpperCase()
        } else if (/^\d+$/.test(part)) {
          const index = parseInt(part, 10)
          if (questionOptions.length > 0 && index >= 1 && index <= questionOptions.length) {
            const zeroBasedIndex = index - 1
            letter = String.fromCharCode(65 + zeroBasedIndex)
          }
        } else if (questionOptions.length > 0) {
          const choiceIndex = questionOptions.findIndex(
            choice => choice.trim().toLowerCase() === part.trim().toLowerCase()
          )
          if (choiceIndex >= 0) {
            letter = String.fromCharCode(65 + choiceIndex)
          }
        }

        if (letter) {
          correctAnswerLetters.push(letter)
        }
      }

      // Get user answers
      const userAnswers = Array.isArray(userAnswer)
        ? userAnswer.map(a => a.toString().toUpperCase())
        : (userAnswer ? [userAnswer.toString().toUpperCase()] : [])

      // For ordering, exact sequence match is required
      const correctSequence = correctAnswerLetters.join(',')
      const userSequence = userAnswers.join(',')

      if (correctSequence === userSequence && correctAnswerLetters.length === userAnswers.length) {
        isCorrect = true
        correctAnswers++
      }
    }
    // Handle single choice multiple choice and true/false
    else {
      // Normalize correct answer to letter format (A, B, C, D) or true/false
      let correctAnswerLetter: string | null = null
      const questionOptions = (question.options as string[]) || []

      // Handle true/false questions FIRST
      if (questionType === 'tf' || questionType === 'true_false') {
        const normalizedCorrect = normalizeTrueFalse(question.correctAnswer)
        if (normalizedCorrect) {
          correctAnswerLetter = normalizedCorrect
        }
      }
      // If correct_answer is already a letter (A, B, C, D)
      else if (/^[A-Z]$/.test(question.correctAnswer)) {
        correctAnswerLetter = question.correctAnswer.toUpperCase()
      }
      // If correct_answer is a numeric index (1, 2, 3, 4) - 1-based
      // Also handle legacy 0-based indices (0, 1, 2, 3) for backward compatibility
      else if (/^\d+$/.test(question.correctAnswer)) {
        const index = parseInt(question.correctAnswer, 10)
        if (questionOptions.length > 0) {
          let zeroBasedIndex: number
          // Handle 1-based indices (1, 2, 3, 4) - new format
          if (index >= 1 && index <= questionOptions.length) {
            zeroBasedIndex = index - 1
          }
          // Handle legacy 0-based indices (0, 1, 2, 3) - old format for backward compatibility
          else if (index === 0 && questionOptions.length > 0) {
            zeroBasedIndex = 0
          }
          else {
            zeroBasedIndex = -1 // Invalid
          }

          if (zeroBasedIndex >= 0 && zeroBasedIndex < questionOptions.length) {
            correctAnswerLetter = String.fromCharCode(65 + zeroBasedIndex)
          }
        }
      }
      // If correct_answer matches one of the choice texts, find its index
      else if (questionOptions.length > 0 && question.correctAnswer) {
        const correctAnswerText = question.correctAnswer
        const choiceIndex = questionOptions.findIndex(
          choice => choice.trim().toLowerCase() === correctAnswerText.trim().toLowerCase()
        )
        if (choiceIndex >= 0) {
          correctAnswerLetter = String.fromCharCode(65 + choiceIndex)
        }
      }

      // Compare normalized answers
      const userAnswerStr = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer

      // For true/false questions, normalize user answer too
      let normalizedUserAnswer = userAnswerStr?.toString() || ''
      if ((questionType === 'tf' || questionType === 'true_false') && userAnswerStr) {
        const normalized = normalizeTrueFalse(userAnswerStr.toString())
        if (normalized) {
          normalizedUserAnswer = normalized
        }
      }

      if (correctAnswerLetter && normalizedUserAnswer && normalizedUserAnswer.toLowerCase() === correctAnswerLetter.toLowerCase()) {
        isCorrect = true
        correctAnswers++
      }
    }
  }

  // Calculate percentage based ONLY on questions with correct answers defined
  const score = totalQuestionsWithAnswers > 0
    ? Math.round((correctAnswers / totalQuestionsWithAnswers) * 100)
    : 0

  return {
    score,
    correctAnswers,
    totalQuestions: totalQuestionsWithAnswers,
    passingScore,
  }
}

