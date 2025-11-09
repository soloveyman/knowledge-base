import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

/**
 * Redirect page for /docs route
 * Redirects users to their appropriate dashboard based on role:
 * - owner -> /owner?tab=docs
 * - manager -> /manager?tab=docs
 * - employee -> /employee (no docs tab, redirect to employee page)
 */
export default async function DocsPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }

  const role = session.user.role?.toLowerCase() || 'manager'
  
  if (role === 'owner') {
    redirect('/owner?tab=docs')
  } else if (role === 'manager') {
    redirect('/manager?tab=docs')
  } else {
    // Employee or other roles - redirect to employee page
    redirect('/employee')
  }
}
