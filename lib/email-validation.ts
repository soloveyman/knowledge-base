import { isDisposableEmail } from '@/lib/disposable-email'

/**
 * Normalize email address (lowercase, trim)
 * CLIENT-SAFE: This function is pure and can be used on the client
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
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

