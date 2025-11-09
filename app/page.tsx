import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Home() {
  // Server-side redirect
  // Middleware handles authenticated user redirects, but we check here too
  const session = await auth()
  
  if (session?.user?.role) {
    const role = session.user.role.toLowerCase()
    if (role === 'super-admin') redirect('/super-admin')
    if (role === 'owner') redirect('/owner')
    if (role === 'manager') redirect('/manager')
    if (role === 'employee') redirect('/employee')
  }
  
  redirect("/auth/signin")
}
