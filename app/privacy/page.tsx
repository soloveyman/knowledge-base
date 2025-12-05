import { headers } from "next/headers"
import { translations } from "@/lib/translations"
import type { Metadata } from "next"

// Detect language from Accept-Language header for server-side rendering
function detectLanguage(acceptLanguage: string): 'en' | 'ru' {
  // Check for Russian/CIS language codes
  if (/ru|uk|be|kk/i.test(acceptLanguage)) {
    return 'ru'
  }
  
  return 'en'
}

// Format date based on current language
function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

export const metadata: Metadata = {
  title: "Privacy Policy | Uppstaff",
  description: "Privacy Policy for Uppstaff - AI Training & Knowledge Platform. Learn how we collect, use, and protect your information.",
  robots: {
    index: true,
    follow: true,
  },
}

export default async function PrivacyPage() {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''
  const lang = detectLanguage(acceptLanguage)
  const translationsForLang = translations[lang]
  
  // Create a translation function similar to useTranslation hook
  const t = (key: keyof typeof translationsForLang): string => {
    return translationsForLang[key] || translations.en[key as keyof typeof translations.en] || key
  }
  
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US'

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">{t("privacyTitle")}</h1>
      
      <div className="prose prose-lg dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-6">
          <strong>{t("privacyLastUpdated")}</strong> {formatDate(new Date(), locale)}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection1Title")}</h2>
          <p className="mb-4">
            {t("privacySection1Intro")}
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>{t("privacySection1Item1")}</li>
            <li>{t("privacySection1Item2")}</li>
            <li>{t("privacySection1Item3")}</li>
            <li>{t("privacySection1Item4")}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection2Title")}</h2>
          <p className="mb-4">
            {t("privacySection2Intro")}
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>{t("privacySection2Item1")}</li>
            <li>{t("privacySection2Item2")}</li>
            <li>{t("privacySection2Item3")}</li>
            <li>{t("privacySection2Item4")}</li>
            <li>{t("privacySection2Item5")}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection3Title")}</h2>
          <p className="mb-4">
            {t("privacySection3Intro")}
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>{t("privacySection3Item1")}</li>
            <li>{t("privacySection3Item2")}</li>
            <li>{t("privacySection3Item3")}</li>
            <li>{t("privacySection3Item4")}</li>
          </ul>
          <p className="mb-4">
            {t("privacySection3Scope")} <code className="bg-muted px-2 py-1 rounded">https://www.googleapis.com/auth/drive.readonly</code> {t("privacySection3ScopeDesc")}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection4Title")}</h2>
          <p className="mb-4">
            {t("privacySection4Content")}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection5Title")}</h2>
          <p className="mb-4">
            {t("privacySection5Intro")}
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>{t("privacySection5Item1")}</li>
            <li>{t("privacySection5Item2")}</li>
            <li>{t("privacySection5Item3")}</li>
            <li>{t("privacySection5Item4")}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection6Title")}</h2>
          <p className="mb-4">
            {t("privacySection6Intro")}
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>{t("privacySection6Item1")}</li>
            <li>{t("privacySection6Item2")}</li>
            <li>{t("privacySection6Item3")}</li>
            <li>{t("privacySection6Item4")}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection7Title")}</h2>
          <p className="mb-4">
            {t("privacySection7Content")}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection8Title")}</h2>
          <p className="mb-4">
            {t("privacySection8Content")}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{t("privacySection9Title")}</h2>
          <p className="mb-4">
            {t("privacySection9Intro")}
          </p>
          <p className="mb-4">
            <strong>{t("privacySection9Email")}</strong> uppstaffknowledge@gmail.com
          </p>
        </section>
      </div>
    </div>
  )
}

// Allow static generation where possible, but support dynamic language detection
export const dynamic = 'auto'
export const revalidate = 3600 // Revalidate every hour
