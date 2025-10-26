"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  badge?: {
    label: string
    variant?: "default" | "secondary" | "outline" | "destructive"
  }
  trend?: {
    value: number
    label?: string
    direction: 'up' | 'down'
  }
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  trend,
  className
}: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {badge && (
            <Badge variant={badge.variant || "default"}>{badge.label}</Badge>
          )}
          {trend && (
            <div className={cn(
              "flex items-center text-xs",
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trend.value}%
              {trend.label && <span className="ml-1 text-gray-600">{trend.label}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

