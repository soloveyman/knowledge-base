import { db, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { normalizeEmail } from '@/lib/email-validation'

/**
 * Check if an email exists globally in the database
 * SERVER-ONLY: This function uses the database and should only be called from API routes
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
 * SERVER-ONLY: This function uses the database and should only be called from API routes
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

