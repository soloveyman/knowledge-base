"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getStatusBadge, getRoleBadge, getCountBadge, getDifficultyBadge, getLocaleBadge } from "@/lib/badges"
import { DeleteConfirmation } from "./delete-confirmation"
import { X, Edit } from "lucide-react"

interface ListItemProps {
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
  showDeleteButton?: boolean
  showEditButton?: boolean
}

export function ListItem({ 
  title, 
  subtitle, 
  metadata = [], 
  badges = [], 
  onClick, 
  onDelete, 
  onEdit,
  showDeleteButton = true,
  showEditButton = false
}: ListItemProps) {
  return (
    <div 
      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
        {metadata.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 mt-2 text-xs text-gray-400">
            {metadata.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
        )}
        {badges.length > 0 && (
          <div className="flex items-center space-x-2 mt-2">
            {badges.map((badge, index) => {
              // Try to determine badge type and use appropriate config
              let config = badge
              
              // Check if it's a status badge
              if (badge.label && ['active', 'inactive', 'failed', 'pending', 'completed', 'draft', 'published', 'archived'].includes(badge.label.toLowerCase())) {
                config = getStatusBadge(badge.label)
              }
              // Check if it's a role badge
              else if (badge.label && ['employee', 'manager', 'owner', 'admin'].includes(badge.label.toLowerCase())) {
                config = getRoleBadge(badge.label)
              }
              // Check if it's a difficulty badge
              else if (badge.label && ['easy', 'medium', 'hard'].includes(badge.label.toLowerCase())) {
                config = getDifficultyBadge(badge.label)
              }
              // Check if it's a locale badge
              else if (badge.label && ['en', 'es', 'fr', 'de', 'english', 'spanish', 'french', 'german'].includes(badge.label.toLowerCase())) {
                config = getLocaleBadge(badge.label)
              }
              // Check if it's a count badge
              else if (badge.label && badge.label.includes('employee')) {
                const count = parseInt(badge.label.match(/\d+/)?.[0] || '0')
                config = getCountBadge('employees', count)
              }
              
              return (
                <Badge 
                  key={index}
                  variant={config.variant || "outline"} 
                  className="text-xs"
                >
                  {config.label}
                </Badge>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-1">
        {showEditButton && onEdit && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {showDeleteButton && onDelete && (
          <DeleteConfirmation
            onConfirm={onDelete}
            itemName={title}
            trigger={
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-red-600"
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
