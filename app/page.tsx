import Link from "next/link"

// Make this page static/public - no auth required
export const dynamic = 'force-static'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-4xl w-full space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Uppstaff
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              AI Training & Knowledge Platform
            </p>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Empower your team with intelligent training, knowledge management, and comprehensive learning solutions.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">AI-Powered Training</h3>
              <p className="text-sm text-muted-foreground">
                Leverage artificial intelligence to create personalized training experiences and track progress.
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">Knowledge Base</h3>
              <p className="text-sm text-muted-foreground">
                Centralize your organization's knowledge with easy-to-manage documents and materials.
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">Team Management</h3>
              <p className="text-sm text-muted-foreground">
                Assign training, track completion, and generate reports for your entire organization.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pt-8">
            <Link 
              href="/auth/signin"
              className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">•</span>
          <span>© {new Date().getFullYear()} Uppstaff. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
