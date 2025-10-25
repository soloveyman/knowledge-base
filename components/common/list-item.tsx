"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
            {metadata.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
        )}
        {badges.length > 0 && (
          <div className="flex items-center space-x-2 mt-2">
            {badges.map((badge, index) => (
              <Badge 
                key={index}
                variant={badge.variant || "outline"} 
                className="text-xs"
              >
                {badge.label}
              </Badge>
            ))}
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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
