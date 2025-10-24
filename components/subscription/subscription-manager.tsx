"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  planId: string
  planName: string
  status: 'active' | 'cancelled' | 'expired'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  nextBillingDate: string
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
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = () => {
    // Mock data - in production, this would come from API
    const mockPlans: SubscriptionPlan[] = [
      {
        id: 'free',
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for small teams getting started',
        price: 0,
        currency: 'USD',
        interval: 'month',
        maxUsers: 5,
        maxImportsPerMonth: 10,
        maxGenerationsPerMonth: 20,
        features: [
          'Up to 5 users',
          '10 document imports per month',
          '20 AI generations per month',
          'Basic reporting',
          'Email support'
        ]
      },
      {
        id: 'pro',
        name: 'pro',
        displayName: 'Pro',
        description: 'Ideal for growing teams and businesses',
        price: 2900, // $29.00 in cents
        currency: 'USD',
        interval: 'month',
        maxUsers: 25,
        maxImportsPerMonth: 100,
        maxGenerationsPerMonth: 200,
        features: [
          'Up to 25 users',
          '100 document imports per month',
          '200 AI generations per month',
          'Advanced reporting & analytics',
          'Priority support',
          'Custom branding',
          'API access'
        ],
        isPopular: true
      },
      {
        id: 'business',
        name: 'business',
        displayName: 'Business',
        description: 'For large organizations with advanced needs',
        price: 9900, // $99.00 in cents
        currency: 'USD',
        interval: 'month',
        maxUsers: 100,
        maxImportsPerMonth: 500,
        maxGenerationsPerMonth: 1000,
        features: [
          'Up to 100 users',
          '500 document imports per month',
          '1000 AI generations per month',
          'Enterprise reporting & analytics',
          '24/7 phone support',
          'White-label solution',
          'Advanced API access',
          'Custom integrations',
          'Dedicated account manager'
        ]
      }
    ]

    const mockCurrentSubscription: CurrentSubscription = {
      planId: 'pro',
      planName: 'Pro',
      status: 'active',
      currentPeriodStart: '2024-01-01T00:00:00Z',
      currentPeriodEnd: '2024-02-01T00:00:00Z',
      cancelAtPeriodEnd: false,
      nextBillingDate: '2024-02-01T00:00:00Z'
    }

    const mockUsage: Usage = {
      month: '2024-01',
      importsCount: 45,
      generationsCount: 89,
      usersCount: 18
    }

    setPlans(mockPlans)
    setCurrentSubscription(mockCurrentSubscription)
    setUsage(mockUsage)
  }

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return 'Free'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price / 100)
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
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleUpgrade = () => {
    if (selectedPlan && onUpgrade) {
      onUpgrade(selectedPlan)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
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
      {currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Current Subscription
            </CardTitle>
            <CardDescription>
              Your current plan and usage details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Plan Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Plan:</span>
                    <Badge className={getPlanColor(currentSubscription.planName)}>
                      {currentSubscription.planName}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                      {currentSubscription.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Next billing:</span>
                    <span className="text-sm">
                      {new Date(currentSubscription.nextBillingDate).toLocaleDateString()}
                    </span>
                  </div>
                  {currentSubscription.cancelAtPeriodEnd && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your subscription will be cancelled at the end of the current period.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {usage && (
                <div>
                  <h4 className="font-medium mb-2">Current Usage</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Users</span>
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
                        <span>Imports this month</span>
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
                        <span>AI Generations</span>
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
              <Button variant="outline" onClick={onBilling}>
                <CreditCard className="h-4 w-4 mr-2" />
                Billing Settings
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Alerts */}
      {usage && (
        <>
          {isLimitReached(usage.usersCount, 25) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You've reached your user limit. Upgrade your plan to add more users.
              </AlertDescription>
            </Alert>
          )}

          {isLimitReached(usage.importsCount, 100) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You've reached your monthly import limit. Upgrade your plan for more imports.
              </AlertDescription>
            </Alert>
          )}

          {isLimitReached(usage.generationsCount, 200) && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You've reached your monthly AI generation limit. Upgrade your plan for more generations.
              </AlertDescription>
            </Alert>
          )}

          {isNearLimit(usage.usersCount, 25) && !isLimitReached(usage.usersCount, 25) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're approaching your user limit. Consider upgrading your plan.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Available Plans
          </CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 border rounded-lg cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50'
                    : plan.isPopular
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                {plan.isPopular && (
                  <div className="text-center mb-4">
                    <Badge className="bg-purple-100 text-purple-800">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-4">
                  <div className="flex justify-center mb-2">
                    {getPlanIcon(plan.displayName)}
                  </div>
                  <h3 className="text-xl font-bold">{plan.displayName}</h3>
                  <p className="text-gray-600 text-sm">{plan.description}</p>
                </div>

                <div className="text-center mb-6">
                  <div className="text-3xl font-bold">
                    {formatPrice(plan.price, plan.currency)}
                  </div>
                  {plan.price > 0 && (
                    <div className="text-sm text-gray-600">
                      per {plan.interval}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <Button
                    className="w-full"
                    variant={selectedPlan === plan.id ? 'default' : 'outline'}
                    disabled={plan.id === currentSubscription?.planId}
                  >
                    {plan.id === currentSubscription?.planId ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {selectedPlan && selectedPlan !== currentSubscription?.planId && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Ready to upgrade?</h4>
                  <p className="text-sm text-gray-600">
                    You'll be charged immediately and your new plan will be active right away.
                  </p>
                </div>
                <Button onClick={handleUpgrade}>
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>
            Your recent billing and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                date: '2024-01-01',
                description: 'Pro Plan - Monthly',
                amount: '$29.00',
                status: 'paid'
              },
              {
                date: '2023-12-01',
                description: 'Pro Plan - Monthly',
                amount: '$29.00',
                status: 'paid'
              },
              {
                date: '2023-11-01',
                description: 'Pro Plan - Monthly',
                amount: '$29.00',
                status: 'paid'
              }
            ].map((invoice, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium">{invoice.description}</div>
                    <div className="text-sm text-gray-600">{invoice.date}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">{invoice.amount}</div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {invoice.status}
                    </Badge>
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
