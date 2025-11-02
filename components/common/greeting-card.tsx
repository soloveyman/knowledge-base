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
    // Find emoji in the message (🚀, 🎉, 👋, etc.)
    const emojiRegex = /([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/u
    const emojiMatch = message.match(emojiRegex)
    
    if (emojiMatch && emojiMatch.index !== undefined) {
      const emoji = emojiMatch[0]
      const emojiIndex = emojiMatch.index
      
      // Split message at emoji position
      const titlePart = message.substring(0, emojiIndex).trim()
      const descriptionPart = message.substring(emojiIndex + emoji.length).trim()
      
      return (
        <Card className={cn(
          "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border pt-4 pb-3 md:py-6",
          className
        )}>
          <CardContent>
            <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
              {emoji} {titlePart}
            </h2>
            {descriptionPart && (
              <p className="text-muted-foreground">
                {descriptionPart}
              </p>
            )}
          </CardContent>
        </Card>
      )
    }
    
    // Fallback if no emoji found
    return (
      <Card className={cn(
        "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border pt-4 pb-3 md:py-6",
        className
      )}>
        <CardContent>
          <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2">
            👋 {message}
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

