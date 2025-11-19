"use client"

import { useState, useEffect } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"
import { useEmailValidation } from "@/lib/hooks/use-email-validation"
import { validationRules, validateField } from "@/lib/validation"
import { isDisposableEmail } from "@/lib/disposable-email"
import { useFocusOnError, useErrorAnnouncement } from "@/lib/hooks/use-focus-management"
import { useId } from "react"

export function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [honeypot, setHoneypot] = useState("") // Honeypot field for bot detection
  const [hasFailedAttempt, setHasFailedAttempt] = useState(false) // Track if login failed
  const [successMessage, setSuccessMessage] = useState("") // Success message for registration
  
  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  
  const router = useRouter()
  const { t } = useTranslation()
  const formErrorId = useId()
  
  // Email validation hook (only for registration)
  const emailValidation = useEmailValidation(email, 500, !isRegister)
  
  // Focus management for errors
  useFocusOnError(fieldErrors, formErrorId)
  useErrorAnnouncement(fieldErrors, error)
  
  // Reset validation state when switching modes
  useEffect(() => {
    if (!isRegister) {
      setTouched({})
      setFieldErrors({})
      setError('')
      setSuccessMessage('')
    }
  }, [isRegister])
  
  // Validate fields in real-time
  // Extract specific properties from emailValidation to avoid infinite loop
  const emailValidationError = emailValidation.error
  const emailValidationIsAvailable = emailValidation.isAvailable
  
  useEffect(() => {
    if (!isRegister) return
    
    const errors: Record<string, string> = {}
    
    // Validate email
    if (touched.email || email.length > 0) {
      const emailError = validateField(email, [validationRules.required, validationRules.email])
      if (emailError) {
        errors.email = emailError
      } else if (isDisposableEmail(email)) {
        errors.email = 'Disposable/temporary email addresses are not allowed. Please use a real email address.'
      } else if (emailValidationError) {
        errors.email = emailValidationError
      } else if (emailValidationIsAvailable === false) {
        errors.email = 'This email is already registered'
      }
    }
    
    // Validate password
    if (touched.password || password.length > 0) {
      const passwordError = validateField(password, [
        validationRules.required,
        validationRules.minLength(8)
      ])
      if (passwordError) {
        errors.password = passwordError
      }
    }
    
    // Validate name (optional but if provided, should be valid)
    if (touched.name && name.trim().length > 0) {
      const nameError = validateField(name, [validationRules.maxLength(100)])
      if (nameError) {
        errors.name = nameError
      }
    }
    
    // Only update if errors actually changed (shallow comparison)
    setFieldErrors(prev => {
      const prevKeys = Object.keys(prev)
      const newKeys = Object.keys(errors)
      
      // Quick check: different number of keys means different
      if (prevKeys.length !== newKeys.length) {
        return errors
      }
      
      // Check if any values changed
      for (const key of newKeys) {
        if (prev[key] !== errors[key]) {
          return errors
        }
      }
      
      // No changes, return previous to avoid re-render
      return prev
    })
  }, [email, password, name, touched, isRegister, emailValidationError, emailValidationIsAvailable])

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
        // Mark all fields as touched
        setTouched({ email: true, password: true, name: true })
        
        // Validate all fields
        const emailError = validateField(email, [validationRules.required, validationRules.email])
        const passwordError = validateField(password, [validationRules.required, validationRules.minLength(8)])
        const nameError = name.trim() ? validateField(name, [validationRules.maxLength(100)]) : null
        
        if (emailError || passwordError || nameError) {
          setFieldErrors({
            email: emailError || '',
            password: passwordError || '',
            name: nameError || ''
          })
          setIsLoading(false)
          return
        }
        
        // Check email availability
        if (emailValidation.isAvailable === false) {
          setFieldErrors(prev => ({ ...prev, email: 'This email is already registered' }))
          setIsLoading(false)
          return
        }
        
        if (emailValidation.isChecking) {
          setFieldErrors(prev => ({ ...prev, email: 'Please wait while we check email availability...' }))
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
          // Show API errors in the email field if it's an email-related error
          const errorMessage = body?.error || `Registration failed: ${res.status} ${res.statusText}`
          if (errorMessage.toLowerCase().includes('email')) {
            setFieldErrors(prev => ({ ...prev, email: errorMessage }))
          } else {
            setError(errorMessage)
          }
          setIsLoading(false)
          return
        }
        
        // Show success message about email verification
        if (body.message) {
          setError('') // Clear any errors
          setSuccessMessage(body.message || 'Registration successful! Please check your email to verify your account.')
        }
        
        // Immediately sign in after successful registration (user can still sign in but needs to verify)
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

      // Check if email exists before attempting sign-in
      const normalizedEmail = email.toLowerCase().trim()
      const emailCheckResponse = await fetch(`/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`)
      const emailCheckData = await emailCheckResponse.json()
      
      if (!emailCheckData.exists) {
        // Email doesn't exist - suggest registration
        setError('Email not found. Would you like to create an account?')
        setIsRegister(true) // Switch to registration mode
        setIsLoading(false)
        return
      }

      // Check if user has a password (OAuth users don't have passwords)
      if (emailCheckData.hasPassword === false) {
        setError('This account was registered with Google. Please use "Sign in with Google" button to continue.')
        setIsLoading(false)
        return
      }

      // Email exists, attempt sign-in
      const result = await signIn("credentials", { email: normalizedEmail, password, redirect: false })
      if (result?.error) {
        // Email exists but password is wrong
        setError('Incorrect password. Please try again or use "Forgot Password"')
        setHasFailedAttempt(true) // Show forgot password link after failed attempt
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
    } catch (error) {
      setError(error instanceof Error ? error.message : t('errorOccurred'))
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
      <Card className="w-full max-w-md bg-card/95 border-border">
        <CardHeader className="text-center space-y-4">
          <div className="space-y-1 text-center">
            {/* Logo */}
            <div className="flex justify-center">
              <Image
                src="/Uppstaff_logo.svg"
                alt="Logo"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-4">
              <CardTitle className="text-4xl font-bold justify-center">{t('knowledgeBasePlatform')}</CardTitle>
              <CardDescription className="text-center">
                {t('signInToAccess')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
            {successMessage && (
              <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}
            {error && !isRegister && (
              <Alert 
                variant={
                  error.includes('not found') || 
                  error.includes('create an account') || 
                  error.includes('registered with Google')
                    ? "default" 
                    : "destructive"
                }
                id={formErrorId}
              >
                <AlertDescription>
                  {error}
                  {error.includes('not found') && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsRegister(true)
                          setError('')
                        }}
                        className="w-full"
                        aria-label="Create a new account"
                      >
                        Create Account
                      </Button>
                    </div>
                  )}
                </AlertDescription>
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
                <Label htmlFor="name">Name (optional)</Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                    className={touched.name && fieldErrors.name ? "border-destructive" : ""}
                    aria-invalid={touched.name && fieldErrors.name ? "true" : "false"}
                    aria-describedby={touched.name && fieldErrors.name ? "name-error" : undefined}
                  />
                  {touched.name && name.trim().length > 0 && !fieldErrors.name && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" aria-hidden="true" />
                  )}
                  {touched.name && fieldErrors.name && (
                    <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-hidden="true" />
                  )}
                </div>
                {touched.name && fieldErrors.name && (
                  <p id="name-error" className="text-xs text-destructive" role="alert" aria-live="polite">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')} *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('enterYourEmail')}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setTouched(prev => ({ ...prev, email: true }))
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  className={`pl-10 ${touched.email && fieldErrors.email ? "border-destructive" : ""} ${isRegister && touched.email && !fieldErrors.email && emailValidation.isAvailable === true ? "border-green-500" : ""}`}
                  required
                  aria-invalid={touched.email && fieldErrors.email ? "true" : "false"}
                  aria-describedby={[
                    touched.email && fieldErrors.email ? "email-error" : null,
                    isRegister && touched.email && !fieldErrors.email && emailValidation.isAvailable === true ? "email-success" : null
                  ].filter(Boolean).join(' ') || undefined}
                />
                {isRegister && touched.email && (
                  <>
                    {emailValidation.isChecking && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" aria-label="Checking email availability" />
                    )}
                    {!emailValidation.isChecking && emailValidation.isAvailable === true && !fieldErrors.email && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" aria-hidden="true" />
                    )}
                    {!emailValidation.isChecking && (fieldErrors.email || emailValidation.isAvailable === false) && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                  </>
                )}
              </div>
              {touched.email && fieldErrors.email && (
                <p id="email-error" className="text-xs text-destructive" role="alert" aria-live="polite">
                  {fieldErrors.email}
                </p>
              )}
              {isRegister && touched.email && !fieldErrors.email && emailValidation.isAvailable === true && (
                <p id="email-success" className="text-xs text-green-600" role="status" aria-live="polite">
                  Email is available
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')} *</Label>
                {!isRegister && hasFailedAttempt && (
                  <a
                    href="/auth/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    aria-label="Reset your password"
                  >
                    {t('forgotPassword')}
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('enterYourPassword')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setTouched(prev => ({ ...prev, password: true }))
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                  className={`pl-10 ${isRegister && touched.password ? "pr-16" : "pr-10"} ${touched.password && fieldErrors.password ? "border-destructive" : ""} ${isRegister && touched.password && !fieldErrors.password && password.length >= 8 ? "border-green-500" : ""}`}
                  minLength={isRegister ? 8 : undefined}
                  required
                  aria-invalid={touched.password && fieldErrors.password ? "true" : "false"}
                  aria-describedby={[
                    touched.password && fieldErrors.password ? "password-error" : null,
                    isRegister && touched.password && !fieldErrors.password && password.length >= 8 ? "password-success" : null,
                    isRegister && password.length > 0 && password.length < 8 ? "password-hint" : null
                  ].filter(Boolean).join(' ') || undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${isRegister && touched.password ? "right-10" : "right-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded`}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
                {isRegister && touched.password && !fieldErrors.password && password.length >= 8 && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" aria-hidden="true" />
                )}
                {isRegister && touched.password && fieldErrors.password && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-hidden="true" />
                )}
              </div>
              {touched.password && fieldErrors.password && (
                <p id="password-error" className="text-xs text-destructive" role="alert" aria-live="polite">
                  {fieldErrors.password}
                </p>
              )}
              {isRegister && touched.password && !fieldErrors.password && password.length >= 8 && (
                <p id="password-success" className="text-xs text-green-600" role="status" aria-live="polite">
                  Password is valid
                </p>
              )}
              {isRegister && password.length > 0 && password.length < 8 && (
                <p id="password-hint" className="text-xs text-muted-foreground" role="note">
                  Password must be at least 8 characters ({password.length}/8)
                </p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full min-w-[96px]" 
              disabled={isLoading || (isRegister && (Object.keys(fieldErrors).length > 0 || emailValidation.isChecking || emailValidation.isAvailable === false))}
              aria-busy={isLoading}
              aria-disabled={isLoading || (isRegister && (Object.keys(fieldErrors).length > 0 || emailValidation.isChecking || emailValidation.isAvailable === false))}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              <span aria-live="polite">{isRegister ? t('signUp') : t('signIn')}</span>
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
            aria-label="Sign in with Google"
            aria-busy={isGoogleLoading}
          >
            {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
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
              onClick={() => { 
                setIsRegister(!isRegister)
                setError("")
                setSuccessMessage("")
                setTouched({})
                setFieldErrors({})
              }}
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

