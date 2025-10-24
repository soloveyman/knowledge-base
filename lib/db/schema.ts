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
export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content'), // Markdown content
  version: integer('version').default(1),
  status: text('status').notNull().default('draft'), // 'draft', 'published', 'archived'
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const moduleVersions = pgTable('module_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content'),
  status: text('status').notNull().default('draft'),
  changeLog: text('change_log'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id),
  parentId: uuid('parent_id').references(() => sections.id), // For nested sections
  title: text('title').notNull(),
  content: text('content'),
  order: integer('order').default(0),
  level: integer('level').default(1), // H1=1, H2=2, H3=3
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => modules.id),
  title: text('title').notNull(),
  originalFileName: text('original_file_name'),
  fileType: text('file_type'), // 'docx', 'xlsx', 'pdf'
  fileUrl: text('file_url'), // URL to stored file
  fileSize: integer('file_size'), // in bytes
  parsedContent: json('parsed_content'), // Structured content from parser
  parsingLog: json('parsing_log'), // Parser warnings and errors
  status: text('status').notNull().default('uploaded'), // 'uploaded', 'parsing', 'parsed', 'error'
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => modules.id),
  sectionId: uuid('section_id').references(() => sections.id),
  title: text('title').notNull(),
  content: text('content').notNull(), // Question text
  type: text('type').notNull().default('multiple_choice'), // 'multiple_choice', 'true_false', 'text'
  options: json('options'), // Array of answer options
  correctAnswer: text('correct_answer'), // Index or value of correct answer
  explanation: text('explanation'),
  difficulty: text('difficulty').default('medium'), // 'easy', 'medium', 'hard'
  tags: json('tags'), // Array of tags
  confidence: integer('confidence'), // AI confidence score 0-100
  requiresReview: boolean('requires_review').default(false),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => modules.id),
  title: text('title').notNull(),
  description: text('description'),
  questionIds: json('question_ids'), // Array of question IDs
  passingScore: integer('passing_score').default(70), // Percentage
  timeLimit: integer('time_limit'), // in minutes, null = no limit
  maxAttempts: integer('max_attempts').default(1),
  shuffleQuestions: boolean('shuffle_questions').default(false),
  showCorrectAnswers: boolean('show_correct_answers').default(true),
  status: text('status').notNull().default('draft'), // 'draft', 'published', 'archived'
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userGroups = pgTable('user_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userGroupMembers = pgTable('user_group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => userGroups.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  joinedAt: timestamp('joined_at').defaultNow(),
});

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => modules.id),
  testId: uuid('test_id').references(() => tests.id),
  assignedTo: uuid('assigned_to').references(() => users.id), // null for group assignments
  groupId: uuid('group_id').references(() => userGroups.id), // null for individual assignments
  assignedBy: uuid('assigned_by').notNull().references(() => users.id),
  dueDate: timestamp('due_date'),
  status: text('status').notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'overdue'
  allowRetake: boolean('allow_retake').default(false),
  maxAttempts: integer('max_attempts').default(1),
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
  status: text('status').notNull().default('in_progress'), // 'in_progress', 'completed', 'abandoned'
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const progress = pgTable('progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  moduleId: uuid('module_id').references(() => modules.id),
  testId: uuid('test_id').references(() => tests.id),
  assignmentId: uuid('assignment_id').references(() => assignments.id),
  status: text('status').notNull(), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer('progress_percentage').default(0),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== SUBSCRIPTION MANAGEMENT =====
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // 'free', 'pro', 'business'
  displayName: text('display_name').notNull(),
  description: text('description'),
  price: integer('price'), // in cents
  currency: text('currency').default('USD'),
  interval: text('interval').default('month'), // 'month', 'year'
  maxUsers: integer('max_users'),
  maxImportsPerMonth: integer('max_imports_per_month'),
  maxGenerationsPerMonth: integer('max_generations_per_month'),
  features: json('features'), // Array of feature strings
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  status: text('status').notNull().default('active'), // 'active', 'cancelled', 'expired'
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usage = pgTable('usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  month: text('month').notNull(), // YYYY-MM format
  importsCount: integer('imports_count').default(0),
  generationsCount: integer('generations_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  modules: many(modules),
  questions: many(questions),
  tests: many(tests),
  assignments: many(assignments),
  testAttempts: many(testAttempts),
  progress: many(progress),
  subscriptions: many(subscriptions),
  usage: many(usage),
  userGroupMembers: many(userGroupMembers),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [modules.createdBy],
    references: [users.id],
  }),
  versions: many(moduleVersions),
  sections: many(sections),
  documents: many(documents),
  questions: many(questions),
  tests: many(tests),
  assignments: many(assignments),
  progress: many(progress),
}));

export const moduleVersionsRelations = relations(moduleVersions, ({ one }) => ({
  module: one(modules, {
    fields: [moduleVersions.moduleId],
    references: [modules.id],
  }),
  createdBy: one(users, {
    fields: [moduleVersions.createdBy],
    references: [users.id],
  }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  module: one(modules, {
    fields: [sections.moduleId],
    references: [modules.id],
  }),
  parent: one(sections, {
    fields: [sections.parentId],
    references: [sections.id],
  }),
  children: many(sections),
  questions: many(questions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  module: one(modules, {
    fields: [documents.moduleId],
    references: [modules.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  module: one(modules, {
    fields: [questions.moduleId],
    references: [modules.id],
  }),
  section: one(sections, {
    fields: [questions.sectionId],
    references: [sections.id],
  }),
  createdBy: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  module: one(modules, {
    fields: [tests.moduleId],
    references: [modules.id],
  }),
  createdBy: one(users, {
    fields: [tests.createdBy],
    references: [users.id],
  }),
  assignments: many(assignments),
  testAttempts: many(testAttempts),
  progress: many(progress),
}));

export const userGroupsRelations = relations(userGroups, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [userGroups.createdBy],
    references: [users.id],
  }),
  members: many(userGroupMembers),
  assignments: many(assignments),
}));

export const userGroupMembersRelations = relations(userGroupMembers, ({ one }) => ({
  group: one(userGroups, {
    fields: [userGroupMembers.groupId],
    references: [userGroups.id],
  }),
  user: one(users, {
    fields: [userGroupMembers.userId],
    references: [users.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  module: one(modules, {
    fields: [assignments.moduleId],
    references: [modules.id],
  }),
  test: one(tests, {
    fields: [assignments.testId],
    references: [tests.id],
  }),
  assignedTo: one(users, {
    fields: [assignments.assignedTo],
    references: [users.id],
  }),
  group: one(userGroups, {
    fields: [assignments.groupId],
    references: [userGroups.id],
  }),
  assignedBy: one(users, {
    fields: [assignments.assignedBy],
    references: [users.id],
  }),
  progress: many(progress),
}));

export const testAttemptsRelations = relations(testAttempts, ({ one }) => ({
  test: one(tests, {
    fields: [testAttempts.testId],
    references: [tests.id],
  }),
  user: one(users, {
    fields: [testAttempts.userId],
    references: [users.id],
  }),
  assignment: one(assignments, {
    fields: [testAttempts.assignmentId],
    references: [assignments.id],
  }),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(users, {
    fields: [progress.userId],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [progress.moduleId],
    references: [modules.id],
  }),
  test: one(tests, {
    fields: [progress.testId],
    references: [tests.id],
  }),
  assignment: one(assignments, {
    fields: [progress.assignmentId],
    references: [assignments.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, {
    fields: [usage.userId],
    references: [users.id],
  }),
}));
