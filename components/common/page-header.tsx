"use client"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface PageHeaderProps {
  title: string
  icon: React.ReactNode
  onClose?: () => void
  showCloseButton?: boolean
}

export function PageHeader({ title, icon, onClose, showCloseButton = true }: PageHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center min-w-0">
            <div className="h-8 w-8 text-blue-600 mr-3 shrink-0">
              {icon}
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {title}
            </h1>
          </div>
          {showCloseButton && onClose && (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
