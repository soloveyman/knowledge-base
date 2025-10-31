/**
 * Validation utilities for form inputs and dropdowns
 */

// Validation rule types
export type ValidationRule<T = unknown> = (value: T) => string | true

// Validation result
export type ValidationResult = string | true

// Validation schema for an object
export type ValidationSchema<T extends Record<string, unknown>> = {
  [K in keyof T]: Array<ValidationRule<T[K]>>
}

/**
 * Common validation rules
 */
export const validationRules = {
  /**
   * Required field validation
   */
  required: (value: unknown): ValidationResult => {
    if (typeof value === 'string') {
      return value.trim().length > 0 || 'This field is required'
    }
    if (Array.isArray(value)) {
      return value.length > 0 || 'At least one option must be selected'
    }
    if (value === null || value === undefined || value === '') {
      return 'This field is required'
    }
    return true
  },

  /**
   * Email format validation
   */
  email: (value: unknown): ValidationResult => {
    if (typeof value !== 'string' || !value || value.trim().length === 0) {
      return true // Let required handle empty values
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value.trim()) || 'Please enter a valid email address'
  },

  /**
   * Minimum length validation
   */
  minLength: (length: number) => (value: unknown): ValidationResult => {
    if (typeof value !== 'string' || !value || value.trim().length === 0) {
      return true // Let required handle empty values
    }
    return (
      value.trim().length >= length ||
      `Must be at least ${length} character${length !== 1 ? 's' : ''}`
    )
  },

  /**
   * Maximum length validation
   */
  maxLength: (length: number) => (value: unknown): ValidationResult => {
    if (typeof value !== 'string' || !value || value.trim().length === 0) {
      return true // Let required handle empty values
    }
    return (
      value.trim().length <= length ||
      `Must be no more than ${length} character${length !== 1 ? 's' : ''}`
    )
  },

  /**
   * Password strength validation
   */
  password: (value: unknown): ValidationResult => {
    if (typeof value !== 'string' || !value || value.trim().length === 0) {
      return true // Let required handle empty values
    }
    if (value.length < 6) {
      return 'Password must be at least 6 characters'
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must contain at least one number'
    }
    return true
  },

  /**
   * Future date validation
   */
  futureDate: (value: unknown): ValidationResult => {
    if (!value) {
      return true // Let required handle empty values
    }
    const date = typeof value === 'string' ? new Date(value) : value instanceof Date ? value : null
    if (!date || isNaN(date.getTime())) {
      return 'Must be a valid date'
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today || 'Date must be in the future'
  },

  /**
   * Positive number validation
   */
  positiveNumber: (value: unknown): ValidationResult => {
    if (value === '' || value === null || value === undefined) {
      return true // Let required handle empty values
    }
    const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
    if (isNaN(num)) {
      return 'Must be a valid number'
    }
    return num > 0 || 'Must be a positive number'
  },

  /**
   * Integer validation
   */
  integer: (value: unknown): ValidationResult => {
    if (value === '' || value === null || value === undefined) {
      return true // Let required handle empty values
    }
    const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
    if (isNaN(num)) {
      return 'Must be a valid number'
    }
    return Number.isInteger(num) || 'Must be a whole number'
  },

  /**
   * Minimum value validation
   */
  min: (minValue: number) => (value: unknown): ValidationResult => {
    if (value === '' || value === null || value === undefined) {
      return true // Let required handle empty values
    }
    const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
    if (isNaN(num)) {
      return 'Must be a valid number'
    }
    return num >= minValue || `Must be at least ${minValue}`
  },

  /**
   * Maximum value validation
   */
  max: (maxValue: number) => (value: unknown): ValidationResult => {
    if (value === '' || value === null || value === undefined) {
      return true // Let required handle empty values
    }
    const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
    if (isNaN(num)) {
      return 'Must be a valid number'
    }
    return num <= maxValue || `Must be no more than ${maxValue}`
  },

  /**
   * Array minimum length validation
   */
  minItems: (minLength: number) => (value: unknown): ValidationResult => {
    if (!Array.isArray(value)) {
      return 'Must be an array'
    }
    return (
      value.length >= minLength ||
      `Must select at least ${minLength} option${minLength !== 1 ? 's' : ''}`
    )
  },

  /**
   * Optional validation - only validate if value exists
   */
  optional: <T>(rule: ValidationRule<T>) => (value: unknown): ValidationResult => {
    if (value === null || value === undefined || value === '') {
      return true
    }
    return rule(value as T)
  }
}

/**
 * Validate an object against a validation schema
 */
export function validate<T extends Record<string, unknown>>(
  data: T,
  schema: ValidationSchema<T>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {}

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key as keyof T]
    
    // Skip validation if field is not in schema
    if (!(key in schema)) {
      continue
    }

    // Apply each validation rule
    for (const rule of rules) {
      try {
        const result = rule(value as string | number | boolean | null | undefined)
        if (result !== true) {
          errors[key as keyof T] = result
          break // Stop at first error for this field
        }
      } catch (error) {
        // If rule throws an error, treat as validation failure
        errors[key as keyof T] = 'Validation error occurred'
        break
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate a single field
 */
export function validateField<T>(
  value: T,
  rules: Array<ValidationRule<T>>
): string | null {
  for (const rule of rules) {
    try {
      const result = rule(value)
      if (result !== true) {
        return result
      }
    } catch (error) {
      return 'Validation error occurred'
    }
  }
  return null
}
