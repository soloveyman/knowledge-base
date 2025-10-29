"use client"

import { ReactNode } from "react"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <div className="h-12 w-12 mx-auto mb-4 text-muted-foreground">
        {icon}
      </div>
      <p className="mb-2">{title}</p>
      <p className="text-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-primary hover:text-primary/80 text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
