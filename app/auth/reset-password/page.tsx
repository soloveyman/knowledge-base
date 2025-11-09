import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ResetPasswordForm } from "./reset-password-form"

// Allow dynamic rendering for auth checks
export const dynamic = 'auto'

export default async function ResetPasswordPage() {
  // Check if user is already authenticated
  const session = await auth()
  
  if (session?.user) {
    // Redirect authenticated users to their dashboard
    const role = session.user.role?.toLowerCase()
    if (role === 'super-admin') redirect('/super-admin')
    if (role === 'owner') redirect('/owner')
    if (role === 'manager') redirect('/manager')
    if (role === 'employee') redirect('/employee')
  }
  
  return <ResetPasswordForm />
}
