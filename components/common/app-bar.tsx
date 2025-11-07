"use client"

import Image from "next/image"
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
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/Uppstaff_logo.svg"
              alt="Logo"
              width={38}
              height={38}
              className="object-contain shrink-0"
              priority
              sizes="38px"
              quality={90}
            />
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
