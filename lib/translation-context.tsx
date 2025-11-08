"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, Language, TranslationKey } from '@/lib/translations'

interface TranslationContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

// Helper function to detect browser language based on region
function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en' // Default for SSR
  }

  // Get browser language/locale
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en'
  
  // Extract language code (e.g., 'ru' from 'ru-RU' or 'ru')
  const langCode = browserLang.split('-')[0].toLowerCase()
  
  // Map language codes to our supported languages
  // Russian/CIS countries -> 'ru'
  if (langCode === 'ru' || langCode === 'uk' || langCode === 'be' || langCode === 'kk') {
    return 'ru'
  }
  
  // Default to English for all other languages
  return 'en'
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  // Always start with 'en' to match SSR and avoid hydration mismatch
  const [language, setLanguage] = useState<Language>('en')
  const [isMounted, setIsMounted] = useState(false)

  // Initialize language after hydration to avoid mismatch
  useEffect(() => {
    setIsMounted(true)
    
    // Check localStorage first
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ru')) {
      setLanguage(savedLanguage)
      return
    }
    
    // No saved language, detect from browser region
    const detectedLanguage = detectBrowserLanguage()
    setLanguage(detectedLanguage)
  }, [])

  // Save language to localStorage when it changes (but not on initial mount)
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return
    localStorage.setItem('language', language)
  }, [language, isMounted])

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key
  }

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    // Fallback during SSR/prerender when provider isn't mounted yet
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: TranslationKey) => translations.en[key] || key
    }
  }
  return context
}
