"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

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
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

