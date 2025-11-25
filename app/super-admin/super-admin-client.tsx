"use client"

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/date-format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslation } from "@/lib/translation-context";
import { 
  Crown, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Shield,
  Zap
} from "lucide-react";

export interface OwnerSubscription {
  id: string;
  name: string;
  email: string;
  country: string | null;
  plan: {
    id: string | null;
    name: string;
    displayName: string;
    price: number;
    currency: string;
  } | null;
  subscription: {
    id: string | null;
    status: 'active' | 'cancelled' | 'expired';
    currentPeriodEnd: string;
    provider: 'stripe' | null;
    changedManuallyAt: string | null;
  } | null;
  revenue: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
}

export interface SubscriptionStats {
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  newThisMonth: number;
}

interface SuperAdminClientProps {
  initialOwners: OwnerSubscription[];
  initialPlans: SubscriptionPlan[];
}

export function SuperAdminClient({ initialOwners, initialPlans }: SuperAdminClientProps) {
  const { t } = useTranslation();
  const [owners, setOwners] = useState<OwnerSubscription[]>(initialOwners);
  const [filterProvider, setFilterProvider] = useState<'all' | 'stripe'>('all');
  const [filterType, setFilterType] = useState<'free-trial' | 'manual' | 'paid'>('free-trial');
  const [searchText, setSearchText] = useState<string>('');
  const [plans] = useState<SubscriptionPlan[]>(initialPlans);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  // Clear search text when switching tabs
  useEffect(() => {
    setSearchText('');
  }, [filterType]);

  const loadOwnersData = async () => {
    try {
      // Add timeout for mobile devices with slow connections
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/super-admin/subscriptions', { 
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setOwners(result.data.owners || []);
      } else {
        throw new Error(result.message || 'Failed to load owners data');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timeout:', error);
        toast.error('Request timed out. Please check your connection and try again.');
      } else {
        console.error('Failed to load owners data:', error);
        toast.error('Failed to refresh owners data. Please try again.');
      }
    }
  };

  const handleChangePlan = async (ownerId: string, planId: string) => {
    try {
      setChangingPlan(ownerId);
      toast.loading('Changing subscription plan...', { id: 'change-plan' });
      
      const response = await fetch('/api/super-admin/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerId,
          planId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Plan changed to ${result.data.planDisplayName}`, { id: 'change-plan' });
        // Reload owners data to reflect the change
        loadOwnersData();
      } else {
        toast.error(result.message || 'Failed to change plan', { id: 'change-plan' });
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error('Error changing plan', { id: 'change-plan' });
    } finally {
      setChangingPlan(null);
    }
  };

  // Filter owners: show free trial users, manually changed plans, or paid plans based on filterType
  const filteredOwners = owners.filter(owner => {
    const matchesProvider = filterProvider === 'all' || owner.subscription?.provider === filterProvider;
    
    // Text search filter (for free-trial and manual tabs)
    const matchesSearch = (filterType === 'free-trial' || filterType === 'manual')
      ? (searchText.trim() === '' || 
          owner.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          owner.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          owner.country?.toLowerCase().includes(searchText.toLowerCase()))
      : true; // No search filter for paid plans
    
    if (filterType === 'free-trial') {
      const isFreeTrial = owner.plan?.name === 'free-trial';
      return matchesProvider && isFreeTrial && matchesSearch;
    } else if (filterType === 'manual') {
      const isManuallyChanged = owner.subscription?.changedManuallyAt !== null && owner.subscription?.changedManuallyAt !== undefined;
      return matchesProvider && isManuallyChanged && matchesSearch;
    } else if (filterType === 'paid') {
      const hasPaidPlan = owner.plan && owner.plan.price > 0 && owner.plan.name !== 'free-trial';
      const isNotManuallyChanged = !owner.subscription?.changedManuallyAt || owner.subscription.changedManuallyAt === null;
      return matchesProvider && hasPaidPlan && isNotManuallyChanged;
    }
    
    return false;
  });

  const getStatusIcon = (status: string | null) => {
    if (!status) return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'expired': return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getProviderBadge = (provider: string | null) => {
    if (!provider) return <Badge variant="outline">No Provider</Badge>;
    
    const variants = {
      stripe: 'default' as const,
      interkassa: 'secondary' as const,
    };
    
    return (
      <Badge variant={variants[provider as keyof typeof variants] || 'outline'}>
        {provider.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">No Subscription</Badge>;
    
    const variants = {
      active: 'default' as const,
      cancelled: 'destructive' as const,
      expired: 'secondary' as const,
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPlanIcon = (planName: string | null) => {
    if (!planName) return <Shield className="h-4 w-4" />;
    switch (planName.toLowerCase()) {
      case 'free':
      case 'free-trial': return <Shield className="h-4 w-4" />;
      case 'starter':
      case 'standard':
      case 'optimal': return <Users className="h-4 w-4" />;
      case 'pro': return <Zap className="h-4 w-4" />;
      case 'business': return <Crown className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getPlanColor = (planName: string | null) => {
    if (!planName) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    switch (planName.toLowerCase()) {
      case 'free':
      case 'free-trial': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'starter':
      case 'standard':
      case 'optimal': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pro': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'business': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Tabs defaultValue="subscriptions" className="space-y-6">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">Owner Subscriptions</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Owner Subscriptions</CardTitle>
                <CardDescription>
                  Manage subscription plans for owners
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filter Tabs */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterType('free-trial')}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      filterType === 'free-trial'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Free Trial Users
                  </button>
                  <button
                    onClick={() => setFilterType('paid')}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      filterType === 'paid'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Paid Plans
                  </button>
                  <button
                    onClick={() => setFilterType('manual')}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      filterType === 'manual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Manually Changed Plans
                  </button>
                </div>

                {/* Search Filter - Only for free-trial and manual tabs */}
                {(filterType === 'free-trial' || filterType === 'manual') && (
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by name, email, or country..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                )}

                {/* Owners Table */}
                <div className="space-y-4">
                  {filteredOwners.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4" />
                      <p>No owners found</p>
                    </div>
                  ) : (
                    filteredOwners.map((owner) => (
                      <article 
                        key={owner.id} 
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        aria-label={`Owner subscription for ${owner.name || owner.email}`}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">{owner.name || 'Unnamed Owner'}</h3>
                          <dl className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <dt className="sr-only">Email</dt>
                              <dd className="text-sm text-muted-foreground truncate">{owner.email}</dd>
                            </div>
                            {owner.country && (
                              <div className="flex items-center gap-2">
                                <dt className="sr-only">Country</dt>
                                <dd className="text-xs text-muted-foreground">{owner.country}</dd>
                              </div>
                            )}
                          </dl>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                          <dl className="text-left sm:text-right flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 justify-start sm:justify-end mb-1">
                              <dt className="sr-only">Plan</dt>
                              <dd className="flex items-center gap-2">
                                <span aria-hidden="true">{getPlanIcon(owner.plan?.name || null)}</span>
                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getPlanColor(owner.plan?.name || null)}`}>
                                  {owner.plan?.displayName || 'No Plan'}
                                </div>
                              </dd>
                            </div>
                            {owner.plan && (
                              <div className="flex items-center gap-2 justify-start sm:justify-end">
                                <dt className="sr-only">Price</dt>
                                <dd className="text-sm text-muted-foreground">
                                  ${(owner.plan.price / 100).toFixed(2)} {owner.plan.currency}
                                </dd>
                              </div>
                            )}
                            {owner.subscription && (
                              <>
                                <div className="flex items-center gap-2 justify-start sm:justify-end">
                                  <dt className="sr-only">Subscription ends</dt>
                                  <dd className="text-xs text-muted-foreground">
                                    Ends: {formatDateShort(owner.subscription.currentPeriodEnd)}
                                  </dd>
                                </div>
                                {owner.subscription.changedManuallyAt && (
                                  <div className="flex items-center gap-2 justify-start sm:justify-end">
                                    <dt className="sr-only">Plan changed manually</dt>
                                    <dd className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                      Changed: {formatDateShort(owner.subscription.changedManuallyAt)}
                                    </dd>
                                  </div>
                                )}
                              </>
                            )}
                          </dl>

                          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Subscription status">
                            <span aria-hidden="true">{getStatusIcon(owner.subscription?.status || null)}</span>
                            <span className="sr-only">Status: {owner.subscription?.status || 'No status'}</span>
                            {getStatusBadge(owner.subscription?.status || null)}
                            {getProviderBadge(owner.subscription?.provider || null)}
                          </div>

                          {/* Plan Change Dropdown - Only for free trial users and manually changed plans */}
                          {((owner.plan?.name === 'free-trial') || (owner.subscription?.changedManuallyAt !== null && owner.subscription?.changedManuallyAt !== undefined)) && plans.length > 0 && (
                            <div className="w-full sm:w-auto sm:min-w-[140px]">
                              <label htmlFor={`plan-select-${owner.id}`} className="sr-only">
                                Change plan for {owner.name || owner.email}
                              </label>
                              <Select
                                value=""
                                onValueChange={(planId) => handleChangePlan(owner.id, planId)}
                                disabled={changingPlan === owner.id}
                              >
                                <SelectTrigger 
                                  id={`plan-select-${owner.id}`}
                                  className="w-full sm:w-auto"
                                  aria-label={`Change plan for ${owner.name || owner.email}`}
                                >
                                  {changingPlan === owner.id ? (
                                    <div className="flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                      <span className="text-xs sm:text-sm">Changing...</span>
                                    </div>
                                  ) : (
                                    <SelectValue placeholder="Change Plan" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  {plans.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">{t('noItems') || 'No items available'}</div>
                                  ) : (
                                    plans.map((plan) => (
                                      <SelectItem key={plan.id} value={plan.id}>
                                        {plan.displayName} - {plan.price === 0 || plan.name === 'free-trial' 
                                          ? 'Free' 
                                          : `$${(plan.price / 100).toFixed(2)}/${plan.currency === 'USD' ? 'mo' : 'mo'}`}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <dl className="text-left sm:text-right sm:min-w-[80px]">
                            <div className="flex items-center gap-2 justify-start sm:justify-end">
                              <dt className="sr-only">Monthly revenue</dt>
                              <dd className="font-medium">${(owner.revenue / 100).toFixed(2)}</dd>
                            </div>
                            <div className="flex items-center gap-2 justify-start sm:justify-end">
                              <dt className="sr-only">Revenue period</dt>
                              <dd className="text-xs text-muted-foreground">Monthly</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Revenue and subscription analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                  <p>Analytics dashboard will be implemented here</p>
                </div>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
  );
}

