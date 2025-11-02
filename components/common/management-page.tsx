"use client"

import { ReactNode } from "react"
import { ManagementCard } from "./management-card"
import { EmptyState } from "./empty-state"
import { ListItem } from "./list-item"

interface ManagementPageProps {
  title: string | ReactNode
  description: string
  icon: ReactNode
  actionButton: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
  items: Array<{
    id: string
    title: string
    subtitle?: string
    metadata?: string[]
    badges?: Array<{
      label: string
      variant?: "default" | "secondary" | "outline" | "destructive"
    }>
    onClick?: () => void
    onDelete?: () => void
    onEdit?: () => void
    deleteDataLossWarning?: string
  }>
  showEditButton?: boolean
  emptyState: {
    icon: ReactNode
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
  }
  isLoading?: boolean
}

export function ManagementPage({
  title,
  description,
  icon,
  actionButton,
  items,
  showEditButton = false,
  emptyState,
  isLoading = false
}: ManagementPageProps) {
  return (
    <ManagementCard
      title={title}
      description={description}
      icon={icon}
      actionButton={actionButton}
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState {...emptyState} />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ListItem
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                metadata={item.metadata}
                badges={item.badges}
                onClick={item.onClick}
                onDelete={item.onDelete}
                onEdit={item.onEdit}
                showEditButton={showEditButton}
                deleteDataLossWarning={item.deleteDataLossWarning}
              />
            ))}
          </div>
        )}
      </div>
    </ManagementCard>
  )
}
