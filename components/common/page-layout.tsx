"use client"

import { ReactNode } from "react"
import { PageHeader } from "./page-header"

interface PageLayoutProps {
  title: string
  icon: ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  children: ReactNode
}

export function PageLayout({ 
  title, 
  icon, 
  onClose, 
  showCloseButton = true, 
  children 
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title={title}
        icon={icon}
        onClose={onClose}
        showCloseButton={showCloseButton}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
