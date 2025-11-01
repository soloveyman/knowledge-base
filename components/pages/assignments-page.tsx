"use client"

import { useRouter } from "next/navigation"
import { ClipboardList, Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"

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
}

export function AssignmentsPage({ 
  assignments, 
  onDeleteAssignment, 
  onViewAssignment,
  onEditAssignment,
  isLoading = false
}: AssignmentsPageProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

  const assignmentItems = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title || assignment.name || `Assignment ${assignment.id.slice(0, 8)}`, // Use custom title or ID as fallback
    subtitle: `${t('due')}: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : t('noDueDate')} | ${t('created')}: ${new Date(assignment.createdAt).toLocaleDateString()}`,
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
      title={t('assignmentManagement')}
      description={t('assignTrainingModules')}
      icon={<ClipboardList className="h-8 w-8" />}
      actionButton={{
        label: t('createAssignment'),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/assignment-builder')
      }}
      items={assignmentItems}
      showEditButton={true}
      isLoading={isLoading}
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
