"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { useId } from "react"

interface ErrorMessageProps {
  error: string | null
  showIcon?: boolean
  className?: string
  id?: string
}

export function ErrorMessage({ 
  error, 
  showIcon = false, 
  className = "",
  id
}: ErrorMessageProps) {
  const generatedId = useId()
  const errorId = id || generatedId

  if (!error) return null

  return (
    <Card 
      className={`border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 ${className}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      id={errorId}
    >
      <CardContent className="py-3">
        {showIcon ? (
          <div className="flex items-center space-x-2">
            <AlertCircle 
              className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" 
              aria-hidden="true"
            />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <p className="text-red-600 dark:text-red-400 text-left">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
