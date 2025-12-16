"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ToolbarAction {
  label?: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "destructive"
  tooltip?: string
}

interface ToolbarProps {
  actions: ToolbarAction[]
  className?: string
}

export function Toolbar({ actions, className }: ToolbarProps) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-muted",
      className
    )}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || "ghost"}
          size="icon-sm"
          className="rounded-full"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.tooltip}
        >
          {action.icon}
        </Button>
      ))}
    </div>
  )
}

