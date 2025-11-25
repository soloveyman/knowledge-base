import { z } from 'zod'

/**
 * Zod schemas for Users API routes
 */

export const userRoleSchema = z.enum(['super-admin', 'owner', 'manager', 'employee'])

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleSchema,
  job: z.string().max(100).optional().nullable(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  job: z.string().max(100).optional().nullable(),
  password: z.string().min(8).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserRole = z.infer<typeof userRoleSchema>

