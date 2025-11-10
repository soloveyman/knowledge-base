import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, TrendingUp, Crown } from "lucide-react"
import { db, users, subscriptions, subscriptionPlans } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import type { SubscriptionStats } from "./super-admin-client"

export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every 60 seconds

async function fetchStats(): Promise<SubscriptionStats> {
  // Get all owners
  const allOwners = await db.select()
    .from(users)
    .where(eq(users.role, 'owner'))

  // Get subscription and payment data for each owner (simplified for stats)
  const ownersWithSubscriptions = await Promise.all(
    allOwners.map(async (owner) => {
      const ownerSubscriptions = await db.execute(sql`
        SELECT s.id, s.status, s.user_id
        FROM subscriptions s
        WHERE s.user_id = ${owner.id}
        ORDER BY s.created_at DESC
        LIMIT 1
      `)

      let revenue = 0
      
      try {
        const paymentCheck = await db.execute(sql`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'payments'
        )`)
        
        if (paymentCheck.rows?.[0]?.exists) {
          const latestPayment = await db.execute(sql`
            SELECT amount FROM payments 
            WHERE owner_id = ${owner.id} OR user_id = ${owner.id}
            ORDER BY created_at DESC 
            LIMIT 1
          `)
          if (latestPayment.rows && latestPayment.rows.length > 0) {
            revenue = Number(latestPayment.rows[0].amount) || 0
          }
        }
      } catch {
        // Payments table might not exist
      }

      const status = ownerSubscriptions.rows?.[0]?.status as string | undefined

      return {
        status,
        revenue,
      }
    })
  )

  // Calculate statistics
  const activeSubscriptions = ownersWithSubscriptions.filter(
    owner => owner.status === 'active'
  ).length

  const totalRevenue = ownersWithSubscriptions.reduce((sum, owner) => {
    return sum + (owner.revenue || 0)
  }, 0) / 100 // Convert from cents/kopecks to dollars

  // Calculate new subscriptions this month
  const thisMonth = new Date()
  const firstDayOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
  
  const newSubscriptionsResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM subscriptions s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.created_at >= ${firstDayOfMonth}
      AND u.role = 'owner'
  `)
  
  const newThisMonth = Number(newSubscriptionsResult.rows?.[0]?.count || 0)

  // Calculate churn rate
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const firstDayOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
  const lastDayOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
  
  const cancellationsResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM subscriptions s
    INNER JOIN users u ON s.user_id = u.id
    WHERE u.role = 'owner'
      AND s.status IN ('cancelled', 'expired')
      AND s.updated_at >= ${firstDayOfLastMonth}
      AND s.updated_at <= ${lastDayOfLastMonth}
  `)
  
  const cancellations = Number(cancellationsResult.rows?.[0]?.count || 0)

  const currentlyActiveResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM subscriptions s
    INNER JOIN users u ON s.user_id = u.id
    WHERE u.role = 'owner'
      AND s.status = 'active'
      AND s.created_at <= ${firstDayOfLastMonth}
  `)
  
  const currentlyActive = Number(currentlyActiveResult.rows?.[0]?.count || 0)
  const activeAtStart = currentlyActive + cancellations

  const churnRate = activeAtStart > 0 ? (cancellations / activeAtStart) * 100 : 0

  return {
    totalRevenue,
    activeSubscriptions,
    churnRate,
    newThisMonth,
  }
}

export async function StatsSection() {
  const stats = await fetchStats()

  return (
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
          <div className="text-xl sm:text-2xl font-bold">{stats.churnRate.toFixed(1)}%</div>
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
  )
}

