"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, Language, TranslationKey } from '@/lib/translations'

interface TranslationContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ru')) {
      // Use setTimeout to defer the state update
      setTimeout(() => {
        setLanguage(savedLanguage)
      }, 0)
    }
  }, [])

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

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
