"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface GreetingCardProps {
  name: string
  description: string
  className?: string
}

export function GreetingCard({ name, description, className }: GreetingCardProps) {
  return (
    <Card className={cn(
      "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 border-border/60 pt-4 pb-3 md:py-6",
      className
    )}>
      <CardContent>
        <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
          👋 {name}
        </h2>
        <p className="text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

