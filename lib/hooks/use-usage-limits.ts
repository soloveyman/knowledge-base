"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface UsageLimits {
  imports: { current: number; max: number | null; expired: boolean }
  generations: { current: number; max: number | null; expired: boolean }
  enhancements: { current: number; max: number | null; expired: boolean }
  users: { current: number; max: number | null; expired: boolean }
}

export function useUsageLimits() {
  const { data: session } = useSession()
  const [limits, setLimits] = useState<UsageLimits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Allow both owners and managers to see usage limits (managers see owner's limits)
    if (!session?.user || (session.user.role !== 'owner' && session.user.role !== 'manager')) {
      setLimits(null)
      setLoading(false)
      return
    }

    const fetchLimits = async () => {
      try {
        const response = await fetch('/api/subscription', { cache: 'no-store' })
        const result = await response.json()
        
        if (result.success && result.data.usage && result.data.currentSubscription?.plan) {
          const usage = result.data.usage
          const plan = result.data.currentSubscription.plan
          
          setLimits({
            imports: {
              current: usage.importsCount || 0,
              max: plan.maxImportsPerMonth,
              expired: plan.maxImportsPerMonth !== null && (usage.importsCount || 0) >= plan.maxImportsPerMonth
            },
            generations: {
              current: usage.generationsCount || 0,
              max: plan.maxGenerationsPerMonth,
              expired: plan.maxGenerationsPerMonth !== null && (usage.generationsCount || 0) >= plan.maxGenerationsPerMonth
            },
            enhancements: {
              current: usage.enhancementsCount || 0,
              max: plan.maxEnhancementsPerMonth,
              expired: plan.maxEnhancementsPerMonth !== null && (usage.enhancementsCount || 0) >= plan.maxEnhancementsPerMonth
            },
            users: {
              current: usage.usersCount || 0,
              max: plan.maxUsers,
              expired: plan.maxUsers !== null && (usage.usersCount || 0) >= plan.maxUsers
            }
          })
        } else if (result.success && result.data.currentSubscription?.plan) {
          // If no usage data but we have subscription, set users limit from subscription data
          const plan = result.data.currentSubscription.plan
          const usersCount = result.data.usage?.usersCount || 0
          
          setLimits({
            imports: {
              current: 0,
              max: plan.maxImportsPerMonth,
              expired: false
            },
            generations: {
              current: 0,
              max: plan.maxGenerationsPerMonth,
              expired: false
            },
            enhancements: {
              current: 0,
              max: plan.maxEnhancementsPerMonth,
              expired: false
            },
            users: {
              current: usersCount,
              max: plan.maxUsers,
              expired: plan.maxUsers !== null && usersCount >= plan.maxUsers
            }
          })
        } else {
          setLimits(null)
        }
      } catch (error) {
        console.error('Failed to fetch usage limits:', error)
        setLimits(null)
      } finally {
        setLoading(false)
      }
    }

    fetchLimits()
  }, [session])

  return { limits, loading }
}

