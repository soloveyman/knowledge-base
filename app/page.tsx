"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  // Static redirect for unauthenticated users
  // Middleware handles authenticated user redirects
  const router = useRouter()
  
  useEffect(() => {
    router.replace("/auth/signin")
  }, [router])

  return null
}
