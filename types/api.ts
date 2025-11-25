/**
 * Shared API response types
 * Use Drizzle inferred types where possible
 */

import type { InferSelectModel } from 'drizzle-orm'
import type { tests, users, documents } from '@/lib/db/schema'

// Database entity types (inferred from schema)
export type TestEntity = InferSelectModel<typeof tests>
export type UserEntity = InferSelectModel<typeof users>
export type DocumentEntity = InferSelectModel<typeof documents>

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface TestsResponse {
  tests: TestEntity[]
}

export interface UsersResponse {
  users: UserEntity[]
}

export interface DocumentsResponse {
  documents: DocumentEntity[]
}

// Transformed types for client components
export interface SavedTest {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  questions: Array<{
    id: string
    type: string
    prompt: string
    choices?: string[]
    correct_answer?: string
    explanation?: string
  }>
  sourceDocument: string
  createdAt: string
  createdBy: string
}

export interface UserDisplay {
  id: string
  name: string
  email: string
  role: string
  job: string
  department?: string // Optional since it may not exist in schema
}

export interface DocumentDisplay {
  id: string
  originalFileName?: string
  title: string
  fileType?: string
  createdAt: string
  fileSize?: number
  status?: string
}

