"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useTranslation } from "@/lib/translation-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  LogOut, 
  Palette, 
  Globe,
  Sun,
  Moon,
  ChevronRight,
  HelpCircle
} from "lucide-react"

interface UserMenuProps {
  user?: {
    name?: string
    email?: string
    image?: string
  }
  onSignOut?: () => void
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useTranslation()

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut()
    } else {
      signOut({ callbackUrl: "/auth/signin" })
    }
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'en' | 'ru')
  }

  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  const getThemeIcon = () => {
    return theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
  }

  const getThemeLabel = () => {
    return theme === 'light' ? 'Light' : 'Dark'
  }

  const getCurrentLanguage = () => {
    return language === 'en' ? 'English' : 'Русский'
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage src={user.image} alt={user.name || user.email || "User"} />
          <AvatarFallback className="bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-[12rem] sm:w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Language Selection */}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="mr-2 text-sm flex items-center justify-center w-4 h-4">
                {language === 'en' ? '🇺🇸' : '🇷🇺'}
              </span>
              <span className="flex items-center justify-center">
                {language === 'en' ? 'English' : 'Русский'}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem className="flex items-center" onClick={() => handleLanguageChange('en')}>
                <span className="mr-2 text-sm flex items-center justify-center w-4 h-4">🇺🇸</span>
                English
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center" onClick={() => handleLanguageChange('ru')}>
                <span className="mr-2 text-sm flex items-center justify-center w-4 h-4">🇷🇺</span>
                Русский
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        {/* Theme Selection */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun className="h-4 w-4 mr-2" />
            {t('light')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon className="h-4 w-4 mr-2" />
            {t('dark')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        {/* Customer Support */}
        <DropdownMenuItem asChild>
          <a 
            href="mailto:uppstaffknowledge@gmail.com?subject=Support Request"
            className="flex items-center cursor-pointer"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            {t('customerSupport')}
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Sign Out */}
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="h-4 w-4 mr-2" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
