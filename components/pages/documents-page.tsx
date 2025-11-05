"use client"

import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"
import { useRouter } from "next/navigation"

interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

interface DocumentsPageProps {
  documents: Document[]
  onDeleteDocument: (id: string) => void
  onViewDocument: (id: string, name?: string) => void
  onImportDocument?: () => void
}

export function DocumentsPage({ 
  documents, 
  onDeleteDocument, 
  onViewDocument,
  onImportDocument
}: DocumentsPageProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const translateBadge = useBadgeTranslation()

  const documentItems = documents.map((doc) => {
    const badges = []
    if (doc.status === 'ready') {
      badges.push({ label: translateBadge('ready'), variant: 'default' as const })
    }
    // Check if document was updated (updatedAt exists and is different from createdAt)
    if (doc.updatedAt && doc.createdAt && new Date(doc.updatedAt) > new Date(doc.createdAt)) {
      badges.push({ label: translateBadge('updated'), variant: 'secondary' as const })
    }
    
    return {
      id: doc.id,
      title: doc.name,
      subtitle: `${t('uploaded')} ${doc.uploadedAt.replace(/^Uploaded\s+/, '')}`,
      metadata: doc.size ? [doc.size] : undefined,
      badges,
      onClick: () => {
        console.log('Document card clicked - ID:', doc.id, 'Name:', doc.name)
        onViewDocument(String(doc.id), doc.name)
      },
      onDelete: () => onDeleteDocument(doc.id)
    }
  })

  return (
    <ManagementPage
      title={t('uploadedDocuments')}
      description={t('viewAndManageDocuments')}
      icon={<span className="text-4xl">📄</span>}
      actionButton={{
        label: t('importDocument'),
        icon: <Plus className="h-4 w-4" />,
        onClick: onImportDocument || (() => router.push('/docs/import?returnTo=/docs'))
      }}
      items={documentItems}
      emptyState={{
        icon: <span className="text-5xl">📄</span>,
        title: t('noDocumentsUploaded'),
        description: t('getStartedImportDocument'),
        actionLabel: t('importDocument'),
        onAction: onImportDocument || (() => router.push('/docs/import?returnTo=/docs'))
      }}
    />
  )
}
