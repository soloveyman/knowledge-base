import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AppBar } from "@/components/common/app-bar"
import { StatsSection } from "./stats-section"
import { OwnersSection } from "./owners-section"
import { PlansSection } from "./plans-section"
import { SuperAdminClient } from "./super-admin-client"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Loading component for stats
function StatsLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}

// Loading component for owners list
function OwnersLoading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}

export default async function SuperAdminPage() {
  const session = await auth()

  // Server-side authentication check
  if (!session?.user) {
    redirect("/auth/signin")
  }

  if (session.user.role !== 'super-admin') {
    redirect("/")
  }

  // Fetch plans early (cached, static) - no Suspense needed
  const plans = await PlansSection()

  return (
    <div className="min-h-screen flex flex-col">
      <AppBar 
        role="super-admin" 
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }}
      />
      <div className="flex-1 w-full">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-4 md:p-8 h-full">
          {/* Stats section with Suspense for streaming */}
          <Suspense fallback={<StatsLoading />}>
            <StatsSection />
          </Suspense>

          {/* Main content with owners - wrapped in Suspense for streaming */}
          <Suspense fallback={<OwnersLoading />}>
            <OwnersWrapper initialPlans={plans} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// Separate component to fetch owners and pass to client
async function OwnersWrapper({ initialPlans }: { initialPlans: Awaited<ReturnType<typeof PlansSection>> }) {
  const owners = await OwnersSection()

  return (
    <SuperAdminClient 
      initialOwners={owners}
      initialPlans={initialPlans}
    />
  )
}
