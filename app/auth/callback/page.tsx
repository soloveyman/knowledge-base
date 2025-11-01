"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role
      if (role === 'super-admin') {
        router.push('/super-admin')
      } else if (role === 'owner') {
        router.push('/owner')
      } else if (role === 'manager') {
        router.push('/manager')
      } else {
        router.push('/employee')
      }
    } else if (status === "unauthenticated") {
      // If not authenticated, redirect back to sign in
      router.push('/auth/signin')
    }
  }, [status, session, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}

