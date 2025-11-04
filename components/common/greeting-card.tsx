"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

interface GreetingCardProps {
  name?: string
  description?: string
  message?: string
  className?: string
  greetingType?: 'default' | 'unfinished' | 'successful'
}

// Component that checks if title text overflows and applies smaller font on mobile if needed
function ResponsiveTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      if (titleRef.current && window.innerWidth < 640) {
        // Temporarily apply text-2xl to measure overflow with original size
        const originalClasses = titleRef.current.className
        titleRef.current.className = cn(
          "font-bold text-foreground dark:text-white mb-2 text-2xl"
        )
        
        // Force a reflow to get accurate measurements
        void titleRef.current.offsetWidth
        
        const isOverflow = titleRef.current.scrollWidth > titleRef.current.clientWidth
        
        // Restore original classes
        titleRef.current.className = originalClasses
        
        setIsOverflowing(isOverflow)
      } else {
        setIsOverflowing(false)
      }
    }

    // Check after render and resize
    const timeoutId = setTimeout(checkOverflow, 50)
    window.addEventListener('resize', checkOverflow)

    return () => {
      window.removeEventListener('resize', checkOverflow)
      clearTimeout(timeoutId)
    }
  }, [children])

  return (
    <h2
      ref={titleRef}
      className={cn(
        "font-bold text-foreground dark:text-white mb-2",
        isOverflowing ? "text-lg sm:text-2xl" : "text-2xl",
        className
      )}
    >
      {children}
    </h2>
  )
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
      
      const hasDescription = !!descriptionPart
      
      return (
        <Card className={cn(
          "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border h-20 flex",
          className
        )}>
          <CardContent className="flex flex-col justify-center">
            <ResponsiveTitle>
              {emoji} {titlePart}
            </ResponsiveTitle>
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
        "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border h-20 flex",
        className
      )}>
        <CardContent className="flex flex-col justify-center">
          <ResponsiveTitle>
            👋 {message}
          </ResponsiveTitle>
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

  const hasDescription = !!description
  
  return (
    <Card className={cn(
      "mb-4 md:mb-6 bg-gradient-to-br from-card to-blue-400/50 dark:to-blue-800/30 border-border h-20 flex",
      className
    )}>
      <CardContent className="flex flex-col justify-center">
        <ResponsiveTitle>
          {getGreetingEmoji()} {name}
        </ResponsiveTitle>
        {description && (
          <p className="text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

