import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();
    
    // Check if user is super-admin
    if (!session?.user || session.user.role !== 'super-admin') {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized. Super-admin access required.'
      }, { status: 403 });
    }

    // Get all owners with their subscription info (exclude super-admin)
    // Only 'owner' role - super-admin is already excluded
    const allOwners = await db.select()
      .from(users)
      .where(eq(users.role, 'owner'));

    // Get subscription and payment data for each owner
    // Note: Using userId instead of ownerId for compatibility with current DB schema
    const ownersWithSubscriptions = await Promise.all(
      allOwners.map(async (owner) => {
        // Get owner's subscription - using user_id (current DB schema)
        const ownerSubscriptions = await db.execute(sql`
          SELECT s.*, sp.name as plan_name, sp.display_name as plan_display_name, 
                 sp.price as plan_price, sp.currency as plan_currency
          FROM subscriptions s
          LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
          WHERE s.user_id = ${owner.id}
          ORDER BY s.created_at DESC
          LIMIT 1
        `);

        let subscriptionData: {
          status: string;
          currentPeriodEnd: Date | string;
          createdAt: Date | string;
        } | null = null;
        let planData: {
          name: string | null;
          displayName: string | null;
          price: number | string | null;
          currency: string | null;
        } | null = null;
        
        if (ownerSubscriptions.rows && ownerSubscriptions.rows.length > 0) {
          const sub = ownerSubscriptions.rows[0] as {
            status?: string;
            current_period_end?: Date | string;
            created_at?: Date | string;
            plan_name?: string | null;
            plan_display_name?: string | null;
            plan_price?: number | string | null;
            plan_currency?: string | null;
          };
          subscriptionData = {
            status: sub.status || '',
            currentPeriodEnd: sub.current_period_end || new Date(),
            createdAt: sub.created_at || new Date(),
          };
          planData = {
            name: sub.plan_name ?? null,
            displayName: sub.plan_display_name ?? null,
            price: sub.plan_price ?? null,
            currency: sub.plan_currency ?? null,
          };
        }

        // Get latest payment for revenue calculation (if payments table exists)
        // Note: Payments table might not exist yet or use different schema
        let revenue = 0;
        let provider: 'stripe' | null = null;
        
        try {
          // Try to get payment - check if table exists first
          const paymentCheck = await db.execute(sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'payments'
          )`);
          
          if (paymentCheck.rows?.[0]?.exists) {
            // Try with owner_id first, fallback to user_id if different schema
            const latestPayment = await db.execute(sql`
              SELECT amount, provider FROM payments 
              WHERE owner_id = ${owner.id} OR user_id = ${owner.id}
              ORDER BY created_at DESC 
              LIMIT 1
            `);
            if (latestPayment.rows && latestPayment.rows.length > 0) {
              revenue = Number(latestPayment.rows[0].amount) || 0;
              provider = (latestPayment.rows[0].provider === 'stripe' ? 'stripe' : null) || null;
            }
          }
        } catch {
          // Payments table might not exist yet or have different schema
          // This is OK - revenue will be 0
        }

        return {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          country: owner.country,
          plan: planData ? {
            name: planData.name,
            displayName: planData.displayName,
            price: planData.price || 0,
            currency: planData.currency || 'USD',
          } : null,
          subscription: subscriptionData ? {
            status: subscriptionData.status as 'active' | 'cancelled' | 'expired',
            currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd).toISOString(),
            provider,
          } : null,
          revenue,
        };
      })
    );

    // Calculate statistics
    const activeSubscriptions = ownersWithSubscriptions.filter(
      owner => owner.subscription?.status === 'active'
    ).length;

    const totalRevenue = ownersWithSubscriptions.reduce((sum, owner) => {
      return sum + (owner.revenue || 0);
    }, 0) / 100; // Convert from cents/kopecks to dollars

    // Calculate new subscriptions this month
    const thisMonth = new Date();
    const firstDayOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
    
    // Get all subscriptions created this month by owners only (exclude super-admin)
    const newSubscriptionsResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM subscriptions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.created_at >= ${firstDayOfMonth}
        AND u.role = 'owner'
    `);
    
    const newThisMonth = Number(newSubscriptionsResult.rows?.[0]?.count || 0);

    // Calculate churn rate (cancellations in last month / active subscriptions at start of last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const firstDayOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastDayOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    
    // Get subscriptions that were updated to cancelled/expired status in the last month
    const cancellationsResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM subscriptions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.role = 'owner'
        AND s.status IN ('cancelled', 'expired')
        AND s.updated_at >= ${firstDayOfLastMonth}
        AND s.updated_at <= ${lastDayOfLastMonth}
    `);
    
    const cancellations = Number(cancellationsResult.rows?.[0]?.count || 0);
    
    // Get active subscriptions at the start of last month
    // Approximate by: currently active subscriptions created before last month + subscriptions cancelled in last month
    const currentlyActiveResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM subscriptions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE u.role = 'owner'
        AND s.status = 'active'
        AND s.created_at <= ${firstDayOfLastMonth}
    `);
    
    // Active subscriptions at start = currently active (created before) + those cancelled during last month
    const currentlyActive = Number(currentlyActiveResult.rows?.[0]?.count || 0);
    const activeAtStart = currentlyActive + cancellations;
    
    // Calculate churn rate: (cancellations / active at start) * 100
    const churnRate = activeAtStart > 0 ? (cancellations / activeAtStart) * 100 : 0;

    const stats = {
      totalRevenue,
      activeSubscriptions,
      churnRate,
      newThisMonth,
    };

    return NextResponse.json({
      success: true,
      data: {
        owners: ownersWithSubscriptions,
        stats,
      }
    });

  } catch (error) {
    console.error('Super admin subscriptions API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch subscriptions data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

