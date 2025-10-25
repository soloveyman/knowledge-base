"use client"

import { ReactNode } from "react"
import { ManagementCard } from "./management-card"
import { EmptyState } from "./empty-state"
import { ListItem } from "./list-item"

interface ManagementPageProps {
  title: string
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
  }>
  showEditButton?: boolean
  emptyState: {
    icon: ReactNode
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
  }
}

export function ManagementPage({
  title,
  description,
  icon,
  actionButton,
  items,
  showEditButton = false,
  emptyState
}: ManagementPageProps) {
  return (
    <ManagementCard
      title={title}
      description={description}
      icon={icon}
      actionButton={actionButton}
    >
      <div className="space-y-3">
        {items.length === 0 ? (
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
              />
            ))}
          </div>
        )}
      </div>
    </ManagementCard>
  )
}
