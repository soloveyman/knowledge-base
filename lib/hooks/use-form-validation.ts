"use client"

import { useState, useCallback } from 'react'
import { validate, validateField, ValidationSchema, ValidationRule } from '@/lib/validation'

/**
 * Custom hook for form validation
 */
export function useFormValidation<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  /**
   * Update a single field value
   */
  const setValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues(prev => ({ ...prev, [field]: value }))
      
      // Clear error when user starts typing (if field was touched)
      if (errors[field] && touched[field]) {
        const rules = schema[field]
        if (rules) {
          const error = validateField(value, rules)
          if (error) {
            setErrors(prev => ({ ...prev, [field]: error }))
          } else {
            setErrors(prev => {
              const next = { ...prev }
              delete next[field]
              return next
            })
          }
        }
      }
    },
    [errors, touched, schema]
  )

  /**
   * Mark a field as touched (user has interacted with it)
   */
  const setFieldTouched = useCallback((field: keyof T) => {
    if (!touched[field]) {
      setTouched(prev => ({ ...prev, [field]: true }))
      
      // Validate field when it's first touched
      const rules = schema[field]
      if (rules) {
        const value = values[field]
        const error = validateField(value, rules)
        if (error) {
          setErrors(prev => ({ ...prev, [field]: error }))
        }
      }
    }
  }, [touched, schema, values])

  /**
   * Validate a single field
   */
  const validateSingleField = useCallback(
    (field: keyof T) => {
      const rules = schema[field]
      if (!rules) {
        return true
      }

      const value = values[field]
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
    [values, schema]
  )

  /**
   * Validate all fields
   */
  const validateAll = useCallback(() => {
    const result = validate(values, schema)
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
  }, [values, schema])

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

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField: validateSingleField,
    validateAll,
    reset,
    setValues: setValuesBulk
  }
}
