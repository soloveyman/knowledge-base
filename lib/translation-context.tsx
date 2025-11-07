"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { IntlProvider } from 'react-intl'
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
  // Always start with 'en' to avoid hydration mismatch
  // Then update to saved/detected language after mount
  const [language, setLanguage] = useState<Language>('en')
  const [isMounted, setIsMounted] = useState(false)

  // Initialize language after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
    
    // Check localStorage first
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ru')) {
      setLanguage(savedLanguage)
      return
    }
    
    // No saved language, detect from browser region
    const detected = detectBrowserLanguage()
    setLanguage(detected)
    localStorage.setItem('language', detected)
  }, [])

  // Save language to localStorage when it changes (after initial mount)
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return
    localStorage.setItem('language', language)
  }, [language, isMounted])

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key
  }

  // Map language codes to react-intl locale codes
  const intlLocale = language === 'ru' ? 'ru-RU' : 'en-US'

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      <IntlProvider locale={intlLocale} defaultLocale="en-US">
        {children}
      </IntlProvider>
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
