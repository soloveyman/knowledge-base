/**
 * Centralized logging utility
 * Filters out development-only logs in production
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  /**
   * Log informational messages (only in development)
   */
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args: unknown[]) => {
    console.error(...args)
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },

  /**
   * Log info messages (only in development)
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
}

