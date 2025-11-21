import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"

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
  
  // Public homepage for Google verification
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-bold">Uppstaff</h1>
        <p className="text-lg text-muted-foreground">
          AI Training & Knowledge Platform
        </p>
        <div className="pt-8">
          <Link 
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <footer className="pt-16 border-t">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <span>© {new Date().getFullYear()} Uppstaff. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
