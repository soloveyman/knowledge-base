"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface GreetingCardProps {
  name?: string
  className?: string
}

export function GreetingCard({ name, className }: GreetingCardProps) {
  return (
    <Card className={cn(
      "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border h-20 flex",
      className
    )}>
      <CardContent className="flex flex-col justify-center">
        <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2 whitespace-nowrap">
          👋 Welcome back, {name || 'User'}!
        </h2>
      </CardContent>
    </Card>
  )
}
