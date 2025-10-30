"use client"

import { useTranslation } from "@/lib/translation-context"
import { useBadgeTranslation } from "@/lib/badge-translations"
import { FileText, Plus } from "lucide-react"
import { ManagementPage } from "../common/management-page"
import { useRouter } from "next/navigation"

interface Document {
  id: string
  name: string
  type: string
  uploadedAt: string
  size?: string
  status?: string
}

interface DocumentsPageProps {
  documents: Document[]
  onDeleteDocument: (id: string) => void
  onViewDocument: (name: string) => void
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

  const documentItems = documents.map((doc) => ({
    id: doc.id,
    title: doc.name,
    subtitle: `${t('uploaded')} ${doc.uploadedAt.replace(/^Uploaded\s+/, '')}`,
    metadata: doc.size ? [doc.size] : undefined,
    badges: [
      {
        label: translateBadge(doc.type),
        variant: (doc.type === 'DOCX'
          ? 'default' as const
          : doc.type === 'XLSX'
            ? 'secondary' as const
            : 'outline' as const)
      },
      ...(doc.status === 'ready' ? [{ label: translateBadge('ready'), variant: 'default' as const }] : [])
    ],
    onClick: () => onViewDocument(doc.name),
    onDelete: () => onDeleteDocument(doc.id)
  }))

  return (
    <ManagementPage
      title={t('uploadedDocuments')}
      description={t('viewAndManageDocuments')}
      icon={<FileText className="h-8 w-8" />}
      actionButton={{
        label: t('importDocument'),
        icon: <Plus className="h-4 w-4" />,
        onClick: onImportDocument || (() => router.push('/docs/import?returnTo=/docs'))
      }}
      items={documentItems}
      emptyState={{
        icon: <FileText className="h-12 w-12" />,
        title: t('noDocumentsUploaded'),
        description: t('getStartedImportDocument'),
        actionLabel: t('importDocument'),
        onAction: onImportDocument || (() => router.push('/docs/import?returnTo=/docs'))
      }}
    />
  )
}
