import { z } from 'zod'

/**
 * Zod schemas for Generate Test API route
 */

export const testParamsSchema = z.object({
  count: z.number().int().min(1).max(50),
  type: z.enum(['mcq', 'mcq_multi', 'tf', 'complete', 'cloze', 'match', 'order', 'mixed']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  locale: z.string().length(2).optional(), // ISO 639-1 language code
})

export const contextSchema = z.object({
  text: z.string(),
  facts: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  definitions: z.array(z.string()).optional(),
})

export const generateTestSchema = z.object({
  params: testParamsSchema,
  context: contextSchema,
})

export type GenerateTestInput = z.infer<typeof generateTestSchema>
export type TestParams = z.infer<typeof testParamsSchema>
export type Context = z.infer<typeof contextSchema>

