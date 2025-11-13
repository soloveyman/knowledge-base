"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"

interface ManagementCardProps {
  title: string | React.ReactNode
  description: string
  icon: React.ReactNode
  actionButton: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
    disabled?: boolean
  }
  children: React.ReactNode
}

export function ManagementCard({ 
  title, 
  description, 
  icon, 
  actionButton, 
  children 
}: ManagementCardProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    // Always call onClick, even if button is disabled
    // This allows showing toast messages for disabled buttons
    if (actionButton.disabled) {
      e.preventDefault()
      e.stopPropagation()
    }
    actionButton.onClick()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div 
            onClick={actionButton.disabled ? handleButtonClick : undefined}
            className={actionButton.disabled ? "cursor-pointer" : ""}
          >
            <Button 
              className="w-full sm:w-auto"
              onClick={handleButtonClick}
              disabled={actionButton.disabled}
            >
              {actionButton.icon && <span className="h-4 w-4 mr-2">{actionButton.icon}</span>}
              {actionButton.label}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
