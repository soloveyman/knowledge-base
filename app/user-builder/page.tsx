"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/form-field"
import { useTranslation } from "@/lib/translation-context"
import { useFormValidation } from "@/lib/hooks/use-form-validation"
import { validationRules, validateField } from "@/lib/validation"
import { useEmailValidation } from "@/lib/hooks/use-email-validation"
import { useUsageLimits } from "@/lib/hooks/use-usage-limits"
import { isDisposableEmail } from "@/lib/disposable-email"
import { toast } from "sonner"
import { 
  Users, 
  X, 
  Loader2,
  Save,
  UserPlus,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react"

interface User {
  id: string
  name: string
  job: string
  email: string
  password: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

interface UserConfig {
  name: string
  job: string
  email: string
  password: string
  role: string
}

export default function UserBuilderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  
  const [isCreating, setIsCreating] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { limits } = useUsageLimits()
  const isUserLimitDisabled = limits?.users.expired ?? false

  // Generate random password
  const generateRandomPassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    const values = new Uint32Array(length)
    crypto.getRandomValues(values)
    for (let i = 0; i < length; i++) {
      password += charset[values[i] % charset.length]
    }
    setValue('password', password)
    setFieldTouched('password')
    clearFieldError('password')
  }
  
  // Validation setup
  const initialFormData = {
    name: "",
    job: "",
    email: "",
    password: "",
    role: ""
  } satisfies UserConfig
  
  const validation = useFormValidation({
    name: [validationRules.required],
    job: [validationRules.required],
    email: [validationRules.required, validationRules.email],
    password: [
      // Required only if not in edit mode
      ...(isEditMode ? [] : [validationRules.required]),
      validationRules.minLength(6)
    ],
    role: [validationRules.required]
  }, initialFormData)
  
  const { values, errors, touched, setValue, setFieldTouched, clearFieldError, validateAll, validateField } = validation
  
  // Email validation hook (only for new users, not editing)
  const emailValidation = useEmailValidation(values.email, 500, isEditMode, t)
  
  // Sync validation values with userConfig for backwards compatibility
  const userConfig: UserConfig = {
    name: values.name,
    job: values.job,
    email: values.email,
    password: values.password,
    role: values.role
  }
  
  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Check if we're in edit mode via URL parameter
    const urlParams = new URLSearchParams(window.location.search)
    const editingId = urlParams.get('edit')
    if (editingId) {
      setIsEditMode(true)
      setEditingUserId(editingId)
      loadUserForEditing(editingId)
    }
  }, [session, status, router])

  const loadUserForEditing = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        toast.error(t('serverInvalidResponse'), {
          duration: 5000
        })
        return
      }
      
      const result = await response.json()
      
      if (result.success && result.data.user) {
        const user = result.data.user
        validation.setValue('name', user.name || '')
        validation.setValue('job', user.job || '')
        validation.setValue('email', user.email || '')
        validation.setValue('password', '') // New password field
        validation.setValue('role', user.role || 'employee')
      } else {
        toast.error(t('failedToLoadUserData'), {
          duration: 5000
        })
      }
    } catch (error) {
      console.error('Error loading user for editing:', error)
      toast.error(t('failedToLoadUserForEditing'), {
        duration: 5000
      })
    }
  }

  const handleCreateUser = async () => {
    // Prevent double submission
    if (isCreating) {
      return
    }

    // Check if session is ready
    if (status !== 'authenticated' || !session) {
      toast.error('Please wait while we verify your session...', { duration: 3000 })
      return
    }

    // Check if businessId is available (required for tenant isolation)
    if (!session.user?.businessId) {
      toast.error('Session error: missing tenant information. Please try refreshing the page.', { duration: 5000 })
      console.error('Session missing businessId:', { session: session?.user, status })
      return
    }

    // Check usage limit for new users (not for editing)
    if (!isEditMode && isUserLimitDisabled) {
      toast.error(
        `User limit reached (${limits?.users.current}/${limits?.users.max}). Please upgrade your plan to continue.`,
        { duration: 5000 }
      )
      return
    }

    // For new users, check if email validation is still in progress
    if (!isEditMode && emailValidation.isChecking) {
      toast.error('Please wait for email validation to complete...', { duration: 3000 })
      return
    }

    // For new users, check if email is available
    if (!isEditMode && emailValidation.isAvailable === false) {
      toast.error('This email is already registered. Please use a different email address.', { duration: 5000 })
      return
    }

    // For new users, check if there's an email validation error
    if (!isEditMode && emailValidation.error) {
      toast.error(emailValidation.error, { duration: 5000 })
      return
    }

    // Check if email is disposable (for new users)
    if (!isEditMode && isDisposableEmail(userConfig.email)) {
      toast.error('Disposable/temporary email addresses are not allowed. Please use a real email address.', { duration: 5000 })
      return
    }

    // Validate all fields
    if (!validateAll()) {
      return
    }

    setIsCreating(true)

    try {
      if (isEditMode && editingUserId) {
        // Update existing user via API
        const response = await fetch(`/api/users/${editingUserId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: userConfig.name,
            job: userConfig.job,
            email: userConfig.email,
            password: userConfig.password, // Will be ignored if empty
            role: userConfig.role,
          }),
        })

        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('Non-JSON response:', text.substring(0, 200))
          throw new Error('Server returned an invalid response. Please try again.')
        }

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Failed to update user')
        }

        toast.success(t('userUpdatedSuccessfully'))
      } else {
        // Create new user via API
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: userConfig.name,
            job: userConfig.job,
            email: userConfig.email,
            password: userConfig.password,
            role: userConfig.role,
          }),
        })

        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('Non-JSON response:', text.substring(0, 200))
          throw new Error('Server returned an invalid response. Please try again.')
        }

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || 'Failed to create user')
        }

        // Show success message with verification info
        const successMsg = result.message || 'User created successfully!'
        toast.success(successMsg)
        
        // Fetch users immediately after save to ensure they're in the database
        // Store in sessionStorage so owner page can use it immediately
        try {
          const usersResponse = await fetch('/api/users', { cache: 'no-store' })
          const usersResult = await usersResponse.json()
          if (usersResult.success && typeof window !== 'undefined') {
            // Store in sessionStorage for immediate use by owner page
            sessionStorage.setItem('pendingUsersRefresh', JSON.stringify({
              data: usersResult.data.users,
              timestamp: Date.now()
            }))
          }
        } catch (error) {
          console.error('Failed to fetch users after save:', error)
          // Continue anyway - owner page will fetch on load
        }
      }

      // Determine where to return after create/update.
      // Prefer explicit returnTo query param, otherwise use role-based default.
      const urlParams = new URLSearchParams(window.location.search)
      const explicitReturnTo = urlParams.get('returnTo')
      
      const fallbackReturnTo =
        session.user.role === 'manager'
          ? '/manager?tab=users'
          : '/owner?tab=users'

      const target = explicitReturnTo || fallbackReturnTo

      router.replace(`${target}${target.includes('?') ? '&' : '?'}_t=${Date.now()}`)
      // Small delay to ensure navigation starts
      await new Promise(resolve => setTimeout(resolve, 50))
      router.refresh()
    } catch (err) {
      console.error('Error creating/updating user:', err)
      
      let errorMessage = 'Failed to create user'
      
      if (err instanceof Error) {
        errorMessage = err.message
        
        // Provide more user-friendly error messages for common issues
        if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (err.message.includes('Unauthorized') || err.message.includes('missing tenant')) {
          errorMessage = 'Session expired. Please refresh the page and try again.'
        } else if (err.message.includes('rate limit') || err.message.includes('Too many')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.'
        }
      }
      
      toast.error(errorMessage, {
        duration: 5000
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    // Use the same returnTo logic as after save
    const urlParams = new URLSearchParams(window.location.search)
    const explicitReturnTo = urlParams.get('returnTo')
    const fallbackReturnTo =
      session?.user?.role === 'manager'
        ? '/manager?tab=users'
        : '/owner?tab=users'

    const target = explicitReturnTo || fallbackReturnTo

    router.push(`${target}${target.includes('?') ? '&' : '?'}_t=${Date.now()}`)
    // Immediately refresh to ensure data reloads (no delay for instant updates)
    router.refresh()
    // Trigger location change event immediately to force data reload
    if (typeof window !== 'undefined') {
      // Dispatch both popstate and custom locationchange event for immediate detection
      window.dispatchEvent(new Event('popstate'))
      window.dispatchEvent(new Event('locationchange'))
      // Also check window.location.search directly for immediate detection
      setTimeout(() => {
        // Force a re-check after a tiny delay to ensure URL has updated
        window.dispatchEvent(new Event('popstate'))
      }, 10)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground dark:text-white truncate">
                {isEditMode ? t('editUser') : t('userBuilder')}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 md:py-8">
        <div className="space-y-3 md:space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <CardTitle><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">👤</span> <span className="leading-none self-center">{t('userInformation')}</span></CardTitle>
                  <CardDescription>
                    {isEditMode ? t('updateUserDetailsAndRole') : t('createNewUserAccount')}
                  </CardDescription>
                </div>
                <div className="w-full sm:w-auto">
                  <Button 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleCreateUser()
                    }}
                    disabled={isCreating || status !== 'authenticated' || !session || (!isEditMode && isUserLimitDisabled)}
                    className="w-full sm:w-auto"
                  >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isEditMode ? t('updating') : t('creating')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {isEditMode ? t('updateUser') : t('createUser')}
                    </>
                  )}
                </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    label={t('fullName')}
                    required
                    error={touched.name ? errors.name : undefined}
                  >
                    <Input
                      value={userConfig.name}
                      onChange={(e) => {
                        setValue('name', e.target.value)
                        clearFieldError('name')
                      }}
                      onFocus={() => clearFieldError('name')}
                      onBlur={() => setFieldTouched('name')}
                      placeholder={t('enterFullName')}
                    />
                  </FormField>

                  <FormField
                    label={t('jobTitle')}
                    required
                    error={touched.job ? errors.job : undefined}
                  >
                    <Input
                      value={userConfig.job}
                      onChange={(e) => {
                        setValue('job', e.target.value)
                        clearFieldError('job')
                      }}
                      onFocus={() => clearFieldError('job')}
                      onBlur={() => setFieldTouched('job')}
                      placeholder={t('enterJobTitle')}
                    />
                  </FormField>

                  <FormField
                    label={t('emailAddress')}
                    required
                    error={
                      touched.email 
                        ? errors.email || 
                          (isDisposableEmail(userConfig.email) 
                            ? 'Disposable/temporary email addresses are not allowed. Please use a real email address.' 
                            : undefined) ||
                          (emailValidation.isAvailable === false && !isEditMode
                            ? 'This email is already registered'
                            : undefined) ||
                          (emailValidation.error && !isEditMode ? emailValidation.error : undefined)
                        : undefined
                    }
                  >
                    <>
                      <div className="relative">
                        <Input
                          type="email"
                          value={userConfig.email}
                          onChange={(e) => {
                            setValue('email', e.target.value)
                            setFieldTouched('email')
                            clearFieldError('email')
                          }}
                          onFocus={() => clearFieldError('email')}
                          onBlur={() => setFieldTouched('email')}
                          placeholder={t('enterEmailAddress')}
                          autoComplete="off"
                          name="new-user-email"
                          className={
                            touched.email && 
                            (errors.email || isDisposableEmail(userConfig.email) || emailValidation.isAvailable === false)
                              ? "border-destructive" 
                              : touched.email && !errors.email && !isDisposableEmail(userConfig.email) && emailValidation.isAvailable === true && !isEditMode
                              ? "border-green-500"
                              : ""
                          }
                        />
                        {!isEditMode && touched.email && emailValidation.isChecking && (
                          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {!isEditMode && touched.email && !errors.email && !isDisposableEmail(userConfig.email) && emailValidation.isAvailable === true && (
                        <p className="text-xs text-green-600 mt-1">{t('emailIsAvailable')}</p>
                      )}
                    </>
                  </FormField>

                  <FormField
                    label={t('password')}
                    required={!isEditMode}
                    error={touched.password ? errors.password : undefined}
                    helpText={isEditMode ? "(leave blank to keep current)" : undefined}
                  >
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={userConfig.password}
                        onChange={(e) => {
                          setValue('password', e.target.value)
                          clearFieldError('password')
                        }}
                        onFocus={() => clearFieldError('password')}
                        onBlur={() => setFieldTouched('password')}
                        placeholder={isEditMode ? "Enter new password (optional)" : t('enterPassword')}
                        className={!isEditMode ? "pr-20" : "pr-10"}
                      />
                      {!isEditMode && (
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          className="absolute right-10 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Generate random password"
                          title="Generate random password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>

                  <FormField
                    label={t('role')}
                    required
                    error={touched.role ? errors.role : undefined}
                  >
                    <Select 
                      value={userConfig.role} 
                      onValueChange={(value) => {
                        setValue('role', value)
                        setFieldTouched('role')
                        clearFieldError('role')
                      }}
                      onOpenChange={(open) => {
                        if (open) {
                          clearFieldError('role')
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('selectUserRole')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">{t('manager')}</SelectItem>
                        <SelectItem value="employee">{t('employee')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <div className="bg-primary/10 p-4 rounded-3xl">
                  <h4 className="font-medium text-primary-700 dark:text-primary-300 mb-2">{t('rolePermissions')}</h4>
                  <div className="text-sm text-primary-700 dark:text-primary-300 space-y-1">
                    {userConfig.role === 'manager' && (
                      <>
                        <p>• {t('createAndManageTestsAndAssignments')}</p>
                        <p>• {t('viewEmployeeProgressAndResults')}</p>
                        <p>• {t('accessManagementDashboard')}</p>
                        <p>• {t('importAndManageDocuments')}</p>
                      </>
                    )}
                    {userConfig.role === 'employee' && (
                      <>
                        <p>• {t('takeAssignedTestsAndTraining')}</p>
                        <p>• {t('viewPersonalProgressAndResults')}</p>
                        <p>• {t('accessEmployeeDashboard')}</p>
                        <p>• {t('viewAssignedDocuments')}</p>
                      </>
                    )}
                    {!userConfig.role && (
                      <p className="text-muted-foreground">{t('selectRoleToSeePermissions')}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
