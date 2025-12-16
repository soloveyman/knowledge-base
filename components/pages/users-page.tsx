"use client"

import { useRouter } from "next/navigation"
import { ManagementPage } from "@/components/common/management-page"
import { Plus } from "lucide-react"
import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { useUsageLimits } from "@/lib/hooks/use-usage-limits"
import { formatDateShort } from "@/lib/date-format"
import { toast } from "sonner"

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
  hideEmptyState?: boolean
  /**
   * Optional flag to indicate that this page is used in manager dashboard.
   * For managers we only show/manage employees, owners keep full team visibility.
   */
  isManagerView?: boolean
}

export function UsersPage({ 
  users, 
  onDeleteUser, 
  onViewUser,
  onEditUser,
  hideEmptyState = false,
  isManagerView = false,
}: UsersPageProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()
  const { limits } = useUsageLimits()
  const isUserLimitDisabled = limits?.users.expired ?? false

  const handleAddUser = () => {
    if (isUserLimitDisabled) {
      toast.error(
        `User limit reached (${limits?.users.current}/${limits?.users.max}). Please upgrade your plan to continue.`,
        { duration: 5000 }
      )
      return
    }
    router.push('/user-builder')
  }

  // Managers should only see/manage employees; owners see all non-owner users.
  const visibleUsers = isManagerView 
    ? users.filter((user) => user.role === 'employee')
    : users

  const userItems = visibleUsers.map((user) => ({
    id: user.id,
    title: user.name,
    subtitle: `${user.job} • ${user.email}`,
    metadata: [
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
        onClick: handleAddUser,
        disabled: isUserLimitDisabled
      }}
      items={userItems}
      showEditButton={true}
      hideEmptyState={hideEmptyState}
      emptyState={{
        icon: <span className="text-5xl">👥</span>,
        title: t('noUsersCreatedYet'),
        description: t('createYourFirstUserAccount'),
        actionLabel: t('addUser'),
        onAction: handleAddUser
      }}
    />
  )
}
