import { pgTable, text, timestamp, uuid, integer, decimal, boolean, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===== AUTHENTICATION TABLES (Auth.js) =====
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: timestamp('email_verified'),
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

// ===== BUSINESS MANAGEMENT =====
export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'restaurant', 'hotel', 'catering'
  description: text('description'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  country: text('country'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  logo: text('logo'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  isActive: boolean('is_active').default(true),
  settings: json('settings'), // Store business-specific settings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const businessUsers = pgTable('business_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner', 'manager', 'staff', 'waiter', 'chef'
  permissions: json('permissions'), // Store role-specific permissions
  isActive: boolean('is_active').default(true),
  joinedAt: timestamp('joined_at').defaultNow(),
});

// ===== RESTAURANT MANAGEMENT =====
export const menuCategories = pgTable('menu_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => menuCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  sku: text('sku'),
  image: text('image'),
  allergens: json('allergens'), // Array of allergen strings
  dietaryInfo: json('dietary_info'), // vegetarian, vegan, gluten-free, etc.
  preparationTime: integer('preparation_time'), // in minutes
  isAvailable: boolean('is_available').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  capacity: integer('capacity').notNull(),
  location: text('location'), // 'indoor', 'outdoor', 'bar', 'private'
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== ORDERS & SALES =====
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').references(() => tables.id),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  tipAmount: decimal('tip_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('pending'), // pending, confirmed, preparing, ready, completed, cancelled
  orderType: text('order_type').notNull().default('dine_in'), // dine_in, takeout, delivery
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  specialInstructions: text('special_instructions'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===== HOTEL MANAGEMENT =====
export const roomTypes = pgTable('room_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  maxOccupancy: integer('max_occupancy').notNull(),
  amenities: json('amenities'), // Array of amenity strings
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  number: text('number').notNull(),
  floor: integer('floor'),
  isAvailable: boolean('is_available').default(true),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  adults: integer('adults').notNull().default(1),
  children: integer('children').notNull().default(0),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('confirmed'), // confirmed, checked_in, checked_out, cancelled
  specialRequests: text('special_requests'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== CATERING & EVENTS =====
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date').notNull(),
  eventTime: text('event_time'),
  duration: integer('duration'), // in hours
  guestCount: integer('guest_count').notNull(),
  venue: text('venue'),
  address: text('address'),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactEmail: text('contact_email'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'), // pending, confirmed, in_progress, completed, cancelled
  specialRequirements: text('special_requirements'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  businessUsers: many(businessUsers),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerId],
    references: [users.id],
  }),
  businessUsers: many(businessUsers),
  menuCategories: many(menuCategories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
  roomTypes: many(roomTypes),
  rooms: many(rooms),
  bookings: many(bookings),
  events: many(events),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  business: one(businesses, {
    fields: [orders.businessId],
    references: [businesses.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));
