"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  variant?: 'inline' | 'overlay' | 'fullscreen'
  className?: string
}

export function LoadingOverlay({
  isLoading,
  message = "Loading...",
  variant = 'inline',
  className
}: LoadingOverlayProps) {
  if (!isLoading) return null
  
  const getContainerClass = () => {
    switch (variant) {
      case 'overlay':
        return 'fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center'
      case 'fullscreen':
        return 'fixed inset-0 bg-white z-50 flex flex-col items-center justify-center'
      default:
        return 'flex items-center justify-center py-8'
    }
  }
  
  return (
    <div className={cn(getContainerClass(), className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        {message && (
          <p className="text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  )
}

