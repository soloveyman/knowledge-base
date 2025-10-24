import { pgTable, text, timestamp, uuid, integer, boolean, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===== AUTHENTICATION TABLES (Auth.js) =====
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: timestamp('email_verified'),
  role: text('role').notNull().$type<'owner' | 'manager' | 'employee'>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: text('session_token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires').notNull(),
});

// ===== KNOWLEDGE BASE MANAGEMENT =====
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content'), // Extracted text content
  originalFileName: text('original_file_name'),
  fileType: text('file_type'), // 'docx', 'xlsx', 'pdf'
  fileUrl: text('file_url'), // URL to stored file
  fileSize: integer('file_size'), // in bytes
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id),
  title: text('title').notNull(),
  description: text('description'),
  questions: json('questions'), // Array of question objects
  passingScore: integer('passing_score').default(70), // Percentage
  timeLimit: integer('time_limit'), // in minutes, null = no limit
  maxAttempts: integer('max_attempts').default(3),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').references(() => tests.id),
  documentId: uuid('document_id').references(() => documents.id),
  assignedTo: uuid('assigned_to').notNull().references(() => users.id),
  assignedBy: uuid('assigned_by').notNull().references(() => users.id),
  dueDate: timestamp('due_date'),
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, overdue
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const testAttempts = pgTable('test_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').notNull().references(() => tests.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  assignmentId: uuid('assignment_id').references(() => assignments.id),
  answers: json('answers'), // User's answers
  score: integer('score'), // Percentage
  timeSpent: integer('time_spent'), // in seconds
  status: text('status').notNull().default('in_progress'), // in_progress, completed, abandoned
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const progress = pgTable('progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  documentId: uuid('document_id').references(() => documents.id),
  testId: uuid('test_id').references(() => tests.id),
  status: text('status').notNull(), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer('progress_percentage').default(0),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  documents: many(documents),
  tests: many(tests),
  assignments: many(assignments),
  testAttempts: many(testAttempts),
  progress: many(progress),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  tests: many(tests),
  assignments: many(assignments),
  progress: many(progress),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  document: one(documents, {
    fields: [tests.documentId],
    references: [documents.id],
  }),
  createdBy: one(users, {
    fields: [tests.createdBy],
    references: [users.id],
  }),
  assignments: many(assignments),
  testAttempts: many(testAttempts),
  progress: many(progress),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  test: one(tests, {
    fields: [assignments.testId],
    references: [tests.id],
  }),
  document: one(documents, {
    fields: [assignments.documentId],
    references: [documents.id],
  }),
  assignedTo: one(users, {
    fields: [assignments.assignedTo],
    references: [users.id],
  }),
  assignedBy: one(users, {
    fields: [assignments.assignedBy],
    references: [users.id],
  }),
}));
