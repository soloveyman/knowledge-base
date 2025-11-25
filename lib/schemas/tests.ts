import { z } from 'zod'

/**
 * Zod schemas for Tests API routes
 */

export const questionTypeSchema = z.enum(['mcq', 'tf', 'complete', 'multiple_choice', 'true_false', 'text'])

export const questionSchema = z.object({
  id: z.string().optional(),
  prompt: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  type: questionTypeSchema.optional(),
  choices: z.array(z.string()).optional(),
  correct_answer: z.string().optional(),
  correctAnswer: z.string().optional(), // Support both snake_case and camelCase
  explanation: z.string().optional(),
})

export const createTestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000).optional().nullable(),
  moduleId: z.string().uuid().optional().nullable(),
  questionIds: z.array(z.string().uuid()).optional(),
  questions: z.array(questionSchema).optional(),
  type: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().nullable(),
  locale: z.string().length(2).optional().nullable(), // ISO 639-1 language code
  passingScore: z.number().int().min(0).max(100).optional(),
  timeLimit: z.number().int().positive().optional().nullable(), // in minutes
  maxAttempts: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).refine(
  (data) => data.questionIds || (data.questions && data.questions.length > 0),
  {
    message: 'Either questionIds or questions array must be provided',
    path: ['questionIds'],
  }
)

export const updateTestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  questionIds: z.array(z.string().uuid()).optional(),
  questions: z.array(questionSchema).optional(),
  type: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().nullable(),
  locale: z.string().length(2).optional().nullable(),
  passingScore: z.number().int().min(0).max(100).optional(),
  timeLimit: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export type CreateTestInput = z.infer<typeof createTestSchema>
export type UpdateTestInput = z.infer<typeof updateTestSchema>
export type QuestionInput = z.infer<typeof questionSchema>

