import { useState, useEffect, useCallback } from 'react'
import { isValidEmailFormat } from '@/lib/email-validation'
import type { TranslationKey } from '@/lib/translations'

interface EmailValidationResult {
  isValid: boolean
  isAvailable: boolean | null // null = not checked yet
  isChecking: boolean
  error: string | null
}

/**
 * Hook to validate email format and check availability
 * @param email - Email address to validate
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @param skipCheck - Skip availability check (only validate format)
 * @param t - Optional translation function for error messages
 */
export function useEmailValidation(
  email: string,
  debounceMs: number = 500,
  skipCheck: boolean = false,
  t?: (key: TranslationKey) => string
): EmailValidationResult {
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkEmailAvailability = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || !isValidEmailFormat(emailToCheck)) {
      setIsAvailable(null)
      setError(null)
      return
    }

    if (skipCheck) {
      setIsAvailable(true)
      setError(null)
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(emailToCheck)}`)
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server')
      }

      const data = await response.json()

      if (!response.ok) {
        // Translate API error messages if translation function is available
        let errorMessage = data.error || (t ? t('failedToCheckEmailAvailability') : 'Failed to check email availability')
        
        // Map common API error messages to translation keys
        if (t && data.error) {
          if (data.error.includes('Failed to check email availability')) {
            errorMessage = t('failedToCheckEmailAvailabilityRetryLater')
          } else if (data.error.includes('Too many requests')) {
            // Use the error message as-is if translation key doesn't exist
            errorMessage = data.error
          } else if (data.error.includes('Invalid email format')) {
            errorMessage = t('invalidEmail') || data.error
          } else if (data.error.includes('Disposable') || data.error.includes('temporary')) {
            // Use the error message as-is if translation key doesn't exist
            errorMessage = data.error
          }
        }
        
        setError(errorMessage)
        setIsAvailable(false)
      } else {
        setIsAvailable(data.available)
        if (!data.available) {
          setError(t ? t('emailAlreadyRegistered') : 'This email is already registered')
        } else {
          setError(null)
        }
      }
    } catch (err) {
      console.error('Email validation error:', err)
      // Distinguish between network errors and other errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError(t ? t('networkErrorCheckConnection') : 'Network error. Please check your connection and try again.')
      } else if (err instanceof SyntaxError || (err instanceof Error && err.message === 'Invalid response format from server')) {
        setError(t ? t('invalidResponseFromServer') : 'Invalid response from server. Please try again.')
      } else {
        setError(t ? t('failedToCheckEmailAvailabilityRetry') : 'Failed to check email availability. Please try again.')
      }
      setIsAvailable(null)
    } finally {
      setIsChecking(false)
    }
  }, [skipCheck, t])

  useEffect(() => {
    if (!email || !isValidEmailFormat(email)) {
      setIsAvailable(null)
      setError(null)
      setIsChecking(false)
      return
    }

    const timeoutId = setTimeout(() => {
      checkEmailAvailability(email)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [email, debounceMs, checkEmailAvailability])

  const isValid = isValidEmailFormat(email)

  return {
    isValid,
    isAvailable,
    isChecking,
    error
  }
}

