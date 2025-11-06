"use client"

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppBar } from "@/components/common/app-bar";
import { formatDateShort } from "@/lib/date-format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Crown, 
  Users, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  Loader2,
  Search
} from "lucide-react";

interface OwnerSubscription {
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

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
}

interface SubscriptionStats {
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  newThisMonth: number;
}

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [owners, setOwners] = useState<OwnerSubscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats>({
    totalRevenue: 0,
    activeSubscriptions: 0,
    churnRate: 0,
    newThisMonth: 0,
  });
  const [filterProvider, setFilterProvider] = useState<'all' | 'stripe'>('all');
  const [filterType, setFilterType] = useState<'free-trial' | 'manual' | 'paid'>('free-trial');
  const [searchText, setSearchText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated' && session?.user?.role !== 'super-admin') {
      router.push('/');
      return;
    }

    if (status === 'authenticated' && session?.user?.role === 'super-admin') {
      loadOwnersData();
      loadPlans();
    }
  }, [session, status, router]);

  // Clear search text when switching tabs
  useEffect(() => {
    setSearchText('');
  }, [filterType]);

  const loadPlans = async () => {
    try {
      const response = await fetch('/api/subscription');
      const result = await response.json();
      
      if (result.success && result.data.plans) {
        // Include all plans including free-trial, sorted by price (free-trial first)
        const allPlans = result.data.plans
          .map((plan: any) => ({
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            price: plan.price || 0,
            currency: plan.currency || 'USD',
          }))
          .sort((a: SubscriptionPlan, b: SubscriptionPlan) => a.price - b.price); // Sort by price, free-trial (0) first
        setPlans(allPlans);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadOwnersData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/super-admin/subscriptions');
      const result = await response.json();
      
      if (result.success) {
        setOwners(result.data.owners || []);
        setStats(result.data.stats || {
          totalRevenue: 0,
          activeSubscriptions: 0,
          churnRate: 0,
          newThisMonth: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load owners data:', error);
    } finally {
      setLoading(false);
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
    if (!status) return <AlertCircle className="h-4 w-4 text-gray-500" />;
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'expired': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
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

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (session?.user?.role !== 'super-admin') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppBar 
        role="super-admin" 
        user={{
          name: session?.user?.name,
          email: session?.user?.email,
          image: session?.user?.image
        }}
      />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:p-8">
      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold break-words">
              ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Churn Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.churnRate}%</div>
            <p className="text-xs text-muted-foreground">Monthly churn</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">New This Month</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.newThisMonth}</div>
            <p className="text-xs text-muted-foreground">New subscriptions</p>
          </CardContent>
        </Card>
      </div>

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
                    <div key={owner.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{owner.name || 'Unnamed Owner'}</div>
                        <div className="text-sm text-gray-600 truncate">{owner.email}</div>
                        {owner.country && (
                          <div className="text-xs text-gray-500">{owner.country}</div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="text-left sm:text-right flex-1 min-w-0">
                          <div className="font-medium">
                            {owner.plan?.displayName || 'No Plan'}
                          </div>
                          {owner.plan && (
                            <div className="text-sm text-gray-600">
                              ${(owner.plan.price / 100).toFixed(2)} {owner.plan.currency}
                            </div>
                          )}
                          {owner.subscription && (
                            <>
                              <div className="text-xs text-gray-500">
                                Ends: {formatDateShort(owner.subscription.currentPeriodEnd)}
                              </div>
                              {owner.subscription.changedManuallyAt && (
                                <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                  Changed: {formatDateShort(owner.subscription.changedManuallyAt)}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusIcon(owner.subscription?.status || null)}
                          {getStatusBadge(owner.subscription?.status || null)}
                          {getProviderBadge(owner.subscription?.provider || null)}
                        </div>

                        {/* Plan Change Dropdown - Only for free trial users and manually changed plans */}
                        {((owner.plan?.name === 'free-trial') || (owner.subscription?.changedManuallyAt !== null && owner.subscription?.changedManuallyAt !== undefined)) && plans.length > 0 && (
                          <div className="w-full sm:w-auto sm:min-w-[140px]">
                            <Select
                              value=""
                              onValueChange={(planId) => handleChangePlan(owner.id, planId)}
                              disabled={changingPlan === owner.id}
                            >
                              <SelectTrigger className="w-full sm:w-auto">
                                {changingPlan === owner.id ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-xs sm:text-sm">Changing...</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder="Change Plan" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.displayName} - {plan.price === 0 || plan.name === 'free-trial' 
                                      ? 'Free' 
                                      : `$${(plan.price / 100).toFixed(2)}/${plan.currency === 'USD' ? 'mo' : 'mo'}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="text-left sm:text-right sm:min-w-[80px]">
                          <div className="font-medium">${(owner.revenue / 100).toFixed(2)}</div>
                          <div className="text-xs text-gray-500">Monthly</div>
                        </div>
                      </div>
                    </div>
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
      </div>
    </div>
  );
}

