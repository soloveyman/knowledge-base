"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [honeypot, setHoneypot] = useState("") // Honeypot field for bot detection
  const router = useRouter()
  const { t } = useTranslation()

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError("")
    
    try {
      // For OAuth, signIn returns a URL to redirect to Google
      const result = await signIn("google", { 
        redirect: false,
        callbackUrl: window.location.origin + '/auth/callback'
      })
      
      if (result?.error) {
        setError(result.error || 'Google sign-in failed')
        setIsGoogleLoading(false)
        return
      }
      
      // OAuth providers return a URL to redirect to
      if (result?.url) {
        window.location.href = result.url
        return
      }
      
      // If no URL returned, check if already signed in
      const session = await getSession()
      if (session?.user) {
        const role = session.user.role
        if (role === 'super-admin') router.push('/super-admin')
        else if (role === 'owner') router.push('/owner')
        else if (role === 'manager') router.push('/manager')
        else router.push('/employee')
      } else {
        setIsGoogleLoading(false)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google')
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Honeypot check - if filled, it's likely a bot
    if (honeypot) {
      console.warn("Bot detected: honeypot field was filled")
      setError("Invalid request")
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    setError("")

    try {
      if (isRegister) {
        // Validate required fields
        if (!email.trim()) {
          setError('Email is required')
          setIsLoading(false)
          return
        }
        if (!password || password.length < 8) {
          setError('Password must be at least 8 characters')
          setIsLoading(false)
          return
        }
        
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase().trim(), password, name: name.trim() || undefined }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(body?.error || `Registration failed: ${res.status} ${res.statusText}`)
          setIsLoading(false)
          return
        }
        // Immediately sign in after successful registration
        const result = await signIn("credentials", { email: email.toLowerCase().trim(), password, redirect: false })
        if (result?.error) {
          setError(result.error || t('errorOccurred'))
          setIsLoading(false)
          return
        }
        // route by role
        const session = await getSession()
        const role = session?.user?.role
        if (role === 'super-admin') router.push('/super-admin')
        else if (role === 'owner') router.push('/owner')
        else if (role === 'manager') router.push('/manager')
        else router.push('/employee')
        return
      }

      const result = await signIn("credentials", { email: email.toLowerCase().trim(), password, redirect: false })
      if (result?.error) {
        setError('Invalid email or password')
        return
      }
      // route by role
      const session = await getSession()
      const role = session?.user?.role
      if (role === 'super-admin') router.push('/super-admin')
      else if (role === 'owner') router.push('/owner')
      else if (role === 'manager') router.push('/manager')
      else router.push('/employee')
      return
    } catch (error) {
      setError(error instanceof Error ? error.message : t('errorOccurred'))
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
      <Card className="w-full max-w-md bg-card/95 border-border">
        <CardHeader className="text-center space-y-4">
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold justify-center">{t('knowledgeBasePlatform')}</CardTitle>
            <CardDescription className="text-center">
              {t('signInToAccess')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot field - hidden from users but visible to bots */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')} *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('enterYourEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')} *</Label>
                {!isRegister && (
                  <a
                    href="/auth/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {t('forgotPassword')}
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('enterYourPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  minLength={isRegister ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isRegister && (
                <p className="text-xs text-muted-foreground">
                  {password.length > 0 && password.length < 8 && (
                    <span className="text-destructive">
                      Password must be at least 8 characters ({password.length}/8)
                    </span>
                  )}
                  {password.length >= 8 && (
                    <span className="text-green-600">Password length is valid</span>
                  )}
                  {password.length === 0 && 'Password must be at least 8 characters'}
                </p>
              )}
            </div>
            
            <Button type="submit" className="w-full min-w-[96px]" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? t('signUp') : t('signIn')}
            </Button>
          </form>
          
          {/* Google OAuth Sign In */}
          <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-[96px] bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-700 dark:border-gray-300"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">Sign in with Google</span>
          </Button>
          </div>
          
          <div className="text-center text-sm mt-6">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError("") }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              {isRegister ? t('haveAccountSignIn') : t('noAccountSignUp')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
