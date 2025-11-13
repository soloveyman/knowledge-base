"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton, SkeletonCard, SkeletonList, SkeletonTable, SkeletonMetrics } from "@/components/ui/skeleton"

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  variant?: 'inline' | 'overlay' | 'fullscreen' | 'skeleton' | 'skeleton-card' | 'skeleton-list' | 'skeleton-table' | 'skeleton-metrics'
  className?: string
  skeletonCount?: number
}

export function LoadingOverlay({
  isLoading,
  message = "Loading...",
  variant = 'inline',
  className,
  skeletonCount = 3
}: LoadingOverlayProps) {
  if (!isLoading) return null
  
  // Skeleton variants
  if (variant === 'skeleton') {
    return <Skeleton className={cn("h-32 w-full", className)} />
  }
  
  if (variant === 'skeleton-card') {
    return <SkeletonCard className={className} />
  }
  
  if (variant === 'skeleton-list') {
    return <SkeletonList count={skeletonCount} className={className} />
  }
  
  if (variant === 'skeleton-table') {
    return <SkeletonTable rows={skeletonCount} className={className} />
  }
  
  if (variant === 'skeleton-metrics') {
    return <SkeletonMetrics count={skeletonCount} className={className} />
  }
  
  const getContainerClass = () => {
    switch (variant) {
      case 'overlay':
        return 'fixed inset-0 bg-white/80 dark:bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in-0 duration-200'
      case 'fullscreen':
        return 'fixed inset-0 bg-background z-50 flex flex-col items-center justify-center animate-in fade-in-0 duration-200'
      default:
        return 'flex items-center justify-center py-8'
    }
  }
  
  return (
    <div className={cn(getContainerClass(), className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message && (
          <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
        )}
      </div>
    </div>
  )
}

