"use client"

import { ReactNode } from "react"
import AuthSessionProvider from "@/components/providers/session-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { TranslationProvider } from "@/lib/translation-context"
import { Toaster } from "@/components/ui/sonner"

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  // Always render providers - they handle SSR internally
  // This prevents build-time errors while still avoiding hydration mismatches
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TranslationProvider>
        <AuthSessionProvider>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </TranslationProvider>
    </ThemeProvider>
  )
}

