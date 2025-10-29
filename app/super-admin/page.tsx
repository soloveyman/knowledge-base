"use client"

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Users, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter
} from "lucide-react";

interface OwnerSubscription {
  id: string;
  name: string;
  email: string;
  country: string | null;
  plan: {
    name: string;
    displayName: string;
    price: number;
    currency: string;
  } | null;
  subscription: {
    status: 'active' | 'cancelled' | 'expired';
    currentPeriodEnd: string;
    provider: 'stripe' | null;
  } | null;
  revenue: number;
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
  const [loading, setLoading] = useState(true);

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
    }
  }, [session, status, router]);

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

  const filteredOwners = owners.filter(owner => 
    filterProvider === 'all' || owner.subscription?.provider === filterProvider
  );

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
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (session?.user?.role !== 'super-admin') {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage all owner subscriptions and payments</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnRate}%</div>
            <p className="text-xs text-muted-foreground">Monthly churn</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newThisMonth}</div>
            <p className="text-xs text-muted-foreground">New subscriptions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-6">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="subscriptions">Owner Subscriptions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Owner Subscriptions</CardTitle>
              <CardDescription>
                Manage subscriptions for all owners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Provider Filters */}
              <div className="flex gap-2 mb-6">
                <Button 
                  variant={filterProvider === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterProvider('all')}
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  All Providers
                </Button>
                <Button 
                  variant={filterProvider === 'stripe' ? 'default' : 'outline'}
                  onClick={() => setFilterProvider('stripe')}
                  size="sm"
                >
                  Stripe
                </Button>
              </div>

              {/* Owners Table */}
              <div className="space-y-4">
                {filteredOwners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4" />
                    <p>No owners found</p>
                  </div>
                ) : (
                  filteredOwners.map((owner) => (
                    <div key={owner.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="font-medium">{owner.name || 'Unnamed Owner'}</div>
                        <div className="text-sm text-gray-600">{owner.email}</div>
                        {owner.country && (
                          <div className="text-xs text-gray-500">{owner.country}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-medium">
                            {owner.plan?.displayName || 'No Plan'}
                          </div>
                          {owner.plan && (
                            <div className="text-sm text-gray-600">
                              ${(owner.plan.price / 100).toFixed(2)} {owner.plan.currency}
                            </div>
                          )}
                          {owner.subscription && (
                            <div className="text-xs text-gray-500">
                              Ends: {new Date(owner.subscription.currentPeriodEnd).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusIcon(owner.subscription?.status || null)}
                          {getStatusBadge(owner.subscription?.status || null)}
                          {getProviderBadge(owner.subscription?.provider || null)}
                        </div>

                        <div className="text-right min-w-[80px]">
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

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure payment providers and system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>System settings will be implemented here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

