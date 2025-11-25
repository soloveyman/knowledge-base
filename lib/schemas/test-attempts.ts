import { z } from 'zod'

/**
 * Zod schemas for Test Attempts API routes
 */

export const startTestAttemptSchema = z.object({
  testId: z.string().uuid('testId must be a valid UUID'),
  assignmentId: z.string().uuid('assignmentId must be a valid UUID').optional().nullable(),
})

export const submitTestAttemptSchema = z.object({
  testId: z.string().uuid('testId must be a valid UUID'),
  assignmentId: z.string().uuid('assignmentId must be a valid UUID').optional().nullable(),
  answers: z.record(z.string(), z.unknown()), // questionId -> answer
  timeSpent: z.number().int().min(0).optional(), // in seconds (can be 0)
  score: z.number().int().min(0).max(100).optional().nullable(), // Optional score if calculated client-side
})

export type StartTestAttemptInput = z.infer<typeof startTestAttemptSchema>
export type SubmitTestAttemptInput = z.infer<typeof submitTestAttemptSchema>

