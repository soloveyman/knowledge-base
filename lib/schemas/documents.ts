import { z } from 'zod'

/**
 * Zod schemas for Documents API routes
 */

const imageSchema = z.object({
  filename: z.string(),
  data: z.string().optional(), // base64 encoded (deprecated, kept for migration)
  url: z.string().url().optional(), // URL to image in DigitalOcean Spaces
  storageKey: z.string().optional(),
  type: z.string(), // MIME type
  position: z.number().int().optional(),
})

const sectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  level: z.number().int().min(1).max(6).optional(), // H1-H6
  order: z.number().int().optional(),
})

const tableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
})

const parsedContentSchema = z.object({
  sections: z.array(sectionSchema),
  tables: z.array(tableSchema).optional(),
  images: z.array(imageSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  originalFileName: z.string().optional().nullable(),
  fileType: z.enum(['docx', 'xlsx', 'pdf']).optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  fileSize: z.number().int().positive().optional().nullable(),
  parsedContent: parsedContentSchema,
  parsingLog: z.array(z.unknown()).optional().nullable(),
})

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['uploaded', 'parsing', 'parsed', 'error']).optional(),
})

export const enhanceDocumentSchema = z.object({
  enhancementType: z.enum(['summarize', 'expand', 'clarify', 'translate']).optional(),
  targetLanguage: z.string().length(2).optional(), // ISO 639-1 language code
  preserveFormatting: z.boolean().optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type EnhanceDocumentInput = z.infer<typeof enhanceDocumentSchema>
export type ParsedContent = z.infer<typeof parsedContentSchema>

