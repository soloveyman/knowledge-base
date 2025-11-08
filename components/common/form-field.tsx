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
  
  // Helper to find and clone input element recursively
  const cloneWithProps = (element: React.ReactElement): React.ReactElement => {
    // If this is an input-like element, clone it with props
    if (element.type === 'input' || 
        (typeof element.type === 'function' && element.type.name === 'Input') ||
        (element.props && 'data-slot' in element.props && element.props['data-slot'] === 'input')) {
      const childProps = (element?.props || {}) as { className?: string } & Record<string, unknown>
      return React.cloneElement(element, {
        id,
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': error 
          ? `${id}-error` 
          : helpText 
            ? `${id}-help` 
            : undefined,
        className: cn(
          childProps?.className,
          error && 'border-destructive focus-visible:ring-destructive/20'
        )
      } as Partial<unknown>)
    }
    
    // If element has children, recursively process them
    if (element.props && element.props.children) {
      const children = React.Children.map(element.props.children, (child) => {
        if (React.isValidElement(child)) {
          return cloneWithProps(child)
        }
        return child
      })
      return React.cloneElement(element, {}, ...(children || []))
    }
    
    return element
  }
  
  // Handle fragments and multiple children
  const isFragment = React.isValidElement(children) && children.type === React.Fragment
  const childWithProps = isFragment 
    ? React.cloneElement(children, {}, 
        React.Children.map(children.props.children, (child) => {
          if (React.isValidElement(child)) {
            return cloneWithProps(child)
          }
          return child
        })
      )
    : React.isValidElement(children) 
      ? cloneWithProps(children)
      : children

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
