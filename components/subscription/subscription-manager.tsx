"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/translation-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlanBadge, StatusBadge, InvoiceStatusBadge } from "@/lib/badges"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Unlock
} from "lucide-react"

interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  maxUsers: number
  maxImportsPerMonth: number
  maxGenerationsPerMonth: number
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
  } | null
}

interface Usage {
  month: string
  importsCount: number
  generationsCount: number
  usersCount: number
}

interface SubscriptionManagerProps {
  onUpgrade?: (planId: string) => void
  onCancel?: () => void
  onBilling?: () => void
}

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

  const loadSubscriptionData = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription')
      const result = await response.json()
      
      if (result.success) {
        setPlans(result.data.plans)
        setCurrentSubscription(result.data.currentSubscription)
        setUsage(result.data.usage)
      } else {
        console.error('Failed to load subscription data:', result.message)
        setPlans([])
        setCurrentSubscription(null)
        setUsage(null)
      }
    } catch (error) {
      console.error('Error loading subscription data:', error)
      setPlans([])
      setCurrentSubscription(null)
      setUsage(null)
    }
  }, [])

  useEffect(() => {
    loadSubscriptionData()
  }, [loadSubscriptionData])

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

  const translatePlanDescription = (description: string): string => {
    // Map plan descriptions to translation keys
    const descriptionMap: Record<string, string> = {
      '14-day free trial to explore all features': t('freeTrialDescription'),
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
      case 'free': return <Shield className="h-6 w-6" />
      case 'pro': return <Zap className="h-6 w-6" />
      case 'business': return <Crown className="h-6 w-6" />
      default: return <Shield className="h-6 w-6" />
    }
  }

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free': return 'bg-gray-100 text-gray-800'
      case 'pro': return 'bg-blue-100 text-blue-800'
      case 'business': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
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
    if (!selectedPlan) return;
    
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
          <CardContent>
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
                          {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
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

                  {usage && (
                    <div>
                      <h4 className="font-medium mb-2">{t('currentUsage')}</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('users')}</span>
                            <span className={getUsageColor(getUsagePercentage(usage.usersCount, 25))}>
                              {usage.usersCount}/25
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(usage.usersCount, 25)} 
                            className="h-2"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('importsThisMonth')}</span>
                            <span className={getUsageColor(getUsagePercentage(usage.importsCount, 100))}>
                              {usage.importsCount}/100
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(usage.importsCount, 100)} 
                            className="h-2"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{t('aiGenerations')}</span>
                            <span className={getUsageColor(getUsagePercentage(usage.generationsCount, 200))}>
                              {usage.generationsCount}/200
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(usage.generationsCount, 200)} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={handleBilling}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('billingSettings')}
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <Settings className="h-4 w-4 mr-2" />
                    {t('manageSubscription')}
                  </Button>
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
      {usage && (
        <>
          {isLimitReached(usage.usersCount, 25) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedUserLimit')}
              </AlertDescription>
            </Alert>
          )}

          {isLimitReached(usage.importsCount, 100) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedImportLimit')}
              </AlertDescription>
            </Alert>
          )}

          {isLimitReached(usage.generationsCount, 200) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('reachedGenerationLimit')}
              </AlertDescription>
            </Alert>
          )}

          {isNearLimit(usage.usersCount, 25) && !isLimitReached(usage.usersCount, 25) && (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 border rounded-3xl cursor-pointer transition-all shadow-none ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-400'
                    : plan.isPopular
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 dark:border-purple-400'
                    : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                }`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                {plan.isPopular && (
                  <div className="text-center mb-4">
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {t('mostPopular')}
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                  <p className="text-muted-foreground text-sm">{translatePlanDescription(plan.description)}</p>
                </div>

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold">
                    {formatPrice(plan.price, plan.currency)}
                  </div>
                  {plan.price > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {t('per')} {t(plan.interval === 'month' ? 'month' : 'year')}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{translateFeature(feature)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <Button
                    className="w-full"
                    variant={selectedPlan === plan.id ? 'default' : 'outline'}
                    disabled={plan.id === currentSubscription?.plan?.id}
                  >
                    {plan.id === currentSubscription?.plan?.id ? t('currentPlan') : t('selectPlan')}
                  </Button>
                </div>
              </div>
            ))}
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
                <Button onClick={handleUpgrade}>
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
            <span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📜</span> <span className="leading-none self-center">{t('billingHistory')}</span>
          </CardTitle>
          <CardDescription>
            {t('billingHistoryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                description: 'Pro Plan',
                amount: '$29.00',
                status: 'paid'
              },
              {
                startDate: '2023-12-01',
                endDate: '2023-12-31',
                description: 'Pro Plan',
                amount: '$29.00',
                status: 'paid'
              },
              {
                startDate: '2023-11-01',
                endDate: '2023-11-30',
                description: 'Pro Plan',
                amount: '$29.00',
                status: 'paid'
              }
            ].map((invoice, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-border rounded-3xl">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{invoice.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.startDate} - {invoice.endDate}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">{invoice.amount}</div>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
