/**
 * Date formatting utilities using Intl.DateTimeFormat
 * Provides consistent, locale-aware date formatting across the application
 */

type DateInput = string | number | Date

interface FormatDateOptions {
  locale?: string | string[]
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
 * Formats a date using Intl.DateTimeFormat
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

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj)
}

/**
 * Formats a date with full date and time (e.g., "Jan 15, 2024, 2:30 PM")
 */
export function formatDateTime(
  date: DateInput,
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
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
  locale: string | string[] = 'en-US'
): string {
  return formatDate(date, {
    locale,
    dateStyle: 'long'
  })
}

