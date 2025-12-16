import type { ReactNode } from "react"
import { auth } from "@/lib/auth"
import { getOnboardingState } from "@/lib/onboarding/getOnboardingState"
import { OnboardingModal } from "@/components/onboarding/OnboardingModal"

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  console.log('[OwnerLayout] Session check:', { 
    hasSession: !!session, 
    hasUser: !!session?.user, 
    userId: session?.user?.id, 
    businessId: session?.user?.businessId, 
    role: session?.user?.role 
  })

  let state = null
  try {
    if (session && session.user) {
      if (!session.user.businessId) {
        console.warn('[Onboarding] Owner has no businessId, skipping onboarding check')
      } else {
        state = await getOnboardingState({
          businessId: session.user.businessId,
          userId: session.user.id,
          role: session.user.role,
        })
        console.log('[Onboarding] Owner onboarding state:', { 
          shouldShow: state?.shouldShow, 
          currentStep: state?.currentStep, 
          done: state?.done,
          counts: state?.counts
        })
      }
    } else {
      console.warn('[Onboarding] No session or user found in OwnerLayout')
    }
  } catch (error) {
    // Silently fail onboarding - don't break the page if onboarding check fails
    console.error('[Onboarding] Failed to get onboarding state:', error)
  }

  return (
    <>
      <OnboardingModal initialState={state} />
      {children}
    </>
  )
}


