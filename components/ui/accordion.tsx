"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

interface AccordionProps {
  type?: "single" | "multiple"
  collapsible?: boolean
  children: React.ReactNode
  className?: string
}

const AccordionContext = React.createContext<{
  openItems: Set<string>
  toggleItem: (value: string) => void
  type: "single" | "multiple"
}>({
  openItems: new Set(),
  toggleItem: () => {},
  type: "single"
})

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ type = "single", collapsible = true, children, className, ...props }, ref) => {
    const [openItems, setOpenItems] = React.useState<Set<string>>(new Set())

    const toggleItem = React.useCallback((value: string) => {
      setOpenItems(prev => {
        const newSet = new Set(prev)
        if (newSet.has(value)) {
          newSet.delete(value)
        } else {
          if (type === "single") {
            newSet.clear()
          }
          newSet.add(value)
        }
        return newSet
      })
    }, [type])

    return (
      <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  }
)
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("border rounded-lg", className)} {...props}>
        {children}
      </div>
    )
  }
)
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps & { value?: string }>(
  ({ children, className, value, ...props }, ref) => {
    const { openItems, toggleItem } = React.useContext(AccordionContext)
    const itemValue = value || React.Children.toArray(children)[0]?.toString() || ""
    const isOpen = openItems.has(itemValue)

    return (
      <button
        ref={ref}
        className={cn(
          "flex w-full items-center justify-between p-4 text-left font-medium transition-all hover:bg-gray-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        onClick={() => toggleItem(itemValue)}
        {...props}
      >
        <div className="flex-1">
          {children}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>
    )
  }
)
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps & { value?: string }>(
  ({ children, className, value, ...props }, ref) => {
    const { openItems } = React.useContext(AccordionContext)
    const itemValue = value || React.Children.toArray(children)[0]?.toString() || ""
    const isOpen = openItems.has(itemValue)

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
          className
        )}
        {...props}
      >
        <div className="p-4 pt-0">
          {children}
        </div>
      </div>
    )
  }
)
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
