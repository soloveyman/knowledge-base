"use client"

import { useRouter } from "next/navigation"
import { ClipboardList, Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"

interface Assignment {
  id: string
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
  dueDate: string
  createdAt: string
  createdBy: string
  status: string
}

interface AssignmentsPageProps {
  assignments: Assignment[]
  onDeleteAssignment: (id: string) => void
  onViewAssignment: (id: string) => void
  onEditAssignment: (id: string) => void
}

export function AssignmentsPage({ 
  assignments, 
  onDeleteAssignment, 
  onViewAssignment,
  onEditAssignment
}: AssignmentsPageProps) {
  const router = useRouter()

  const assignmentItems = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.name,
    subtitle: assignment.description || 'No description provided',
    metadata: [
      `Document: ${assignment.document.name}`,
      `Test: ${assignment.test.title}`,
      `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`
    ],
    badges: [
      { label: `${assignment.assignedUsers.length} employee(s)`, variant: "outline" as const },
      { 
        label: assignment.status, 
        variant: assignment.status === 'active' ? "default" as const : "secondary" as const 
      }
    ],
    onClick: () => onViewAssignment(assignment.id),
    onDelete: () => onDeleteAssignment(assignment.id),
    onEdit: () => onEditAssignment(assignment.id)
  }))

  return (
    <ManagementPage
      title="Assignments"
      description="Assign training modules and tests to employees"
      icon={<ClipboardList className="h-8 w-8" />}
      actionButton={{
        label: "Create Assignment",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/assignment-builder')
      }}
      items={assignmentItems}
      showEditButton={true}
      emptyState={{
        icon: <ClipboardList className="h-12 w-12" />,
        title: "No assignments created yet",
        description: "Create your first assignment using the Assignment Builder",
        actionLabel: "Create Assignment",
        onAction: () => router.push('/assignment-builder')
      }}
    />
  )
}
