"use client"

import { useRouter } from "next/navigation"
import { TestTube, Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"

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
}

export function TestsPage({ 
  tests, 
  onDeleteTest, 
  onViewTest,
  onEditTest
}: TestsPageProps) {
  const router = useRouter()

  const testItems = tests.map((test) => ({
    id: test.id,
    title: test.title,
    subtitle: `${test.type} • ${test.questionCount} questions • Created ${new Date(test.createdAt).toLocaleDateString()}`,
    metadata: [`Source: ${test.sourceDocument}`],
    badges: [
      { label: test.difficulty, variant: "outline" as const },
      { label: test.locale, variant: "secondary" as const }
    ],
    onClick: () => onViewTest(test.id),
    onDelete: () => onDeleteTest(test.id),
    onEdit: () => onEditTest(test.id)
  }))

  return (
    <ManagementPage
      title="Test Management"
      description="Create and manage tests and assessments"
      icon={<TestTube className="h-8 w-8" />}
      actionButton={{
        label: "Create Test",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/test-builder')
      }}
      items={testItems}
      showEditButton={true}
      emptyState={{
        icon: <TestTube className="h-12 w-12" />,
        title: "No tests created yet",
        description: "Create your first test using the Test Builder",
        actionLabel: "Create Test",
        onAction: () => router.push('/test-builder')
      }}
    />
  )
}
