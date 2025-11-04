import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AuthCallbackPage() {
  const session = await auth()
  
  if (!session?.user?.role) {
    redirect("/auth/signin")
  }

  const role = session.user.role.toLowerCase()
  
  if (role === 'super-admin') {
    redirect('/super-admin')
  } else if (role === 'owner') {
    redirect('/owner')
  } else if (role === 'manager') {
    redirect('/manager')
  } else {
    redirect('/employee')
  }
}

