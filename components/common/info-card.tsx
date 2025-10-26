"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface InfoCardProps {
  title: string
  description?: string
  icon?: ReactNode
  badge?: {
    label: string
    variant?: "default" | "secondary" | "outline" | "destructive"
  }
  alert?: {
    message: string
    variant?: "default" | "destructive"
  }
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

export function InfoCard({
  title,
  description,
  icon,
  badge,
  alert,
  footer,
  className,
  children
}: InfoCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="mt-1 shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <CardTitle>{title}</CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
          </div>
          {badge && (
            <Badge variant={badge.variant || "default"}>
              {badge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {alert && (
        <CardContent className="pt-0">
          <Alert variant={alert.variant || "default"}>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        </CardContent>
      )}
      {footer && (
        <CardContent className="pt-0">
          {footer}
        </CardContent>
      )}
    </Card>
  )
}

