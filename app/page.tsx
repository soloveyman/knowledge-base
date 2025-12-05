import Link from "next/link"
import { headers } from "next/headers"
import { translations } from "@/lib/translations"

// Detect language from Accept-Language header for server-side rendering
function detectLanguage(acceptLanguage: string): 'en' | 'ru' {
  // Check for Russian/CIS language codes
  if (/ru|uk|be|kk/i.test(acceptLanguage)) {
    return 'ru'
  }
  
  return 'en'
}

export default async function Home() {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''
  const lang = detectLanguage(acceptLanguage)
  const t = translations[lang]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-4xl w-full space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              {t.homeTitle}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {t.homeSubtitle}
            </p>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {t.homeDescription}
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">{t.homeFeatureAITraining}</h3>
              <p className="text-sm text-muted-foreground">
                {t.homeFeatureAITrainingDesc}
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">{t.homeFeatureKnowledgeBase}</h3>
              <p className="text-sm text-muted-foreground">
                {t.homeFeatureKnowledgeBaseDesc}
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-lg font-semibold mb-2">{t.homeFeatureTeamManagement}</h3>
              <p className="text-sm text-muted-foreground">
                {t.homeFeatureTeamManagementDesc}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pt-8">
            <Link 
              href="/auth/signin"
              className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              {t.homeGetStarted}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground underline">
            {t.homePrivacyPolicy}
          </Link>
          <span className="hidden sm:inline">•</span>
          <span>© {new Date().getFullYear()} Uppstaff. {t.homeAllRightsReserved}.</span>
        </div>
      </footer>
    </div>
  )
}

// Allow static generation where possible, but support dynamic language detection
export const dynamic = 'auto'
export const revalidate = 3600 // Revalidate every hour
