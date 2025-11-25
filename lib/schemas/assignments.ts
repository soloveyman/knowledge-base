import { z } from 'zod'

/**
 * Zod schemas for Assignments API routes
 */

export const createAssignmentSchema = z.object({
  moduleId: z.string().uuid('moduleId must be a valid UUID'), // Frontend sends documentId as moduleId
  testId: z.string().uuid('testId must be a valid UUID').optional().nullable(),
  assignedTo: z.union([
    z.string().uuid('assignedTo must be a valid UUID'),
    z.array(z.string().uuid('Each user ID must be a valid UUID')),
  ]),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional().nullable(), // ISO 8601 datetime string
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional(),
  allowRetake: z.boolean().optional(),
  maxAttempts: z.number().int().positive().optional(),
})

export const updateAssignmentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional(),
  allowRetake: z.boolean().optional(),
  maxAttempts: z.number().int().positive().optional(),
})

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>

