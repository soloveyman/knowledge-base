/**
 * Theme utility classes for consistent dark mode support
 * Use these instead of hardcoded Tailwind colors
 */

export const themeColors = {
  // Backgrounds
  background: "bg-background",
  card: "bg-card",
  muted: "bg-muted",
  
  // Text
  foreground: "text-foreground",
  mutedText: "text-muted-foreground",
  
  // Borders
  border: "border-border",
  
  // Interactive states
  hover: "hover:bg-accent hover:text-accent-foreground",
  
  // Flex utility
  cardHover: "hover:bg-accent dark:hover:bg-gray-800/50",
  
  // Headings
  heading: "text-foreground dark:text-white",
  
  // Subheading
  subheading: "text-foreground dark:text-gray-300",
  
} as const

/**
 * Get theme-aware classes
 */
export function getThemeClass(type: keyof typeof themeColors): string {
  return themeColors[type]
}

/**
 * Common combinations
 */
export const themeClasses = {
  pageLayout: "min-h-screen bg-background",
  header: "bg-card dark:bg-gray-900 shadow-sm border-b border-border",
  title: "text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate",
  heading2: "text-2xl font-bold text-foreground dark:text-white mb-2",
  heading3: "text-lg font-semibold text-foreground dark:text-white",
  subtext: "text-sm text-muted-foreground",
  card: "bg-card border border-border rounded-lg",
  cardHover: "border border-border rounded-lg hover:bg-accent dark:hover:bg-gray-800/50 cursor-pointer",
  buttonPrimary: "bg-primary text-primary-foreground",
  buttonSecondary: "bg-secondary text-secondary-foreground",
} as const

