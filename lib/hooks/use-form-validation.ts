"use client"

import { useState, useCallback, useRef, useMemo } from 'react'
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
  
  // Keep refs in sync with state
  valuesRef.current = values
  errorsRef.current = errors
  touchedRef.current = touched

  /**
   * Update a single field value - simplified, no auto-validation
   */
  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues(prev => ({ ...prev, [field]: value }))
    },
    [] // No dependencies - stable
  )

  /**
   * Mark a field as touched
   */
  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }))
  }, [])

  /**
   * Validate a single field
   */
  const validateSingleField = useCallback(
    (field: keyof T) => {
      const rules = schema[field]
      if (!rules) return true

      const value = valuesRef.current[field]
      const error = validateField(value, rules)
      
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }))
        return false
      } else {
        setErrors(prev => {
          const next = { ...prev }
          delete next[field]
          return next
        })
        return true
      }
    },
    [schema]
  )

  /**
   * Validate all fields
   */
  const validateAll = useCallback(() => {
    const result = validate(valuesRef.current, schema)
    setErrors(result.errors)
    
    // Mark all fields as touched
    const allTouched = Object.keys(schema).reduce(
      (acc, key) => {
        acc[key as keyof T] = true
        return acc
      },
      {} as Partial<Record<keyof T, boolean>>
    )
    setTouched(allTouched)
    
    return result.isValid
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
   * Update multiple values at once
   */
  const setValuesBulk = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }))
  }, [])

  // Memoize return object to prevent reference changes when values haven't changed
  // This prevents infinite loops from components that depend on the validation object
  return useMemo(() => ({
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField: validateSingleField,
    validateAll,
    reset,
    setValues: setValuesBulk
  }), [values, errors, touched, setValue, setFieldTouched, validateSingleField, validateAll, reset, setValuesBulk])
}
