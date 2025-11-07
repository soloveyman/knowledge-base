"use client"

/**
 * Hook to get date formatting functions that use the current locale from react-intl
 * Usage: const { formatDate, formatDateTime, formatDateShort } = useDateFormat()
 * 
 * Note: This hook requires the component to be wrapped in IntlProvider (via TranslationProvider)
 */

import { useIntl } from 'react-intl'
import {
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
  formatDateShort as formatDateShortUtil,
  formatDateLong as formatDateLongUtil,
  formatDateMedium as formatDateMediumUtil,
  formatTime as formatTimeUtil,
  formatDateCompact as formatDateCompactUtil,
  formatDatePretty as formatDatePrettyUtil,
  type DateInput,
  type FormatDateOptions
} from './date-format'

export function useDateFormat() {
  const intl = useIntl()
  const locale = intl.locale || 'en-US'
  
  return {
    formatDate: (date: DateInput, options?: FormatDateOptions) => 
      formatDateUtil(date, { ...options, locale }),
    formatDateTime: (date: DateInput) => formatDateTimeUtil(date, locale),
    formatDateShort: (date: DateInput) => formatDateShortUtil(date, locale),
    formatDateLong: (date: DateInput) => formatDateLongUtil(date, locale),
    formatDateMedium: (date: DateInput) => formatDateMediumUtil(date, locale),
    formatTime: (date: DateInput) => formatTimeUtil(date, locale),
    formatDateCompact: (date: DateInput) => formatDateCompactUtil(date, locale),
    formatDatePretty: (date: DateInput) => formatDatePrettyUtil(date, locale)
  }
}

