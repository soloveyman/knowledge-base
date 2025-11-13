"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ReactNode, useId } from "react"

interface FormGroupProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  helpText?: string
  className?: string
  children: ReactNode
}

export function FormGroup({
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  className,
  children
}: FormGroupProps) {
  const generatedId = useId()
  const fieldId = htmlFor || generatedId
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  
  // Build aria-describedby string
  const describedBy = [
    error ? errorId : null,
    helpText ? helpId : null
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>
      {children}
      {helpText && (
        <p 
          id={helpId}
          className="text-sm text-muted-foreground"
          role="note"
        >
          {helpText}
        </p>
      )}
      {error && (
        <p 
          id={errorId}
          className="text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}

