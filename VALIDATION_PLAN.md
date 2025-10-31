# Input & Dropdown Validation Plan

## Current State Analysis

### ✅ Existing Validation
1. **User Builder** (`app/user-builder/page.tsx`)
   - Has `validateForm()` function
   - Validates: name, job, email format, password length, role
   - Uses `setError()` for global error display

2. **Question Editor** (`components/editor/question-editor.tsx`)
   - Has field-level validation with error object
   - Validates: title, content, options, correct answer
   - Uses `setErrors()` for per-field errors

3. **Assignment Creator** (`components/assignments/assignment-creator.tsx`)
   - Has `validateForm()` function
   - Validates: moduleId, assignedTo/groupIds, dueDate

### ❌ Missing/Inconsistent Validation
1. **Test Builder** (`app/test-builder/page.tsx`)
   - Only checks if document is selected
   - No validation for test configuration fields
   - No validation for context fields

2. **Assignment Builder** (`app/assignment-builder/page.tsx`)
   - Only disables submit button
   - No field-level error messages
   - No real-time validation feedback

3. **Sign In** (`app/auth/signin/page.tsx`)
   - Only HTML `required` attribute
   - No email format validation
   - No password strength validation

4. **Document Import** (`app/docs/import/page.tsx`)
   - No validation for file types/sizes

### Existing Components
- ✅ `Input` - Supports `aria-invalid` for error styling
- ✅ `Select` - Supports `aria-invalid` for error styling
- ✅ `FormGroup` - Has `error` prop for error messages
- ✅ `ErrorMessage` - Global error display component

---

## Implementation Strategy

### Phase 1: Create Validation Utilities

**File:** `lib/validation.ts`

Create a centralized validation library with reusable validation functions:

```typescript
// Validation rules
export const validationRules = {
  required: (value: string) => !!value.trim() || 'This field is required',
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) || 'Please enter a valid email address'
  },
  minLength: (length: number) => (value: string) =>
    value.trim().length >= length || `Must be at least ${length} characters`,
  maxLength: (length: number) => (value: string) =>
    value.trim().length <= length || `Must be no more than ${length} characters`,
  password: (value: string) => {
    if (value.length < 6) return 'Password must be at least 6 characters'
    if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter'
    if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter'
    if (!/[0-9]/.test(value)) return 'Password must contain at least one number'
    return true
  },
  futureDate: (value: string) => {
    const date = new Date(value)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today || 'Date must be in the future'
  },
  positiveNumber: (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return (num > 0 && !isNaN(num)) || 'Must be a positive number'
  }
}

// Validation schema builder
export type ValidationSchema<T> = {
  [K in keyof T]: Array<(value: T[K]) => string | true>
}

// Validate function
export function validate<T extends Record<string, unknown>>(
  data: T,
  schema: ValidationSchema<T>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {}
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key]
    for (const rule of rules) {
      const result = rule(value as string)
      if (result !== true) {
        errors[key as keyof T] = result
        break
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
```

---

### Phase 2: Enhanced Form Components

**File:** `components/common/form-field.tsx`

Create a reusable form field component that integrates validation:

```typescript
interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  helpText?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, helpText, children }: FormFieldProps) {
  const childId = React.useId()
  
  return (
    <FormGroup
      label={label}
      htmlFor={childId}
      required={required}
      error={error}
      helpText={helpText}
    >
      {React.cloneElement(children as React.ReactElement, {
        id: childId,
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': error ? `${childId}-error` : helpText ? `${childId}-help` : undefined
      })}
    </FormGroup>
  )
}
```

---

### Phase 3: React Hook for Form Validation

**File:** `lib/hooks/use-form-validation.ts`

Create a custom hook for form validation:

```typescript
import { useState, useCallback } from 'react'
import { validate, ValidationSchema } from '@/lib/validation'

export function useFormValidation<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const setValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }, [errors])

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }, [])

  const validateField = useCallback((field: keyof T) => {
    const fieldSchema = { [field]: schema[field] }
    const fieldData = { [field]: values[field] }
    const result = validate(fieldData, fieldSchema)
    
    if (!result.isValid) {
      setErrors(prev => ({ ...prev, ...result.errors }))
    } else {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    
    return result.isValid
  }, [values, schema])

  const validateAll = useCallback(() => {
    const result = validate(values, schema)
    setErrors(result.errors)
    // Mark all fields as touched
    setTouched(Object.keys(schema).reduce((acc, key) => {
      acc[key as keyof T] = true
      return acc
    }, {} as Partial<Record<keyof T, boolean>>))
    return result.isValid
  }, [values, schema])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField,
    validateAll,
    reset
  }
}
```

---

### Phase 4: Apply Validation to Forms

#### 4.1 User Builder Form ✅ (Enhance existing)

**Current:** Basic validation exists
**Enhancements:**
- Use `useFormValidation` hook
- Add real-time validation on blur
- Show field-level errors

**Validation Schema:**
```typescript
const schema = {
  name: [validationRules.required],
  job: [validationRules.required],
  email: [validationRules.required, validationRules.email],
  password: [
    (value: string) => !isEditMode || validationRules.required(value),
    validationRules.password
  ],
  role: [validationRules.required]
}
```

#### 4.2 Test Builder Form ❌

**Current:** Only document selection check
**Add:**
- Document selection validation
- Question count validation (min 1, max reasonable limit)
- Difficulty/type dropdown validation

**Validation Schema:**
```typescript
const schema = {
  documentId: [validationRules.required],
  questionCount: [
    validationRules.required,
    validationRules.positiveNumber,
    (value: number) => value >= 1 || 'Must be at least 1',
    (value: number) => value <= 100 || 'Cannot exceed 100 questions'
  ],
  difficulty: [validationRules.required],
  type: [validationRules.required],
  locale: [validationRules.required]
}
```

#### 4.3 Assignment Builder Form ❌

**Current:** Button disabled logic only
**Add:**
- Field-level validation
- Real-time feedback
- Clear error messages

**Validation Schema:**
```typescript
const schema = {
  name: [
    validationRules.required,
    validationRules.minLength(3),
    validationRules.maxLength(200)
  ],
  documentId: [validationRules.required],
  selectedUsers: [
    (users: string[]) => users.length > 0 || 'Select at least one employee'
  ],
  dueDate: [
    validationRules.required,
    validationRules.futureDate
  ],
  description: [
    validationRules.maxLength(1000)
  ]
}
```

#### 4.4 Sign In Form ❌

**Current:** HTML `required` only
**Add:**
- Email format validation
- Better error messages

**Validation Schema:**
```typescript
const schema = {
  email: [validationRules.required, validationRules.email],
  password: [validationRules.required, validationRules.minLength(6)]
}
```

#### 4.5 Document Import Form ❌

**Add:**
- File type validation (PDF, DOCX, etc.)
- File size validation (max 10MB, etc.)
- File name validation

**Validation:**
```typescript
const validateFile = (file: File) => {
  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    return 'Only PDF and DOCX files are allowed'
  }
  if (file.size > maxSize) {
    return 'File size must be less than 10MB'
  }
  return true
}
```

---

## Validation Rules by Field Type

### Text Inputs
- ✅ Required validation
- ✅ Min/Max length
- ✅ Pattern matching (email, phone, etc.)
- ✅ Real-time validation on blur

### Dropdown/Select Inputs
- ✅ Required validation
- ✅ Option validation (ensure valid option selected)
- ✅ Visual error state (red border)
- ✅ Error message below dropdown

### Date Inputs
- ✅ Required validation
- ✅ Future date validation
- ✅ Date range validation
- ✅ Format validation

### Number Inputs
- ✅ Required validation
- ✅ Min/Max value
- ✅ Positive number
- ✅ Integer/Decimal validation

### File Inputs
- ✅ Required validation
- ✅ File type validation
- ✅ File size validation
- ✅ File name validation

---

## Implementation Priority

### 🔴 High Priority (Critical Forms)
1. **Assignment Builder** - Core functionality, used frequently
2. **Test Builder** - Core functionality, prevents bad data
3. **User Builder** - Enhance existing validation

### 🟡 Medium Priority (Important Forms)
4. **Sign In** - User-facing, impacts UX
5. **Document Import** - Prevents invalid uploads

### 🟢 Low Priority (Nice to Have)
6. **Question Editor** - Already has validation, enhance with hook
7. **Other minor forms**

---

## User Experience Enhancements

### Real-time Validation
- ✅ Validate on blur (after user leaves field)
- ✅ Clear errors when user starts typing
- ✅ Show validation state with visual indicators

### Visual Feedback
- ✅ Red border on invalid fields (`aria-invalid` already supported)
- ✅ Error icon next to field (optional)
- ✅ Error message below field (via `FormGroup`)
- ✅ Success state for valid fields (optional, green checkmark)

### Accessibility
- ✅ `aria-invalid` attribute (already supported)
- ✅ `aria-describedby` for error messages
- ✅ Focus management on form submission errors
- ✅ Keyboard navigation support

---

## Testing Strategy

### Unit Tests
- Test each validation rule function
- Test validation schema builder
- Test `useFormValidation` hook

### Integration Tests
- Test form submission with invalid data
- Test real-time validation
- Test error message display

### E2E Tests
- Test complete form flow
- Test error scenarios
- Test success scenarios

---

## Next Steps

1. ✅ Create `lib/validation.ts` with validation utilities
2. ✅ Create `lib/hooks/use-form-validation.ts` hook
3. ✅ Enhance `FormGroup` component (already supports errors)
4. ✅ Apply validation to Assignment Builder (highest priority)
5. ✅ Apply validation to Test Builder
6. ✅ Enhance User Builder validation
7. ✅ Apply validation to Sign In form
8. ✅ Apply validation to Document Import
9. ✅ Add tests for validation functions

---

## Example Implementation

### Before (Assignment Builder)
```typescript
disabled={isCreating || !assignmentConfig.name || !assignmentConfig.documentId || assignmentConfig.selectedUsers.length === 0}
```

### After (Assignment Builder)
```typescript
const { values, errors, touched, setValue, setFieldTouched, validateAll } = useFormValidation({
  name: [validationRules.required, validationRules.minLength(3)],
  documentId: [validationRules.required],
  selectedUsers: [(users: string[]) => users.length > 0 || 'Select at least one employee'],
  dueDate: [validationRules.required, validationRules.futureDate]
}, assignmentConfig)

// In JSX
<FormField
  label="Assignment Name"
  required
  error={touched.name ? errors.name : undefined}
>
  <Input
    value={values.name}
    onChange={(e) => setValue('name', e.target.value)}
    onBlur={() => setFieldTouched('name')}
  />
</FormField>
```

---

## Notes

- **Zod Alternative:** Consider using Zod for schema validation if we want more advanced features
- **Form Libraries:** Could use React Hook Form or Formik, but keeping it simple with custom hook for now
- **Server-side Validation:** Always validate on server as well - client validation is for UX only
- **Internationalization:** Validation messages should be translatable (use `t()` function)

