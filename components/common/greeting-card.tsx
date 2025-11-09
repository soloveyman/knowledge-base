"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/translation-context"
import { useMemo } from "react"
import type { TranslationKey } from "@/lib/translations"

interface GreetingCardProps {
  name?: string
  className?: string
}

export function GreetingCard({ name, className }: GreetingCardProps) {
  const { t } = useTranslation()
  
  // Randomly select a greeting phrase (1-20)
  const greetingKey = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * 20) + 1
    return `greeting${randomIndex}` as TranslationKey
  }, [])
  
  const greeting = t(greetingKey)
  
  return (
    <Card className={cn(
      "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border h-20 flex",
      className
    )}>
      <CardContent className="flex flex-col justify-center">
        <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2 whitespace-nowrap">
          {greeting}<span className="hidden md:inline">, {name || 'User'}</span>!
        </h2>
      </CardContent>
    </Card>
  )
}
