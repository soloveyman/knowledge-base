"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { validate, validateField, ValidationSchema } from '@/lib/validation'

/**
 * Custom hook for form validation - simplified for stability
 */
export function useFormValidation<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  
  // Use refs to access current state in callbacks without dependencies
  const valuesRef = useRef(values)
  const errorsRef = useRef(errors)
  const touchedRef = useRef(touched)
  
  // Keep refs in sync with state - use useEffect to avoid updating refs during render
  useEffect(() => {
    valuesRef.current = values
    errorsRef.current = errors
    touchedRef.current = touched
  }, [values, errors, touched])

  /**
   * Update a single field value - simplified, no auto-validation
   */
  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  /**
   * Set touched state for a field
   */
  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched((prev) => ({
      ...prev,
      [field]: isTouched,
    }))
  }, [])

  /**
   * Clear error for a single field
   */
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  /**
   * Validate a single field
   */
  const validateFieldValue = useCallback(
    (field: keyof T): string | undefined => {
      // Get rules for this field from schema
      const fieldRules = schema[field]
      if (!fieldRules || fieldRules.length === 0) {
        // No rules, clear any existing error
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
        return undefined
      }
      
      // Get current value for this field
      const fieldValue = valuesRef.current[field]
      
      // Validate using validateField function
      const fieldError = validateField(fieldValue, fieldRules)
      
      if (fieldError) {
        setErrors((prev) => ({
          ...prev,
          [field]: fieldError,
        }))
        return fieldError
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
        return undefined
      }
    },
    [schema]
  )

  /**
   * Validate all fields
   */
  const validateAll = useCallback((): boolean => {
    const validationResult = validate(valuesRef.current, schema)
    // Mark all fields as touched
    const allTouched: Partial<Record<keyof T, boolean>> = {}
    Object.keys(valuesRef.current).forEach((key) => {
      allTouched[key as keyof T] = true
    })
    setTouched(allTouched)
    // Set errors in state so they display under fields
    setErrors(validationResult.errors)

    return validationResult.isValid
  }, [schema])

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  /**
   * Reset errors only
   */
  const resetErrors = useCallback(() => {
    setErrors({})
  }, [])

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0
  }, [errors])

  /**
   * Check if form has been touched
   */
  const isTouched = useMemo(() => {
    return Object.keys(touched).length > 0
  }, [touched])

  return {
    values,
    errors,
    touched,
    isValid,
    isTouched,
    setValue,
    setFieldTouched,
    clearFieldError,
    validateField: validateFieldValue,
    validateAll,
    reset,
    resetErrors,
  }
}
