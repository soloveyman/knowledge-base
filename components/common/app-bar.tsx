"use client"

import { UserMenu } from "./user-menu"
import { useTranslation } from "@/lib/translation-context"

interface AppBarProps {
  role: 'super-admin' | 'owner' | 'manager' | 'employee'
  onSignOut?: () => void
  user?: {
    name?: string
    email?: string
    image?: string
  }
}

export function AppBar({ role, onSignOut, user }: AppBarProps) {
  const { t } = useTranslation()

  const getTitle = () => {
    switch (role) {
      case 'super-admin':
        return 'Super Admin Dashboard'
      case 'owner':
        return t('ownerDashboard')
      case 'manager':
        return t('managerDashboard')
      case 'employee':
        return t('employeeDashboard')
      default:
        return 'Dashboard'
    }
  }

  const title = getTitle()

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
              {title}
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <UserMenu user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </div>
    </header>
  )
}
