"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ProgressCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  value: number
  maxValue?: number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  showProgress?: boolean
  className?: string
}

export function ProgressCard({
  title,
  subtitle,
  icon,
  value,
  maxValue,
  unit = '',
  trend,
  trendValue,
  showProgress = false,
  className
}: ProgressCardProps) {
  const percentage = maxValue ? Math.round((value / maxValue) * 100) : 0
  
  const trendConfig = {
    up: { color: 'text-green-600', icon: '↑' },
    down: { color: 'text-red-600', icon: '↓' },
    neutral: { color: 'text-gray-600', icon: '' }
  }
  
  const trendStyle = trendConfig[trend || 'neutral']
  
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
          {trend && trendValue && (
            <span className={cn("text-sm ml-2", trendStyle.color)}>
              {trendStyle.icon} {trendValue}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {showProgress && maxValue && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

