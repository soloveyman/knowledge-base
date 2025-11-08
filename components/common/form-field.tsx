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
    const props = element.props
    const propsIsObject = props && typeof props === 'object' && !Array.isArray(props) && props !== null
    const hasDataSlot = propsIsObject && 'data-slot' in props && (props as Record<string, unknown>)['data-slot'] === 'input'
    if (element.type === 'input' || 
        (typeof element.type === 'function' && element.type.name === 'Input') ||
        hasDataSlot) {
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
    const elementProps = element.props
    const elementPropsIsObject = elementProps && typeof elementProps === 'object' && !Array.isArray(elementProps) && elementProps !== null
    if (elementPropsIsObject && 'children' in elementProps) {
      const children = React.Children.map((elementProps as { children?: React.ReactNode }).children, (child) => {
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
    ? (() => {
        const fragmentProps = children.props
        const fragmentPropsIsObject = fragmentProps && typeof fragmentProps === 'object' && !Array.isArray(fragmentProps) && fragmentProps !== null
        const fragmentChildren = fragmentPropsIsObject && 'children' in fragmentProps 
          ? (fragmentProps as { children?: React.ReactNode }).children 
          : undefined
        return React.cloneElement(children, {}, 
          React.Children.map(fragmentChildren, (child) => {
            if (React.isValidElement(child)) {
              return cloneWithProps(child)
            }
            return child
          })
        )
      })()
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
