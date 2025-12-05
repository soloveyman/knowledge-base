"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Mail, ArrowLeft } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"
import Link from "next/link"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccess(false)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      
      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        toast.error(data.error || t('errorOccurred'), {
          duration: 5000
        })
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)
      toast.success(t('resetLinkSent'), {
        duration: 5000
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errorOccurred'), {
        duration: 5000
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D29] dark:bg-[#1A1D29] px-4 py-8 md:py-12 pb-16 md:pb-20">
      <Card className="w-full max-w-md bg-card/95 border-border">
        <CardHeader className="text-center space-y-4">
          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold justify-center">{t('forgotPasswordTitle')}</CardTitle>
            <CardDescription className="text-center">
              {t('forgotPasswordDescription')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {success ? (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200">{t('resetLinkSent')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')} *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('enterYourEmail')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full min-w-[96px]" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('sendResetLink')}
              </Button>
            </form>
          )}
          
          <div className="text-center text-sm mt-6">
            <Link
              href="/auth/signin"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

