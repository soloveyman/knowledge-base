// Shared types for test generation functionality

export interface Document {
  id: number
  name: string
  type: string
  uploadedAt: string
}

export interface TestConfig {
  count: number
  type: string
  difficulty: string
  locale: string
}

export interface Context {
  text: string
  facts: string[]
  steps: string[]
  definitions: string[]
}

export interface GeneratedQuestion {
  id: string
  type: string
  prompt: string
  choices?: string[]
  correct_answer?: string
  explanation?: string
}

export interface QuestionType {
  value: string
  label: string
}

export interface DifficultyLevel {
  value: string
  label: string
}

export interface Locale {
  value: string
  label: string
}

export interface TestParams {
  count: number
  type: string
  difficulty: string
  locale: string
}

export interface TestContext {
  text: string
  facts: string[]
  steps: string[]
  definitions: string[]
}

export interface MockQuestion {
  prompt: string
  choices: string[]
  correct_answer: string
  explanation: string
}

export interface ContextQuestions {
  [key: string]: MockQuestion[]
}

export interface TestGenerationRequest {
  params: TestParams
  context: TestContext
  sourceRefs: string[]
}

export interface TestGenerationResponse {
  ok: boolean
  questions?: GeneratedQuestion[]
  provider?: string
  error?: string
}
