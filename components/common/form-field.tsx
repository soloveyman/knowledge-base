"use client"

import * as React from "react"
import { FormGroup } from "./form-group"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  helpText?: string
  className?: string
  children: React.ReactElement
}

/**
 * Enhanced form field component that wraps FormGroup and applies
 * validation states to child inputs
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  className,
  children
}: FormFieldProps) {
  const fieldId = React.useId()
  const id = htmlFor || fieldId
  
  // Clone child element and add validation props
  const childWithProps = React.cloneElement(children, {
    id,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error 
      ? `${id}-error` 
      : helpText 
        ? `${id}-help` 
        : undefined,
    className: cn(
      children.props.className,
      error && 'border-destructive focus-visible:ring-destructive/20'
    )
  })

  return (
    <FormGroup
      label={label}
      htmlFor={id}
      required={required}
      error={error}
      helpText={helpText}
      className={className}
    >
      {childWithProps}
    </FormGroup>
  )
}
