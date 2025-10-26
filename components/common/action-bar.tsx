"use client"

import { Button } from "@/components/ui/button"
import { Plus, Download, Upload, Filter } from "lucide-react"
import { ReactNode } from "react"

interface Action {
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary"
  disabled?: boolean
}

interface ActionBarProps {
  primaryAction: Action
  secondaryActions?: Action[]
  className?: string
}

export function ActionBar({ 
  primaryAction, 
  secondaryActions = [],
  className 
}: ActionBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Primary Action */}
      <Button 
        onClick={primaryAction.onClick}
        variant={primaryAction.variant || "default"}
        disabled={primaryAction.disabled}
      >
        {primaryAction.icon && <span className="mr-2">{primaryAction.icon}</span>}
        {primaryAction.label}
      </Button>
      
      {/* Secondary Actions */}
      {secondaryActions.map((action, index) => (
        <Button
          key={index}
          onClick={action.onClick}
          variant={action.variant || "outline"}
          disabled={action.disabled}
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  )
}

