"use client"

import { useRouter } from "next/navigation"
import { ManagementPage } from "@/components/common/management-page"
import { Plus } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { formatDateShort } from "@/lib/date-format"

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
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

  const userItems = users.map((user) => ({
    id: user.id,
    title: user.name,
    subtitle: `${user.job} • ${user.email}`,
    metadata: [
      `${t('role')}: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`,
      `${t('created')}: ${formatDateShort(user.createdAt)}`
    ],
    badges: [
      { 
        label: translateBadge(user.status), 
        variant: user.status === 'active' ? "default" as const : "secondary" as const 
      },
      { 
        label: translateBadge(user.role), 
        variant: user.role === 'manager' ? "outline" as const : "secondary" as const 
      }
    ],
    onClick: () => onViewUser(user.id),
    onDelete: () => onDeleteUser(user.id),
    onEdit: () => onEditUser(user.id),
    deleteDataLossWarning: "Deleting this user will permanently remove all their test attempts, assignments, progress, and group memberships. Content they created (modules, documents, tests) will remain but will no longer be linked to any user."
  }))

  return (
    <ManagementPage
      title={<><span className="text-2xl leading-none inline-flex items-center justify-center w-fit self-center">👥</span> <span className="leading-none self-center">{t('userManagement')}</span></>}
      description={t('createAndManageUserAccounts')}
      icon={<span className="text-4xl">👥</span>}
      actionButton={{
        label: t('addUser'),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => router.push('/user-builder')
      }}
      items={userItems}
      showEditButton={true}
      emptyState={{
        icon: <span className="text-5xl">👥</span>,
        title: t('noUsersCreatedYet'),
        description: t('createYourFirstUserAccount'),
        actionLabel: t('addUser'),
        onAction: () => router.push('/user-builder')
      }}
    />
  )
}
