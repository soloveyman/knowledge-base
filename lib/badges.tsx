import React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useBadgeTranslation } from "./badge-translations"

// Badge variant types
export type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info"

// Common badge types and their configurations
export const BADGE_CONFIGS = {
  // Status badges
  status: {
    active: { variant: "success" as const, label: "Active" },
    inactive: { variant: "secondary" as const, label: "Inactive" },
    failed: { variant: "secondary" as const, label: "Failed" },
    pending: { variant: "warning" as const, label: "Pending" },
    completed: { variant: "success" as const, label: "Completed" },
    ready: { variant: "success" as const, label: "Ready" },
    draft: { variant: "outline" as const, label: "Draft" },
    published: { variant: "success" as const, label: "Published" },
    archived: { variant: "secondary" as const, label: "Archived" },
  },
  
  // Role badges
  role: {
    employee: { variant: "outline" as const, label: "Employee" },
    manager: { variant: "info" as const, label: "Manager" },
    owner: { variant: "default" as const, label: "Owner" },
    admin: { variant: "destructive" as const, label: "Admin" },
  },
  
  // Document types
  documentType: {
    pdf: { variant: "outline" as const, label: "PDF" },
    docx: { variant: "outline" as const, label: "DOCX" },
    txt: { variant: "outline" as const, label: "TXT" },
    html: { variant: "outline" as const, label: "HTML" },
    markdown: { variant: "outline" as const, label: "Markdown" },
  },
  
  // Test types
  testType: {
    multiple_choice: { variant: "outline" as const, label: "Multiple Choice" },
    true_false: { variant: "outline" as const, label: "True/False" },
    short_answer: { variant: "outline" as const, label: "Short Answer" },
    essay: { variant: "outline" as const, label: "Essay" },
  },
  
  // Difficulty levels
  difficulty: {
    easy: { variant: "success" as const, label: "Easy" },
    medium: { variant: "warning" as const, label: "Medium" },
    hard: { variant: "destructive" as const, label: "Hard" },
  },
  
  // Locale badges
  locale: {
    en: { variant: "secondary" as const, label: "English" },
    es: { variant: "secondary" as const, label: "Spanish" },
    fr: { variant: "secondary" as const, label: "French" },
    de: { variant: "secondary" as const, label: "German" },
  },
  
  // Subscription plans
  plan: {
    basic: { variant: "outline" as const, label: "Basic" },
    pro: { variant: "info" as const, label: "Pro" },
    enterprise: { variant: "default" as const, label: "Enterprise" },
  },
  
  // Invoice status
  invoiceStatus: {
    paid: { variant: "success" as const, label: "Paid" },
    pending: { variant: "warning" as const, label: "Pending" },
    failed: { variant: "destructive" as const, label: "Failed" },
    refunded: { variant: "secondary" as const, label: "Refunded" },
  },
  
  // Count badges
  count: {
    employees: { variant: "outline" as const, label: (count: number) => `${count} employee${count !== 1 ? 's' : ''}` },
    questions: { variant: "outline" as const, label: (count: number) => `${count} question${count !== 1 ? 's' : ''}` },
    attempts: { variant: "outline" as const, label: (count: number) => `${count} attempt${count !== 1 ? 's' : ''}` },
  },
  
  // Special badges
  special: {
    new: { variant: "success" as const, label: "New" },
    popular: { variant: "default" as const, label: "Most Popular" },
    updated: { variant: "info" as const, label: "Updated" },
  },
} as const

// Badge variant styles (extending the existing badge component)
export const badgeVariantStyles = {
  success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  warning: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  failed: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
}

// Utility function to format plan names
function formatPlanName(plan: string): string {
  // Split by hyphen or underscore, capitalize first letter of each word, join with space
  return plan
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Utility functions for creating badges
export function getBadgeConfig(type: keyof typeof BADGE_CONFIGS, key: string) {
  const config = BADGE_CONFIGS[type]
  // For plan badges, format the label if not found in config
  if (type === 'plan' && !config[key as keyof typeof config]) {
    return { variant: "outline" as const, label: formatPlanName(key) }
  }
  return config[key as keyof typeof config] || { variant: "outline" as const, label: key }
}

export function getStatusBadge(status: string) {
  return getBadgeConfig('status', status.toLowerCase())
}

export function getRoleBadge(role: string) {
  return getBadgeConfig('role', role.toLowerCase())
}

export function getDocumentTypeBadge(type: string) {
  return getBadgeConfig('documentType', type.toLowerCase())
}

export function getTestTypeBadge(type: string) {
  return getBadgeConfig('testType', type.toLowerCase())
}

export function getDifficultyBadge(difficulty: string) {
  return getBadgeConfig('difficulty', difficulty.toLowerCase())
}

export function getLocaleBadge(locale: string) {
  return getBadgeConfig('locale', locale.toLowerCase())
}

export function getPlanBadge(plan: string) {
  return getBadgeConfig('plan', plan.toLowerCase())
}

export function getInvoiceStatusBadge(status: string) {
  return getBadgeConfig('invoiceStatus', status.toLowerCase())
}

export function getCountBadge(type: 'employees' | 'questions' | 'attempts', count: number) {
  const config = BADGE_CONFIGS.count[type]
  return {
    variant: config.variant,
    label: typeof config.label === 'function' ? config.label(count) : config.label
  }
}

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
