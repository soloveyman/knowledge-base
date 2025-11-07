"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { formatDateShort } from "@/lib/date-format"

interface Assignment {
  id: string
  title?: string
  name: string
  description: string
  document: {
    id: number
    name: string
    type: string
    uploadedAt: string
  }
  test: {
    id: string
    title: string
    questionCount: number
  }
  assignedUsers: Array<{
    id: number
    name: string
    email: string
    role: string
    department: string
  }>
  dueDate?: string
  createdAt: string
  createdBy: string
  status: string
}

interface AssignmentsPageProps {
  assignments: Assignment[]
  onDeleteAssignment: (id: string) => void
  onViewAssignment: (id: string) => void
  onEditAssignment: (id: string) => void
  isLoading?: boolean
  hideEmptyState?: boolean
}

export function AssignmentsPage({ 
  assignments, 
  onDeleteAssignment, 
  onViewAssignment,
  onEditAssignment,
  isLoading = false,
  hideEmptyState = false
}: AssignmentsPageProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

  const assignmentItems = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title || assignment.name || `Assignment ${assignment.id.slice(0, 8)}`, // Use custom title or ID as fallback
    subtitle: `${t('due')}: ${assignment.dueDate ? formatDateShort(assignment.dueDate) : t('noDueDate')} | ${t('created')}: ${formatDateShort(assignment.createdAt)}`,
    metadata: [],
    badges: [
      { 
        label: translateBadge(assignment.status || 'pending'), 
        variant: assignment.status === 'completed' ? "default" as const : 
                assignment.status === 'in_progress' ? "secondary" as const : 
                "outline" as const 
      }
    ],
    onClick: () => onViewAssignment(assignment.id),
    onDelete: () => onDeleteAssignment(assignment.id),
    onEdit: () => onEditAssignment(assignment.id)
  }))

  return (
    <ManagementPage
      title={<><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">📋</span> <span className="leading-none self-center">{t('assignmentManagement')}</span></>}
      description={t('assignTrainingModules')}
      icon={<span className="text-4xl">📋</span>}
      actionButton={{
        label: t('createAssignment'),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/assignment-builder')
      }}
      items={assignmentItems}
      showEditButton={true}
      isLoading={isLoading}
      hideEmptyState={hideEmptyState}
      emptyState={{
        icon: <span className="text-5xl">📋</span>,
        title: t('noAssignmentsCreated'),
        description: t('getStartedCreateAssignment'),
        actionLabel: t('createAssignment'),
        onAction: () => router.push('/assignment-builder')
      }}
    />
  )
}
