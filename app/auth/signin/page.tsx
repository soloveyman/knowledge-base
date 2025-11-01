"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Building2, Eye, EyeOff } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [honeypot, setHoneypot] = useState("") // Honeypot field for bot detection
  const router = useRouter()
  const { t } = useTranslation()

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
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] p-4">
      <Card className="w-full max-w-md bg-card/95 border-border">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">{t('knowledgeBasePlatform')}</CardTitle>
            <CardDescription>
              {t('signInToAccess')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <Label htmlFor="password">{t('password')} *</Label>
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
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? 'Sign Up' : t('signIn')}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError("") }}
                className="underline hover:text-foreground"
              >
                {isRegister ? 'Have an account? Sign in' : 'No account? Sign up'}
              </button>
            </div>
          </form>
          
          {/* Social login temporarily disabled */}
        </CardContent>
      </Card>
    </div>
  )
}
