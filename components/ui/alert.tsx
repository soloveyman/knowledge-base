import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-3xl border p-4 [&>svg+div]:ml-9 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-5 [&>svg]:text-foreground flex gap-3",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & {
    live?: 'polite' | 'assertive' | 'off'
  }
>(({ className, variant, live = 'polite', ...props }, ref) => {
  const isError = variant === 'destructive'
  const ariaLive = isError ? 'assertive' : live === 'off' ? undefined : live
  
  return (
    <div
      ref={ref}
      role={isError ? "alert" : "status"}
      aria-live={ariaLive}
      aria-atomic="true"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
})
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed wrap-break-word", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
