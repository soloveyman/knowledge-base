"use client"

import { useState, useMemo, useTransition, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { OnboardingState, OnboardingStep } from "@/lib/onboarding/getOnboardingState"
import { dismissOnboarding } from "@/lib/onboarding/actions"
import { useTranslation } from "@/lib/translation-context"

interface OnboardingModalProps {
  initialState: OnboardingState | null
}

const TOTAL_STEPS: OnboardingStep = 4

export function OnboardingModal({ initialState }: OnboardingModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [open, setOpen] = useState<boolean>(initialState?.shouldShow ?? false)
  const [isPending, startTransition] = useTransition()

  const state = initialState

  // Sync open state with initialState.shouldShow
  useEffect(() => {
    if (initialState?.shouldShow !== undefined) {
      setOpen(initialState.shouldShow)
    }
  }, [initialState?.shouldShow])

  // Log onboarding state for debugging
  useEffect(() => {
    if (initialState) {
      console.log('[OnboardingModal] Initial state:', { shouldShow: initialState.shouldShow, currentStep: initialState.currentStep, done: initialState.done })
    } else {
      console.log('[OnboardingModal] No initial state provided')
    }
  }, [initialState])

  const currentStep: OnboardingStep = state?.currentStep ?? 1

  const progressValue = useMemo(() => {
    const completed = state
      ? [1, 2, 3, 4].filter((step) => state.done[step as OnboardingStep]).length
      : 0
    return (completed / TOTAL_STEPS) * 100
  }, [state])

  const baseDashboardPath = useMemo(() => {
    if (!pathname) return "/owner"
    if (pathname.startsWith("/manager")) return "/manager"
    return "/owner"
  }, [pathname])

  const stepConfig = useMemo(() => {
    const base = baseDashboardPath

    return {
      1: {
        title: t("onboardingStep1Title"),
        description: t("onboardingStep1Description"),
        primaryLabel: t("onboardingStep1Button"),
        primaryHref:
          base === "/manager" ? "/manager?tab=users" : "/owner?tab=users",
      },
      2: {
        title: t("onboardingStep2Title"),
        description: t("onboardingStep2Description"),
        primaryLabel: t("onboardingStep2Button"),
        primaryHref:
          base === "/manager"
            ? "/docs/import?returnTo=/manager?tab=docs"
            : "/docs/import?returnTo=/owner?tab=docs",
      },
      3: {
        title: t("onboardingStep3Title"),
        description: t("onboardingStep3Description"),
        primaryLabel: t("onboardingStep3Button"),
        primaryHref:
          base === "/manager"
            ? "/test-builder?returnTo=/manager?tab=tests"
            : "/test-builder?returnTo=/owner?tab=tests",
      },
      4: {
        title: t("onboardingStep4Title"),
        description: t("onboardingStep4Description"),
        primaryLabel: t("onboardingStep4Button"),
        primaryHref:
          base === "/manager"
            ? "/assignment-builder?returnTo=/manager?tab=assignments"
            : "/assignment-builder?returnTo=/owner?tab=assignments",
        secondaryLabel: t("onboardingStep4SecondaryButton"),
        secondaryHref:
          base === "/manager"
            ? "/manager?tab=overview"
            : "/owner?tab=overview",
      },
    } as const
  }, [baseDashboardPath, t])

  if (!state || !state.shouldShow) {
    return null
  }

  const step = stepConfig[currentStep]

  const handlePrimary = () => {
    setOpen(false)
    router.push(step.primaryHref)
  }

  const handleSecondary = () => {
    if (!('secondaryHref' in step) || !step.secondaryHref) return
    setOpen(false)
    router.push(step.secondaryHref)
  }

  const handleRemindLater = () => {
    startTransition(async () => {
      try {
        const result = await dismissOnboarding()
        if (result.ok) {
          setOpen(false)
        } else {
          console.error('[OnboardingModal] Failed to dismiss onboarding:', result.error)
          // Still close the modal even if dismiss fails
          setOpen(false)
        }
      } catch (error) {
        console.error('[OnboardingModal] Error dismissing onboarding:', error)
        // Still close the modal even if dismiss fails
        setOpen(false)
      }
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    // If user closes the modal manually (not via "Remind Later"), don't dismiss onboarding
    // They can reopen it by refreshing or it will show again on next page load if shouldShow is true
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("onboardingTitle")}</DialogTitle>
          <DialogDescription>
            {t("onboardingStepOf")
              .replace("{current}", String(currentStep))
              .replace("{total}", String(TOTAL_STEPS))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progressValue} />

          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>

          {state.counts && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">{t("onboardingStatsTeam")}</span>{" "}
                {state.counts.members}
              </div>
              <div>
                <span className="font-medium">{t("onboardingStatsDocuments")}</span>{" "}
                {state.counts.documents}
              </div>
              <div>
                <span className="font-medium">{t("onboardingStatsTests")}</span>{" "}
                {state.counts.tests}
              </div>
              <div>
                <span className="font-medium">{t("onboardingStatsAssignments")}</span>{" "}
                {state.counts.assignments}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handlePrimary} disabled={isPending}>
              {step.primaryLabel}
            </Button>
            {'secondaryHref' in step && step.secondaryHref && step.secondaryLabel && (
              <Button
                variant="outline"
                onClick={handleSecondary}
                disabled={isPending}
              >
                {step.secondaryLabel}
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            type="button"
            onClick={handleRemindLater}
            disabled={isPending}
          >
            {t("onboardingRemindLater")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


