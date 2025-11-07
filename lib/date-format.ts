/**
 * Date formatting utilities using react-intl
 * Provides consistent, locale-aware date formatting across the application
 * 
 * Note: For React components, use the useDateFormat() hook to get formatting functions
 * that automatically use the current locale from IntlProvider.
 */

import { createIntl } from 'react-intl'

type DateInput = string | number | Date

interface FormatDateOptions {
  locale?: string
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
  day?: 'numeric' | '2-digit'
  hour?: 'numeric' | '2-digit'
  minute?: 'numeric' | '2-digit'
  second?: 'numeric' | '2-digit'
  hour12?: boolean
}

/**
 * Formats a date using react-intl
 */
export function formatDate(
  date: DateInput,
  options: FormatDateOptions = {}
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date

  if (isNaN(dateObj.getTime())) {
    return ''
  }

  const {
    locale = 'en-US',
    dateStyle,
    timeStyle,
    ...otherOptions
  } = options

  const formatOptions: Intl.DateTimeFormatOptions = {}

  if (dateStyle) {
    formatOptions.dateStyle = dateStyle
  } else if (timeStyle) {
    formatOptions.timeStyle = timeStyle
  } else {
    // Merge provided options
    Object.assign(formatOptions, otherOptions)
  }

  // Use react-intl's createIntl for formatting
  const intl = createIntl({
    locale,
    defaultLocale: 'en-US'
  })

  return intl.formatDate(dateObj, formatOptions)
}

/**
 * Formats a date with full date and time (e.g., "Jan 15, 2024, 2:30 PM")
 */
export function formatDateTime(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Formats a date as short date (e.g., "Jan 15, 2024")
 */
export function formatDateShort(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Formats a date as long date (e.g., "January 15, 2024")
 */
export function formatDateLong(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    dateStyle: 'long'
  })
}

/**
 * Formats a date as medium date (e.g., "Jan 15, 2024")
 */
export function formatDateMedium(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    dateStyle: 'medium'
  })
}

/**
 * Formats a date with time only (e.g., "2:30 PM")
 */
export function formatTime(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Formats a date for display in cards/lists (e.g., "Jan 15, 2:30 PM")
 */
export function formatDateCompact(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formats a date in the same style as date-fns format(date, "PPP")
 * Example: "January 15th, 2024"
 */
export function formatDatePretty(
  date: DateInput,
  locale: string = 'en-US'
): string {
  return formatDate(date, {
    locale,
    dateStyle: 'long'
  })
}

/**
 * Hook to get date formatting functions that use the current locale from react-intl
 * Usage: const { formatDate, formatDateTime, formatDateShort } = useDateFormat()
 * 
 * Note: This hook requires the component to be wrapped in IntlProvider (via TranslationProvider)
 * 
 * This is exported separately to avoid circular dependencies with translation-context
 */

