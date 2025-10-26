"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface ErrorMessageProps {
  error: string | null
  showIcon?: boolean
  className?: string
}

export function ErrorMessage({ error, showIcon = false, className = "" }: ErrorMessageProps) {
  if (!error) return null

  return (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardContent>
        {showIcon ? (
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <p className="text-red-600 text-left">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
