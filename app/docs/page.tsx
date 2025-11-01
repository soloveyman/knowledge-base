"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface UserWithRole {
  role?: string
}

/**
 * Redirect page for /docs route
 * Redirects users to their appropriate dashboard based on role:
 * - owner -> /owner?tab=docs
 * - manager -> /manager?tab=docs
 * - employee -> /employee (no docs tab, redirect to employee page)
 */
export default function DocsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Redirect based on user role
    const userRole = (session?.user as UserWithRole)?.role || 'manager'
    
    if (userRole === 'owner') {
      router.push('/owner?tab=docs')
    } else if (userRole === 'manager') {
      router.push('/manager?tab=docs')
    } else {
      // Employee or other roles - redirect to employee page
      router.push('/employee')
    }
  }, [session, status, router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  )
}
