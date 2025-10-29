"use client"

import { cn } from "@/lib/utils"
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle,
  Loader2,
  Activity
} from "lucide-react"

type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading' | 'completed'

interface StatusIndicatorProps {
  status: StatusVariant
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<StatusVariant, { icon: typeof CheckCircle; color: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600' },
  error: { icon: XCircle, color: 'text-red-600' },
  warning: { icon: AlertCircle, color: 'text-yellow-600' },
  info: { icon: AlertCircle, color: 'text-blue-600' },
  pending: { icon: Clock, color: 'text-muted-foreground' },
  loading: { icon: Loader2, color: 'text-blue-600' },
  completed: { icon: CheckCircle, color: 'text-green-600' },
}

export function StatusIndicator({ 
  status, 
  label, 
  size = 'md',
  className 
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }
  
  const isAnimated = status === 'loading'
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className={cn(
        sizeClasses[size],
        config.color,
        isAnimated && "animate-spin"
      )} />
      {label && (
        <span className="text-sm text-foreground">{label}</span>
      )}
    </div>
  )
}

