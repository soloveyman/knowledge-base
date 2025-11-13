"use client"

import { useEffect, useRef } from 'react'

/**
 * Hook to manage focus when errors occur in forms
 * Focuses the first invalid field or error message
 */
export function useFocusOnError(
  errors: Record<string, string | undefined> | null,
  errorElementId?: string
) {
  const errorRef = useRef<HTMLElement | null>(null)
  const firstErrorFieldRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!errors) return

    // Find first error field
    const errorKeys = Object.keys(errors).filter(key => errors[key])
    if (errorKeys.length === 0) return

    // Try to focus error message container first if provided
    if (errorElementId) {
      const errorElement = document.getElementById(errorElementId)
      if (errorElement) {
        errorElement.focus()
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }

    // Otherwise, focus first invalid field
    const firstErrorKey = errorKeys[0]
    const fieldId = firstErrorKey
    const fieldElement = document.getElementById(fieldId) || 
                       document.querySelector(`[name="${firstErrorKey}"]`) ||
                       document.querySelector(`[aria-describedby*="${fieldId}-error"]`)
    
    if (fieldElement instanceof HTMLElement) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        fieldElement.focus()
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [errors, errorElementId])
}

/**
 * Hook to announce errors to screen readers
 */
export function useErrorAnnouncement(
  errors: Record<string, string | undefined> | null,
  errorMessage?: string | null
) {
  useEffect(() => {
    if (!errors && !errorMessage) return

    const errorCount = errors 
      ? Object.keys(errors).filter(key => errors[key]).length 
      : 0
    
    if (errorCount > 0 || errorMessage) {
      // Create or update aria-live region
      let liveRegion = document.getElementById('error-announcements')
      if (!liveRegion) {
        liveRegion = document.createElement('div')
        liveRegion.id = 'error-announcements'
        liveRegion.setAttribute('role', 'status')
        liveRegion.setAttribute('aria-live', 'assertive')
        liveRegion.setAttribute('aria-atomic', 'true')
        liveRegion.className = 'sr-only'
        document.body.appendChild(liveRegion)
      }

      const message = errorMessage || 
        (errorCount === 1 
          ? 'There is 1 error in the form'
          : `There are ${errorCount} errors in the form`)
      
      liveRegion.textContent = message
      
      // Clear after announcement
      setTimeout(() => {
        if (liveRegion) {
          liveRegion.textContent = ''
        }
      }, 1000)
    }
  }, [errors, errorMessage])
}

