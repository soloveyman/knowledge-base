"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface PageHeaderProps {
  title: string
  icon?: React.ReactNode
  onClose?: () => void
  showCloseButton?: boolean
}

export function PageHeader({ title, icon, onClose, showCloseButton = true }: PageHeaderProps) {
  return (
    <header className="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-50 supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/Uppstaff_logo.svg"
              alt="Logo"
              width={38}
              height={38}
              className="object-contain flex-shrink-0"
              priority
              sizes="38px"
              quality={90}
            />
            <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
              {title}
            </h1>
          </div>
          {showCloseButton && onClose && (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
