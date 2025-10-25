"use client"

import { useRouter } from "next/navigation"
import { ManagementPage } from "@/components/common/management-page"
import { Users, Plus, UserCheck, UserX } from "lucide-react"

interface User {
  id: string
  name: string
  job: string
  email: string
  role: string
  createdAt: string
  createdBy: string
  status: string
}

interface UsersPageProps {
  users: User[]
  onDeleteUser: (id: string) => void
  onViewUser: (id: string) => void
  onEditUser: (id: string) => void
}

export function UsersPage({ 
  users, 
  onDeleteUser, 
  onViewUser,
  onEditUser
}: UsersPageProps) {
  const router = useRouter()

  const userItems = users.map((user) => ({
    id: user.id,
    title: user.name,
    subtitle: `${user.job} • ${user.email}`,
    metadata: [
      `Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`,
      `Created: ${new Date(user.createdAt).toLocaleDateString()}`
    ],
    badges: [
      { 
        label: user.status, 
        variant: user.status === 'active' ? "default" as const : "secondary" as const 
      },
      { 
        label: user.role, 
        variant: user.role === 'manager' ? "outline" as const : "secondary" as const 
      }
    ],
    onClick: () => onViewUser(user.id),
    onDelete: () => onDeleteUser(user.id),
    onEdit: () => onEditUser(user.id)
  }))

  return (
    <ManagementPage
      title="User Management"
      description="Create and manage user accounts, roles, and permissions"
      icon={<Users className="h-6 w-6" />}
      actionButton={{
        label: "Add User",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/user-builder')
      }}
      items={userItems}
      showEditButton={true}
      emptyState={{
        icon: <Users className="h-12 w-12" />,
        title: "No users created yet",
        description: "Create your first user account using the User Builder",
        actionLabel: "Add User",
        onAction: () => router.push('/user-builder')
      }}
    />
  )
}
