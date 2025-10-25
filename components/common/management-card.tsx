"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"

interface ManagementCardProps {
  title: string
  description: string
  icon: React.ReactNode
  actionButton: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
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
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button 
            className="w-full sm:w-auto"
            onClick={actionButton.onClick}
          >
            {actionButton.icon && <span className="h-4 w-4 mr-2">{actionButton.icon}</span>}
            {actionButton.label}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
