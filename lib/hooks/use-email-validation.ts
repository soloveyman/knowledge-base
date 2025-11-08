import { useState, useEffect, useCallback } from 'react'
import { isValidEmailFormat } from '@/lib/email-validation'

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
 */
export function useEmailValidation(
  email: string,
  debounceMs: number = 500,
  skipCheck: boolean = false
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
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to check email availability')
        setIsAvailable(false)
      } else {
        setIsAvailable(data.available)
        if (!data.available) {
          setError('This email is already registered')
        } else {
          setError(null)
        }
      }
    } catch (err) {
      console.error('Email validation error:', err)
      setError('Failed to check email availability')
      setIsAvailable(null)
    } finally {
      setIsChecking(false)
    }
  }, [skipCheck])

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

