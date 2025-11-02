"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"
import Link from "next/link"

function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setError(t('resetLinkInvalid'))
      return
    }

    // Verify token is valid
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${token}`)
        const data = await res.json()
        
        if (!res.ok || !data.valid) {
          setTokenValid(false)
          setError(data.error || t('resetLinkExpired'))
          return
        }
        
        setTokenValid(true)
      } catch (error) {
        setTokenValid(false)
        setError(t('resetLinkInvalid'))
      }
    }

    verifyToken()
  }, [token, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      setError(t('resetLinkInvalid'))
      return
    }

    if (password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        setError(data.error || 'Failed to reset password')
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)
      
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('errorOccurred'))
      setIsLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
        <Card className="w-full max-w-md bg-card/95 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
      <Card className="w-full max-w-md bg-card/95 border-border">
        <CardHeader className="text-center space-y-4">
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold justify-center">{t('resetPasswordTitle')}</CardTitle>
            <CardDescription className="text-center">
              {t('resetPasswordDescription')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success ? (
            <Alert>
              <AlertDescription>{t('resetPasswordSuccess')}</AlertDescription>
            </Alert>
          ) : tokenValid ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">{t('newPassword')} *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('enterNewPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={8}
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
                <p className="text-xs text-muted-foreground">
                  {password.length > 0 && password.length < 8 && (
                    <span className="text-destructive">
                      {t('passwordTooShort')} ({password.length}/8)
                    </span>
                  )}
                  {password.length >= 8 && (
                    <span className="text-green-600">Password length is valid</span>
                  )}
                  {password.length === 0 && t('passwordTooShort')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')} *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('enterConfirmPassword')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    {t('passwordsDoNotMatch')}
                  </p>
                )}
              </div>
              
              <Button type="submit" className="w-full min-w-[96px]" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('resetPassword')}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{error}</p>
              <Link
                href="/auth/forgot-password"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
              >
                Request a new reset link
              </Link>
            </div>
          )}
          
          <div className="text-center text-sm mt-6">
            <Link
              href="/auth/signin"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
          <Card className="w-full max-w-md bg-card/95 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
