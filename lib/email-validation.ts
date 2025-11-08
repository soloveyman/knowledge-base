import { db, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { isDisposableEmail } from '@/lib/disposable-email'

/**
 * Normalize email address (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Check if an email exists globally in the database
 * @param email - Email address to check
 * @returns true if email exists, false otherwise
 */
export async function emailExists(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)
  
  return existing.length > 0
}

/**
 * Check if an email exists within a specific tenant
 * @param email - Email address to check
 * @param tenantId - Business/tenant ID to check within
 * @returns true if email exists in tenant, false otherwise
 */
export async function emailExistsInTenant(email: string, tenantId: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email)
  const existing = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, normalizedEmail),
        eq(users.businessId, tenantId)
      )
    )
    .limit(1)
  
  return existing.length > 0
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if valid format, false otherwise
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validate email is not disposable
 * @param email - Email address to validate
 * @returns true if not disposable, false otherwise
 */
export function isNotDisposableEmail(email: string): boolean {
  return !isDisposableEmail(email)
}

