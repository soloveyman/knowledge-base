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
    <div className="text-center py-8 text-gray-500">
      <div className="h-12 w-12 mx-auto mb-4 text-gray-300">
        {icon}
      </div>
      <p className="mb-2">{title}</p>
      <p className="text-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
