"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface GreetingCardProps {
  name?: string
  description?: string
  message?: string
  className?: string
  greetingType?: 'default' | 'unfinished' | 'successful'
}

export function GreetingCard({ name, description, message, className, greetingType = 'default' }: GreetingCardProps) {
  // If message is provided, use it directly (it already contains emoji and name)
  if (message) {
    const emojiMatch = message.match(/^([^\s]+)\s(.*)$/)
    const emoji = emojiMatch ? emojiMatch[1] : '👋'
    const text = emojiMatch ? emojiMatch[2] : message
    
    return (
      <Card className={cn(
        "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border pt-4 pb-3 md:py-6",
        className
      )}>
        <CardContent>
          <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
            {emoji} {text}
          </h2>
        </CardContent>
      </Card>
    )
  }
  
  // Fallback to old format if message not provided
  const getGreetingEmoji = () => {
    switch (greetingType) {
      case 'unfinished':
        return '🚀'
      case 'successful':
        return '🎉'
      default:
        return '👋'
    }
  }

  return (
    <Card className={cn(
      "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border pt-4 pb-3 md:py-6",
      className
    )}>
      <CardContent>
        <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
          {getGreetingEmoji()} {name}
        </h2>
        {description && (
          <p className="text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

