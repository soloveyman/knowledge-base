"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/translation-context"
import { formatDateShort } from "@/lib/date-format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlanBadge, StatusBadge, InvoiceStatusBadge } from "@/lib/badges"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { DeleteConfirmation } from "@/components/common/delete-confirmation"
import { 
  Crown, 
  Shield, 
  Zap, 
  Users, 
  FileText, 
  Brain,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Download,
  Settings,
  Calendar,
  TrendingUp,
  Lock,
  Unlock,
  Wallet
} from "lucide-react"

interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  maxUsers: number | null
  maxImportsPerMonth: number | null
  maxGenerationsPerMonth: number | null
  maxEnhancementsPerMonth: number | null
  features: string[]
  isPopular?: boolean
  isCurrent?: boolean
}

interface CurrentSubscription {
  id: string
  planId: string
  status: 'active' | 'cancelled' | 'expired'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  plan: {
    id: string
    name: string
    displayName: string
    description: string | null
    price: number | null
    currency: string | null
    interval: string | null
    features: string[] | null
    maxUsers: number | null
    maxImportsPerMonth: number | null
    maxGenerationsPerMonth: number | null
    maxEnhancementsPerMonth: number | null
  } | null
}

interface Usage {
  month: string
  importsCount: number
  generationsCount: number
  enhancementsCount: number
  usersCount: number
}

interface PaymentHistory {
  id: string
  planName: string
  startDate: string
  endDate: string
  amount: number // in cents/kopecks - will be formatted
  currency: string
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'completed'
  createdAt?: string
}

interface SubscriptionManagerProps {
  onUpgrade?: (planId: string) => void
  onCancel?: () => void
  onBilling?: () => void
}

// Module-level cache that persists across component remounts (tab switches)
let subscriptionDataCache: {
  plans: SubscriptionPlan[]
  currentSubscription: CurrentSubscription | null
  usage: Usage | null
  paymentHistory: PaymentHistory[] | null
  isStripeEnabled: boolean
} | null = null

export default function SubscriptionManager({ 
  onUpgrade, 
  onCancel, 
  onBilling 
}: SubscriptionManagerProps) {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[] | null>(null)
  const [isStripeEnabled, setIsStripeEnabled] = useState<boolean>(false)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use module-level cache (persists across component remounts)
  const dataCache = useRef(subscriptionDataCache)

  const loadSubscriptionData = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription', { cache: 'no-store' })
      const result = await response.json()
      
      if (result.success) {
        const data = {
          plans: result.data.plans,
          currentSubscription: result.data.currentSubscription,
          usage: result.data.usage,
          paymentHistory: result.data.paymentHistory || null,
          isStripeEnabled: result.data.isStripeConfigured ?? false
        }
        // Cache data for future remounts (module-level)
        subscriptionDataCache = data
        dataCache.current = data
        setPlans(data.plans)
        setCurrentSubscription(data.currentSubscription)
        setUsage(data.usage)
        setIsStripeEnabled(data.isStripeEnabled)
        setPaymentHistory(data.paymentHistory)
      } else {
        console.error('Failed to load subscription data:', result.message)
        setPlans([])
        setCurrentSubscription(null)
        setUsage(null)
        setIsStripeEnabled(false)
        setPaymentHistory(null)
      }
    } catch (error) {
      console.error('Error loading subscription data:', error)
        setPlans([])
        setCurrentSubscription(null)
        setUsage(null)
        setIsStripeEnabled(false)
        setPaymentHistory(null)
      }
  }, [])

  useEffect(() => {
    // Sync ref with module-level cache (persists across remounts)
    dataCache.current = subscriptionDataCache
    
    // Restore from cache if available (instant render on tab switch)
    if (subscriptionDataCache) {
      const cached = subscriptionDataCache
      setPlans(cached.plans)
      setCurrentSubscription(cached.currentSubscription)
      setUsage(cached.usage)
      setIsStripeEnabled(cached.isStripeEnabled)
      setPaymentHistory(cached.paymentHistory)
      // Refresh in background after a delay to avoid blocking render
      setTimeout(() => {
        loadSubscriptionData()
      }, 200)
    } else if (plans.length === 0 && !currentSubscription && !usage) {
      // Only load if no cached data and state is empty
      loadSubscriptionData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return t('free')
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price / 100)
  }

  const translateFeature = (feature: string): string => {
    // Map feature strings to translation keys
    const featureMap: Record<string, string> = {
      'Access to all features': t('accessToAllFeatures'),
      '10 team members': `10 ${t('teamMembers')}`,
      '50 document imports per month': `50 ${t('documentImportsPerMonth')}`,
      '100 AI test generations per month': `100 ${t('aiTestGenerationsPerMonth')}`,
      'Full support during trial': t('fullSupportDuringTrial'),
      'Full support': t('fullSupport'),
      '20 document imports per month': `20 ${t('documentImportsPerMonth')}`,
      '25 team members': `25 ${t('teamMembers')}`,
      '100 document imports per month': `100 ${t('documentImportsPerMonth')}`,
      '500 AI test generations per month': `500 ${t('aiTestGenerationsPerMonth')}`,
    }
    
    // Check if we have a direct translation
    if (featureMap[feature]) {
      return featureMap[feature]
    }
    
    // Try to parse dynamic features like "X team members", "X document imports per month", etc.
    const teamMembersMatch = feature.match(/^(\d+)\s+team\s+members$/i)
    if (teamMembersMatch) {
      return `${teamMembersMatch[1]} ${t('teamMembers')}`
    }
    
    const importsMatch = feature.match(/^(\d+)\s+document\s+imports\s+per\s+month$/i)
    if (importsMatch) {
      return `${importsMatch[1]} ${t('documentImportsPerMonth')}`
    }
    
    const generationsMatch = feature.match(/^(\d+)\s+AI\s+test\s+generations\s+per\s+month$/i)
    if (generationsMatch) {
      return `${generationsMatch[1]} ${t('aiTestGenerationsPerMonth')}`
    }
    
    // Return original if no translation found
    return feature
  }

  const translatePlanName = (displayName: string): string => {
    // Map plan names for consistency
    const nameMap: Record<string, string> = {
      'Starter': 'Optimal',
    }
    
    // Return mapped name if exists, otherwise return original
    return nameMap[displayName] || displayName
  }

  const translatePlanDescription = (description: string): string => {
    // Map plan descriptions to translation keys
    const descriptionMap: Record<string, string> = {
      '14-day free trial to explore all features': t('freeTrialDescription'),
      'Small teams, startups': t('starterDescription'),
      'Growing companies, medium-sized teams': t('proDescription'),
    }
    
    // Check if we have a direct translation
    if (descriptionMap[description]) {
      return descriptionMap[description]
    }
    
    // Return original if no translation found
    return description
  }

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
      case 'free-trial': return <Shield className="h-6 w-6" />
      case 'starter': return <Users className="h-6 w-6" />
      case 'pro': return <Zap className="h-6 w-6" />
      case 'business': return <Crown className="h-6 w-6" />
      default: return <Shield className="h-6 w-6" />
    }
  }

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
      case 'free-trial': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'starter': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pro': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'business': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getUsagePercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400'
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleUpgrade = async () => {
    if (!selectedPlan || !isStripeEnabled) {
      if (!isStripeEnabled) {
        alert('Payment processing is not available at this time. Please contact support.');
      }
      return;
    }
    
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.data.url;
      } else {
        console.error('Failed to create checkout session:', result.message);
        alert(result.message || 'Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('An error occurred. Please try again.');
    }
  }

  const handleCancel = async () => {
    if (!isStripeEnabled) {
      alert('Payment management is not available at this time. Please contact support.');
      return;
    }
    
    try {
      const baseUrl = window.location.origin;
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: `${baseUrl}/subscription`,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = result.data.url;
      } else {
        console.error('Failed to create portal session:', result.message);
        alert(result.message || 'Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('An error occurred. Please try again.');
    }
  }

  const handleBilling = async () => {
    if (!isStripeEnabled) {
      alert('Payment management is not available at this time. Please contact support.');
      return;
    }
    await handleCancel(); // Same as cancel - opens Stripe portal
  }

  const isLimitReached = (current: number, max: number) => {
    return current >= max
  }

  const isNearLimit = (current: number, max: number) => {
    return (current / max) >= 0.8
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">💰</span> <span className="leading-none self-center">{t('currentSubscription')}</span>
            </CardTitle>
            <CardDescription>
              {t('currentSubscriptionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6 md:pb-8">
            {currentSubscription ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">{t('planDetails')}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('plan')}:</span>
                        <PlanBadge plan={currentSubscription.plan?.name || 'unknown'} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('status')}:</span>
                        <StatusBadge status={currentSubscription.status} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('nextBilling')}:</span>
                        <span className="text-sm">
                          {formatDateShort(currentSubscription.currentPeriodEnd)}
                        </span>
                      </div>
                      {currentSubscription.cancelAtPeriodEnd && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {t('subscriptionCancelledAtPeriodEnd')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>

                  {usage && currentSubscription?.plan && (
                    <div>
                      <h4 className="font-medium mb-2">{t('currentUsage')}</h4>
                      <div className="space-y-3">
                        {currentSubscription.plan.maxUsers !== null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{t('users')}</span>
                              <span className={getUsageColor(getUsagePercentage(usage.usersCount, currentSubscription.plan.maxUsers))}>
                                {usage.usersCount}/{currentSubscription.plan.maxUsers}
                              </span>
                            </div>
                            <Progress 
                              value={getUsagePercentage(usage.usersCount, currentSubscription.plan.maxUsers)} 
                              className="h-2"
                            />
                          </div>
                        )}

                        {currentSubscription.plan.maxImportsPerMonth !== null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{t('importsThisMonth')}</span>
                              <span className={getUsageColor(getUsagePercentage(usage.importsCount, currentSubscription.plan.maxImportsPerMonth))}>
                                {usage.importsCount}/{currentSubscription.plan.maxImportsPerMonth}
                              </span>
                            </div>
                            <Progress 
                              value={getUsagePercentage(usage.importsCount, currentSubscription.plan.maxImportsPerMonth)} 
                              className="h-2"
                            />
                          </div>
                        )}

                        {currentSubscription.plan.maxGenerationsPerMonth !== null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{t('aiGenerations')}</span>
                              <span className={getUsageColor(getUsagePercentage(usage.generationsCount, currentSubscription.plan.maxGenerationsPerMonth))}>
                                {usage.generationsCount}/{currentSubscription.plan.maxGenerationsPerMonth}
                              </span>
                            </div>
                            <Progress 
                              value={getUsagePercentage(usage.generationsCount, currentSubscription.plan.maxGenerationsPerMonth)} 
                              className="h-2"
                            />
                          </div>
                        )}

                        {currentSubscription.plan.maxEnhancementsPerMonth !== null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{t('documentEnhancements')}</span>
                              <span className={getUsageColor(getUsagePercentage(usage.enhancementsCount, currentSubscription.plan.maxEnhancementsPerMonth))}>
                                {usage.enhancementsCount}/{currentSubscription.plan.maxEnhancementsPerMonth}
                              </span>
                            </div>
                            <Progress 
                              value={getUsagePercentage(usage.enhancementsCount, currentSubscription.plan.maxEnhancementsPerMonth)} 
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">{t('noActiveSubscription')}</p>
                <p className="text-sm text-muted-foreground">{t('selectPlanToGetStarted')}</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Usage Alerts */}
      {usage && currentSubscription?.plan && (
        <>
          {currentSubscription.plan.maxUsers !== null && isLimitReached(usage.usersCount, currentSubscription.plan.maxUsers) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedUserLimit')}
              </AlertDescription>
            </Alert>
          )}

          {currentSubscription.plan.maxImportsPerMonth !== null && isLimitReached(usage.importsCount, currentSubscription.plan.maxImportsPerMonth) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedImportLimit')}
              </AlertDescription>
            </Alert>
          )}

          {currentSubscription.plan.maxGenerationsPerMonth !== null && isLimitReached(usage.generationsCount, currentSubscription.plan.maxGenerationsPerMonth) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedGenerationLimit')}
              </AlertDescription>
            </Alert>
          )}

          {currentSubscription.plan.maxUsers !== null && isNearLimit(usage.usersCount, currentSubscription.plan.maxUsers) && !isLimitReached(usage.usersCount, currentSubscription.plan.maxUsers) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('approachingUserLimit')}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Available Plans */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">⭐</span> <span className="leading-none self-center">{t('availablePlans')}</span>
          </CardTitle>
          <CardDescription>
            {t('availablePlansDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isStripeEnabled && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payment processing is currently unavailable. You can view subscription plans, but payment features are disabled. Please contact support for assistance.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isOptimal = plan.name === 'starter' || translatePlanName(plan.displayName) === 'Optimal'
              return (
              <div
                key={plan.id}
                className={`p-6 border rounded-3xl flex flex-col ${
                  !isStripeEnabled 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'cursor-pointer transition-all shadow-none'
                } ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-400'
                    : plan.isPopular
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 dark:border-purple-400'
                    : isOptimal
                    ? 'border-primary hover:border-primary/80'
                    : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                }`}
                onClick={() => isStripeEnabled && handlePlanSelect(plan.id)}
              >
                {/* Header */}
                <div>
                  {plan.isPopular && (
                    <div className="text-center mb-4">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {t('mostPopular')}
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold mb-2">{translatePlanName(plan.displayName)}</h3>
                    <p className="text-muted-foreground text-sm">{translatePlanDescription(plan.description)}</p>
                  </div>

                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold">
                      {formatPrice(plan.price, plan.currency)}
                    </div>
                    {plan.price > 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t('per')} {t(plan.interval === 'month' ? 'month' : 'year')}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground invisible">
                        {t('per')} {t('month')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Included limits */}
                <div>
                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{translateFeature(feature)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Button */}
                <div className="mt-auto">
                  <div className="text-center">
                    <Button
                      className={isOptimal ? "w-full" : "w-full text-primary border-primary hover:bg-primary hover:text-primary-foreground"}
                      variant={selectedPlan === plan.id || isOptimal ? 'default' : 'outline'}
                      disabled={plan.id === currentSubscription?.plan?.id || !isStripeEnabled}
                    >
                      {plan.id === currentSubscription?.plan?.id ? t('currentPlan') : t('selectPlan')}
                    </Button>
                  </div>
                </div>
              </div>
              )
            })}
          </div>

          {selectedPlan && selectedPlan !== currentSubscription?.plan?.id && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-3xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{t('readyToUpgrade')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('upgradeDescription')}
                  </p>
                </div>
                <Button onClick={handleUpgrade} disabled={!isStripeEnabled}>
                  <Crown className="h-4 w-4 mr-2" />
                  {t('upgradeNow')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">⚙️</span> <span className="leading-none self-center">{t('billingHistory')}</span>
          </CardTitle>
          <CardDescription>
            {t('billingHistoryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Manage Subscription */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4" />
                <div className="font-medium">{t('subscriptionsAndPayments')}</div>
              </div>
              <div className="space-y-3">
                {currentSubscription && (
                  <div className="space-y-3">
                    {currentSubscription.cancelAtPeriodEnd ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {t('subscriptionCancelledAtPeriodEnd')}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" onClick={handleCancel} className="flex-1" disabled={!isStripeEnabled}>
                        <Crown className="h-4 w-4 mr-2" />
                        {t('manageSubscription')}
                      </Button>
                      <Button variant="outline" onClick={handleBilling} className="flex-1" disabled={!isStripeEnabled}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t('billingSettings')}
                      </Button>
                    </div>
                  </div>
                )}
                {!currentSubscription && (
                  <p className="text-sm text-muted-foreground">{t('noActiveSubscription')}</p>
                )}
              </div>
            </div>

            {/* Payment History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4" />
                <div className="font-medium">{t('paymentHistory')}</div>
              </div>
              <div className="space-y-3">
                {(paymentHistory && paymentHistory.length > 0 ? paymentHistory : [
                  // Fallback data - will be replaced with real API data when available
                  {
                    id: '1',
                    startDate: '2024-01-01',
                    endDate: '2024-01-31',
                    planName: 'pro',
                    amount: 9900, // in cents
                    currency: 'usd',
                    status: 'completed' as const
                  },
                  {
                    id: '2',
                    startDate: '2023-12-01',
                    endDate: '2023-12-31',
                    planName: 'starter',
                    amount: 3900, // in cents
                    currency: 'usd',
                    status: 'completed' as const
                  },
                  {
                    id: '3',
                    startDate: '2023-11-01',
                    endDate: '2023-11-30',
                    planName: 'pro',
                    amount: 9900, // in cents
                    currency: 'usd',
                    status: 'completed' as const
                  }
                ]).map((invoice) => {
                  const plan = plans.find(p => p.name === invoice.planName)
                  const planDisplayName = plan ? translatePlanName(plan.displayName) : invoice.planName
                  // Format amount from cents to currency string
                  const invoiceAmount = typeof invoice.amount === 'number' 
                    ? formatPrice(invoice.amount, invoice.currency)
                    : invoice.amount
                  return (
                    <div key={invoice.id} className="flex items-center justify-between px-6 py-3 border border-border rounded-3xl">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{planDisplayName}</div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.startDate} - {invoice.endDate}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-medium">{invoiceAmount}</div>
                          <InvoiceStatusBadge status={invoice.status === 'completed' ? 'paid' : invoice.status} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive/50 px-4 md:px-6 py-4 md:py-6">
        <CardHeader className="px-0 md:px-0">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Delete My Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all related data from the system. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 md:px-0">
          <DeleteConfirmation
            trigger={
              <Button variant="destructive" disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </Button>
            }
            title="Delete My Account"
            description="Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your data."
            dataLossWarning="This will permanently delete your account, all documents, tests, assignments, users, and all related data. This cannot be reversed."
            variant="destructive"
            isLoading={isDeleting}
            onConfirm={() => {
              // First confirmation - show final warning
              setShowFinalConfirm(true)
            }}
          />
          
          <DeleteConfirmation
            open={showFinalConfirm}
            onOpenChange={setShowFinalConfirm}
            title="Final Warning"
            description="This is your final warning. Clicking Delete will permanently delete your account and all related data. This cannot be reversed."
            variant="destructive"
            isLoading={isDeleting}
            onConfirm={async () => {
              setIsDeleting(true)
              setShowFinalConfirm(false)
              
              try {
                const response = await fetch('/api/users/delete-account', {
                  method: 'DELETE',
                })
                
                const data = await response.json()
                
                if (response.ok && data.success) {
                  toast.success('Account deleted successfully. You will be signed out.')
                  // Sign out and redirect to home
                  setTimeout(() => {
                    window.location.href = '/'
                  }, 2000)
                } else {
                  setIsDeleting(false)
                  toast.error(data.message || 'Failed to delete account')
                }
              } catch (error) {
                console.error('Error deleting account:', error)
                setIsDeleting(false)
                toast.error('Failed to delete account. Please try again.')
              }
            }}
            onCancel={() => {
              setShowFinalConfirm(false)
              setIsDeleting(false)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
