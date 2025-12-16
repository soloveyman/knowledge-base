import type { ReactNode } from "react"
import { auth } from "@/lib/auth"
import { getOnboardingState } from "@/lib/onboarding/getOnboardingState"
import { OnboardingModal } from "@/components/onboarding/OnboardingModal"

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  const state =
    session && session.user
      ? await getOnboardingState({
          businessId: session.user.businessId,
          userId: session.user.id,
          role: session.user.role,
        })
      : null

  return (
    <>
      <OnboardingModal initialState={state} />
      {children}
    </>
  )
}


