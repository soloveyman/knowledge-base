"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useBadgeTranslation } from "./badge-translations"
import { 
  BADGE_CONFIGS, 
  badgeVariantStyles, 
  getBadgeConfig, 
  getCountBadge,
  type BadgeVariant 
} from "./badge-utils"

// Enhanced Badge component with consistent styling
interface CommonBadgeProps {
  type: keyof typeof BADGE_CONFIGS
  value: string | number
  className?: string
  showIcon?: boolean
  icon?: React.ReactNode
}

export function CommonBadge({ type, value, className, showIcon, icon }: CommonBadgeProps) {
  const translateBadge = useBadgeTranslation()
  let config
  
  if (type === 'count') {
    const countType = typeof value === 'number' ? 'employees' : value as 'employees' | 'questions' | 'attempts'
    config = getCountBadge(countType, typeof value === 'number' ? value : 0)
  } else {
    config = getBadgeConfig(type, String(value).toLowerCase())
  }
  
  const variant = config.variant as BadgeVariant
  const label = typeof config.label === 'function' ? config.label : config.label
  
  // Translate the label
  const translatedLabel = translateBadge(label)
  
  // Special handling for failed status in status badges
  const isFailedStatus = type === 'status' && String(value).toLowerCase() === 'failed'
  
  return (
    <Badge 
      variant={variant === 'success' || variant === 'warning' || variant === 'info' ? 'outline' : variant}
      className={cn(
        variant === 'success' && badgeVariantStyles.success,
        variant === 'warning' && badgeVariantStyles.warning,
        variant === 'info' && badgeVariantStyles.info,
        isFailedStatus && badgeVariantStyles.failed,
        className
      )}
    >
      {showIcon && icon}
      {translatedLabel}
    </Badge>
  )
}

// Pre-configured badge components for common use cases
export const StatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <CommonBadge type="status" value={status} className={className} />
)

export const RoleBadge = ({ role, className }: { role: string; className?: string }) => (
  <CommonBadge type="role" value={role} className={className} />
)

export const DocumentTypeBadge = ({ type, className }: { type: string; className?: string }) => (
  <CommonBadge type="documentType" value={type} className={className} />
)

export const TestTypeBadge = ({ type, className }: { type: string; className?: string }) => (
  <CommonBadge type="testType" value={type} className={className} />
)

export const DifficultyBadge = ({ difficulty, className }: { difficulty: string; className?: string }) => (
  <CommonBadge type="difficulty" value={difficulty} className={className} />
)

export const LocaleBadge = ({ locale, className }: { locale: string; className?: string }) => (
  <CommonBadge type="locale" value={locale} className={className} />
)

export const PlanBadge = ({ plan, className }: { plan: string; className?: string }) => (
  <CommonBadge type="plan" value={plan} className={className} />
)

export const InvoiceStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <CommonBadge type="invoiceStatus" value={status} className={className} />
)

export const CountBadge = ({ 
  type, 
  count, 
  className 
}: { 
  type: 'employees' | 'questions' | 'attempts'; 
  count: number; 
  className?: string 
}) => {
  const config = getCountBadge(type, count)
  return (
    <Badge 
      variant={config.variant}
      className={className}
    >
      {config.label}
    </Badge>
  )
}
