"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

interface AppBarProps {
  role: 'owner' | 'manager' | 'employee'
  onSignOut?: () => void
}

export function AppBar({ role, onSignOut }: AppBarProps) {
  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut()
    } else {
      signOut({ callbackUrl: "/auth/signin" })
    }
  }

  const getTitle = () => {
    switch (role) {
      case 'owner':
        return 'Owner Dashboard'
      case 'manager':
        return 'Manager Dashboard'
      case 'employee':
        return 'Employee Dashboard'
      default:
        return 'Dashboard'
    }
  }

  const title = getTitle()

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {title}
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs sm:text-sm">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
