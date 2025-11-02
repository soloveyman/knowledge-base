"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"

interface Test {
  id: string
  title: string
  type: string
  difficulty: string
  locale: string
  questionCount: number
  sourceDocument: string
  createdAt: string
  createdBy: string
}

interface TestsPageProps {
  tests: Test[]
  onDeleteTest: (id: string) => void
  onViewTest: (id: string) => void
  onEditTest: (id: string) => void
  isLoading?: boolean
}

export function TestsPage({ 
  tests, 
  onDeleteTest, 
  onViewTest,
  onEditTest,
  isLoading = false
}: TestsPageProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

  const testItems = tests.map((test) => ({
    id: test.id,
    title: test.title,
    subtitle: `${test.type} • ${test.questionCount} ${t('questions')} • ${t('created')} ${new Date(test.createdAt).toLocaleDateString()}`,
    metadata: [],
    badges: [
      { label: translateBadge(test.difficulty || 'medium'), variant: "outline" as const }
    ],
    onClick: () => onViewTest(test.id),
    onDelete: () => onDeleteTest(test.id),
    onEdit: () => onEditTest(test.id)
  }))

  return (
    <ManagementPage
      title={<><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">🧪</span> <span className="leading-none self-center">{t('testManagement')}</span></>}
      description={t('createAndManageTests')}
      icon={<span className="text-4xl">🧪</span>}
      actionButton={{
        label: t('createTest'),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/test-builder')
      }}
      items={testItems}
      showEditButton={true}
      isLoading={isLoading}
      emptyState={{
        icon: <span className="text-5xl">🧪</span>,
        title: t('noTestsCreated'),
        description: t('getStartedCreateTest'),
        actionLabel: t('createTest'),
        onAction: () => router.push('/test-builder')
      }}
    />
  )
}
