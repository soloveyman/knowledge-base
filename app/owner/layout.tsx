import type { ReactNode } from "react"
import { auth } from "@/lib/auth"
import { getOnboardingState } from "@/lib/onboarding/getOnboardingState"
import { OnboardingModal } from "@/components/onboarding/OnboardingModal"

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  let state = null
  try {
    if (session && session.user) {
      state = await getOnboardingState({
        businessId: session.user.businessId,
        userId: session.user.id,
        role: session.user.role,
      })
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


