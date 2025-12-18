import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "404 - Page Not Found | Uppstaff",
  description: "The page you are looking for does not exist.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-4">
          <Link 
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}

