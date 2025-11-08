"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getStatusBadge, getRoleBadge, getCountBadge, getDifficultyBadge, getLocaleBadge } from "@/lib/badge-utils"
import { useBadgeTranslation } from "@/lib/badge-translations"
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
  deleteDataLossWarning?: string
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
  showEditButton = false,
  deleteDataLossWarning
}: ListItemProps) {
  const translateBadge = useBadgeTranslation()
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = () => {
    setIsDeleting(true)
    // Fast fade-out animation (100ms), then call onDelete
    setTimeout(() => {
      onDelete?.()
    }, 100) // Fast fade-out: 100ms
  }
  
  return (
    <div 
      className={`p-4 border border-border rounded-3xl hover:bg-accent transition-all duration-100 ${
        isDeleting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start md:items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground truncate">
              {title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()}
            </h3>
            {badges.length > 0 && (
              <div className="flex items-center space-x-2 shrink-0">
                {badges.map((badge, index) => {
                  // Try to determine badge type and use appropriate config
                  let config = badge
                  
                  // Check if it's a status badge (including ready)
                  if (badge.label && ['active', 'inactive', 'failed', 'pending', 'completed', 'ready', 'draft', 'published', 'archived'].includes(badge.label.toLowerCase())) {
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
                  
                  const badgeLabel = translateBadge(config.label)
                  // Remove emojis from badge label
                  const cleanedLabel = badgeLabel.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
                  
                  return (
                    <Badge 
                      key={index}
                      variant={config.variant || "outline"} 
                      className="text-xs"
                    >
                      {cleanedLabel}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
        {metadata.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs text-muted-foreground">
            {metadata.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
        )}
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {showEditButton && onEdit && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-primary"
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
            onConfirm={handleDelete}
            itemName={title}
            dataLossWarning={deleteDataLossWarning}
            trigger={
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-4 w-4" />
              </Button>
            }
          />
        )}
        </div>
      </div>
    </div>
  )
}
